import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';

const MAX_TEXT_BYTES = 16 * 1024 * 1024;
const startsWithBytes = (buffer, bytes) => bytes.every((byte, index) => buffer[index] === byte);
const startsWithAscii = (buffer, value) => buffer.subarray(0, value.length).toString('ascii') === value;
const KNOWN_BINARY_SIGNATURES = [
  ['AVIF image', (buffer) => buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp'
    && ['avif', 'avis'].includes(buffer.subarray(8, 12).toString('ascii'))],
  ['GIF image', (buffer) => startsWithAscii(buffer, 'GIF87a') || startsWithAscii(buffer, 'GIF89a')],
  ['gzip archive', (buffer) => startsWithBytes(buffer, [0x1f, 0x8b])],
  ['ICO image', (buffer) => startsWithBytes(buffer, [0x00, 0x00, 0x01, 0x00])],
  ['JPEG image', (buffer) => startsWithBytes(buffer, [0xff, 0xd8, 0xff])],
  ['PDF document', (buffer) => startsWithAscii(buffer, '%PDF-')],
  ['PNG image', (buffer) => startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  ['WebAssembly binary', (buffer) => startsWithBytes(buffer, [0x00, 0x61, 0x73, 0x6d])],
  ['WebP image', (buffer) => buffer.length >= 12 && startsWithAscii(buffer, 'RIFF')
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'],
  ['ZIP archive', (buffer) => startsWithBytes(buffer, [0x50, 0x4b, 0x03, 0x04])
    || startsWithBytes(buffer, [0x50, 0x4b, 0x05, 0x06])
    || startsWithBytes(buffer, [0x50, 0x4b, 0x07, 0x08])],
];
const DANGEROUS_EXTENSIONS = new Set([
  '.7z', '.avif', '.avi', '.bin', '.bmp', '.br', '.bz2', '.dll', '.dylib', '.eot',
  '.exe', '.gif', '.gz', '.gzip', '.heic', '.heif', '.ico', '.jpeg', '.jpg', '.mov',
  '.mp3', '.mp4', '.otf', '.pdf', '.png', '.rar', '.so', '.svgz', '.tar', '.tgz',
  '.tif', '.tiff', '.ttf', '.wasm', '.webm', '.webp', '.woff', '.woff2', '.xz', '.zip',
  '.zst',
]);
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
const utf16Decoder = new TextDecoder('utf-16le', { fatal: true });
const lossyUtf8Decoder = new TextDecoder('utf-8');
const ALLOWED_INDEX_BLOB_MODES = new Set(['100644', '100755']);

export function isAllowedIndexBlobMode(mode) {
  return ALLOWED_INDEX_BLOB_MODES.has(mode);
}

function knownBinaryKind(buffer) {
  return KNOWN_BINARY_SIGNATURES.find(([, matches]) => matches(buffer))?.[0];
}

function dangerousExtension(path) {
  const extension = extname(path).toLowerCase();
  return DANGEROUS_EXTENSIONS.has(extension) ? extension : undefined;
}

function git(arguments_, options = {}) {
  return execFileSync('git', ['-c', 'core.excludesFile=', ...arguments_], {
    ...options,
    windowsHide: true,
  });
}

function splitNul(buffer) {
  const parts = [];
  let start = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] !== 0) continue;
    parts.push(buffer.subarray(start, index));
    start = index + 1;
  }
  if (start < buffer.length) parts.push(buffer.subarray(start));
  return parts.filter((part) => part.length > 0);
}

function decodeGitPath(buffer) {
  return utf8Decoder.decode(buffer);
}

function forbiddenPathControlCharacter(path) {
  for (const character of path) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x1f || codePoint === 0x7f || (codePoint >= 0x80 && codePoint <= 0x9f)) {
      return codePoint;
    }
  }
  return undefined;
}

function escapePathForLog(path) {
  return [...path].map((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 0x1f || codePoint === 0x7f || (codePoint >= 0x80 && codePoint <= 0x9f)
      ? `\\u${codePoint.toString(16).toUpperCase().padStart(4, '0')}`
      : character;
  }).join('');
}

function readIndexEntries() {
  const output = git(['ls-files', '--stage', '-z'], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  const parsed = [];
  const violations = [];

  for (const record of splitNul(output)) {
    const tab = record.indexOf(0x09);
    const header = tab >= 0 ? record.subarray(0, tab).toString('ascii') : '';
    const match = /^(\d{6}) ([0-9a-f]{40,64}) ([0-3])$/.exec(header);
    let path = '<unreadable index path>';
    try {
      if (tab >= 0) path = decodeGitPath(record.subarray(tab + 1));
    } catch {
      violations.push({ path, reason: 'index path is not valid UTF-8' });
      continue;
    }
    const rejectedPathControl = forbiddenPathControlCharacter(path);
    if (rejectedPathControl !== undefined) {
      violations.push({
        path: escapePathForLog(path),
        reason: `index path contains forbidden control character U+${rejectedPathControl.toString(16).toUpperCase().padStart(4, '0')}`,
      });
      continue;
    }
    if (!match) {
      violations.push({ path, reason: 'malformed git index entry' });
      continue;
    }
    parsed.push({ mode: match[1], object: match[2], stage: Number(match[3]), path });
  }
  return { parsed, violations };
}

function loadIndexSnapshot() {
  const { parsed, violations } = readIndexEntries();
  const paths = new Map();
  for (const entry of parsed) {
    const entries = paths.get(entry.path) ?? [];
    entries.push(entry);
    paths.set(entry.path, entries);
  }

  const entries = [];
  const blobCache = new Map();
  for (const [path, pathEntries] of paths) {
    const stages = pathEntries.map((entry) => entry.stage);
    if (stages.some((stage) => stage !== 0) || stages.length !== 1) {
      violations.push({ path, reason: `unresolved index stages (${stages.join(', ')})` });
      continue;
    }
    const [{ mode, object }] = pathEntries;
    if (!isAllowedIndexBlobMode(mode)) {
      violations.push({
        path,
        reason: `unsupported git index mode ${mode}; only regular 100644 and 100755 blobs can be scanned`,
      });
      continue;
    }
    const size = Number(git(['cat-file', '-s', object], { encoding: 'utf8', maxBuffer: 1024 }).trim());
    if (!Number.isSafeInteger(size) || size < 0) {
      violations.push({ path, reason: 'git blob size is invalid' });
      continue;
    }
    if (size > MAX_TEXT_BYTES) {
      violations.push({ path, reason: `text blob exceeds ${MAX_TEXT_BYTES} byte scan limit` });
      continue;
    }
    let buffer = blobCache.get(object);
    if (!buffer) {
      buffer = git(['cat-file', 'blob', object], { encoding: 'buffer', maxBuffer: MAX_TEXT_BYTES + 1024 });
      blobCache.set(object, buffer);
    }
    entries.push({ path, buffer });
  }
  return { entries, violations };
}

function listDirectoryFiles(root, directory = root) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '.git') return [];
    const path = join(directory, entry.name);
    const displayPath = relative(root, path).split(sep).join('/');
    const fileStat = lstatSync(path);
    if (entry.isSymbolicLink() || fileStat.isSymbolicLink()) {
      return [{ path: displayPath, violation: 'symbolic links cannot be scanned in directory mode' }];
    }
    if (fileStat.isDirectory()) return listDirectoryFiles(root, path);
    if (!fileStat.isFile()) {
      return [{ path: displayPath, violation: 'non-regular filesystem entries cannot be scanned in directory mode' }];
    }
    if (fileStat.size > MAX_TEXT_BYTES) {
      return [{ path: displayPath, violation: `file exceeds ${MAX_TEXT_BYTES} byte scan limit` }];
    }
    const buffer = readFileSync(path);
    return [{ path: displayPath, buffer }];
  });
}

function loadDirectorySnapshot(root) {
  const resolvedRoot = resolve(root);
  if (!existsSync(resolvedRoot)) {
    return { entries: [], violations: [{ path: String(root), reason: 'directory does not exist' }] };
  }
  const rootStat = lstatSync(resolvedRoot);
  if (rootStat.isSymbolicLink()) {
    return {
      entries: [],
      violations: [{ path: String(root), reason: 'symbolic links cannot be scanned in directory mode' }],
    };
  }
  if (!rootStat.isDirectory()) {
    return {
      entries: [],
      violations: [{ path: String(root), reason: 'directory mode root is not a directory' }],
    };
  }
  const violations = [];
  const entries = [];
  for (const entry of listDirectoryFiles(resolvedRoot)) {
    if (entry.violation) violations.push({ path: entry.path, reason: entry.violation });
    else entries.push(entry);
  }
  return { entries, violations };
}

function decodeUtf16BigEndian(buffer) {
  const body = buffer.subarray(2);
  if (body.length % 2 !== 0) throw new Error('odd UTF-16BE byte length');
  const swapped = Buffer.allocUnsafe(body.length);
  for (let index = 0; index < body.length; index += 2) {
    swapped[index] = body[index + 1];
    swapped[index + 1] = body[index];
  }
  return utf16Decoder.decode(swapped);
}

function printableAsciiRuns(buffer, littleEndian) {
  const runs = [];
  for (const offset of [0, 1]) {
    let current = '';
    for (let index = offset; index + 1 < buffer.length; index += 2) {
      const character = littleEndian ? buffer[index] : buffer[index + 1];
      const zero = littleEndian ? buffer[index + 1] : buffer[index];
      if (zero === 0 && character >= 0x20 && character <= 0x7e) {
        current += String.fromCharCode(character);
      } else {
        if (current.length >= 4) runs.push(current);
        current = '';
      }
    }
    if (current.length >= 4) runs.push(current);
  }
  return runs;
}

function binaryScanTexts(buffer) {
  const latin1Runs = buffer.toString('latin1').match(/[\x20-\x7e]{4,}/g) ?? [];
  return [
    lossyUtf8Decoder.decode(buffer),
    ...latin1Runs,
    ...printableAsciiRuns(buffer, true),
    ...printableAsciiRuns(buffer, false),
  ];
}

function forbiddenControlCharacter(text) {
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    const allowedWhitespace = codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0d;
    if ((!allowedWhitespace && codePoint <= 0x1f)
      || codePoint === 0x7f
      || (codePoint >= 0x80 && codePoint <= 0x9f)) {
      return codePoint;
    }
  }
  return undefined;
}

function decodeEntry(entry) {
  const { buffer } = entry;
  const scanTexts = binaryScanTexts(buffer);
  const rejectedExtension = dangerousExtension(entry.path);
  if (rejectedExtension) {
    return {
      ...entry,
      text: undefined,
      scanTexts,
      encoding: 'binary-policy',
      violation: `binary, archive, or compressed content is not accepted (known dangerous extension ${rejectedExtension}); remove it, convert suitable artwork to safe text SVG, or use a future separate manual review process`,
    };
  }
  const binaryKind = knownBinaryKind(buffer);
  if (binaryKind) {
    return {
      ...entry,
      text: undefined,
      scanTexts,
      encoding: 'binary',
      violation: `binary, archive, or compressed content is not accepted (${binaryKind}); remove it, convert it to safe text SVG, or use a future separate manual review process`,
    };
  }
  try {
    let text;
    let encoding;
    if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
      if ((buffer.length - 2) % 2 !== 0) throw new Error('odd UTF-16LE byte length');
      text = utf16Decoder.decode(buffer.subarray(2));
      encoding = 'utf16le';
    } else if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
      text = decodeUtf16BigEndian(buffer);
      encoding = 'utf16be';
    } else if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      text = utf8Decoder.decode(buffer.subarray(3));
      encoding = 'utf8-bom';
    } else {
      text = utf8Decoder.decode(buffer);
      encoding = 'utf8';
    }
    if (text.includes('\0')) {
      return {
        ...entry,
        scanTexts,
        violation: 'binary, archive, or compressed content is not accepted (unexpected NUL byte); remove it, convert it to safe text SVG, or use a future separate manual review process',
      };
    }
    const rejectedControl = forbiddenControlCharacter(text);
    if (rejectedControl !== undefined) {
      return {
        ...entry,
        scanTexts,
        violation: `text contains forbidden control character U+${rejectedControl.toString(16).toUpperCase().padStart(4, '0')}`,
      };
    }
    return { ...entry, text, scanTexts: [text], encoding };
  } catch {
    return {
      ...entry,
      scanTexts,
      violation: 'binary, archive, or compressed content is not accepted (invalid text encoding); remove it, convert it to safe text SVG, or use a future separate manual review process',
    };
  }
}

export function loadPublicSnapshot({ directory } = {}) {
  const snapshot = directory === undefined ? loadIndexSnapshot() : loadDirectorySnapshot(directory);
  const entries = [];
  const violations = [...snapshot.violations];
  for (const entry of snapshot.entries) {
    const decoded = decodeEntry(entry);
    if (decoded.violation) violations.push({ path: decoded.path, reason: decoded.violation });
    if (decoded.scanTexts) entries.push(decoded);
  }
  return { entries, violations };
}
