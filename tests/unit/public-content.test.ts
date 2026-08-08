import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { brotliCompressSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { isAllowedIndexBlobMode } from '../../scripts/public-snapshot.mjs';

const contentGate = resolve('scripts/check-public-content.mjs');

type FixtureFile = { path: string; contents: string | Uint8Array };

function writeFiles(root: string, files: FixtureFile[]) {
  for (const file of files) {
    const path = join(root, file.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.contents);
  }
}

function runContentGate(files: FixtureFile[]) {
  const root = mkdtempSync(join(tmpdir(), 'oasis-content-'));
  writeFiles(root, files.map((file) => ({ ...file, path: join('src', 'content', 'posts', file.path) })));
  return spawnSync(process.execPath, [contentGate, '--directory', '.'], { cwd: root, encoding: 'utf8' });
}

function createTrackedSnapshot(files: FixtureFile[]) {
  const root = mkdtempSync(join(tmpdir(), 'oasis-snapshot-'));
  const git = (...arguments_: string[]) => execFileSync(
    'git',
    ['-c', 'core.excludesFile=', '-c', 'core.autocrlf=false', ...arguments_],
    { cwd: root },
  );
  git('init', '--quiet');
  writeFiles(root, files);
  git('add', '--', '.');
  return root;
}

function runSnapshotGate(files: FixtureFile[], worktreeFiles: FixtureFile[] = []) {
  const root = createTrackedSnapshot(files);
  writeFiles(root, worktreeFiles);
  return spawnSync(process.execPath, [contentGate], { cwd: root, encoding: 'utf8' });
}

function runRawIndexedPathGate(path: string) {
  const root = createTrackedSnapshot([{ path: 'README.md', contents: 'public readme' }]);
  const hash = execFileSync('git', ['hash-object', '-w', '--stdin'], {
    cwd: root,
    input: 'safe staged content',
    encoding: 'utf8',
  }).trim();
  const pathBytes = Buffer.from(path, 'utf8');
  const entryLength = Math.ceil((62 + pathBytes.length + 1) / 8) * 8;
  const header = Buffer.alloc(12);
  header.write('DIRC', 0, 'ascii');
  header.writeUInt32BE(2, 4);
  header.writeUInt32BE(1, 8);
  const entry = Buffer.alloc(entryLength);
  entry.writeUInt32BE(0o100644, 24);
  Buffer.from(hash, 'hex').copy(entry, 40);
  entry.writeUInt16BE(Math.min(pathBytes.length, 0x0fff), 60);
  pathBytes.copy(entry, 62);
  const body = Buffer.concat([header, entry]);
  const checksum = createHash('sha1').update(body).digest();
  writeFileSync(join(root, '.git', 'index'), Buffer.concat([body, checksum]));
  return spawnSync(process.execPath, [contentGate], { cwd: root, encoding: 'utf8' });
}

function runUnmergedSnapshotGate() {
  const root = createTrackedSnapshot([{ path: 'conflict.txt', contents: 'stage zero' }]);
  const hash = execFileSync('git', ['hash-object', '-w', '--stdin'], {
    cwd: root,
    input: 'conflicted content',
    encoding: 'utf8',
  }).trim();
  execFileSync('git', ['update-index', '--force-remove', '--', 'conflict.txt'], { cwd: root });
  execFileSync('git', ['update-index', '--index-info'], {
    cwd: root,
    input: `100644 ${hash} 1\tconflict.txt\n100644 ${hash} 2\tconflict.txt\n`,
  });
  return spawnSync(process.execPath, [contentGate], { cwd: root, encoding: 'utf8' });
}

function runIndexedModeGate(mode: string, target: string) {
  const root = createTrackedSnapshot([{ path: 'README.md', contents: 'public readme' }]);
  const hash = execFileSync('git', ['hash-object', '-w', '--stdin'], {
    cwd: root,
    input: target,
    encoding: 'utf8',
  }).trim();
  execFileSync('git', ['update-index', '--add', '--cacheinfo', mode, hash, 'public/leak'], { cwd: root });
  return spawnSync(process.execPath, [contentGate], { cwd: root, encoding: 'utf8' });
}

function runExecutableTextGate() {
  const root = createTrackedSnapshot([{ path: 'scripts/release.sh', contents: '#!/bin/sh\necho safe\n' }]);
  execFileSync('git', ['update-index', '--chmod=+x', '--', 'scripts/release.sh'], { cwd: root });
  return spawnSync(process.execPath, [contentGate], { cwd: root, encoding: 'utf8' });
}

function runDirectoryRootSymlinkGate() {
  const root = mkdtempSync(join(tmpdir(), 'oasis-directory-root-'));
  const target = join(root, 'target');
  const link = join(root, 'linked-root');
  mkdirSync(target);
  writeFileSync(join(target, 'safe.txt'), 'safe text');
  symlinkSync(target, link, 'junction');
  return spawnSync(process.execPath, [contentGate, '--directory', link], {
    cwd: root,
    encoding: 'utf8',
  });
}

function utf16BigEndian(value: string) {
  const littleEndian = Buffer.from(value, 'utf16le');
  for (let index = 0; index < littleEndian.length; index += 2) {
    [littleEndian[index], littleEndian[index + 1]] = [littleEndian[index + 1], littleEndian[index]];
  }
  return Buffer.concat([Buffer.from([0xfe, 0xff]), littleEndian]);
}

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function minimalTrueTypeFont() {
  const font = Buffer.alloc(29);
  font.writeUInt32BE(0x00010000, 0);
  font.writeUInt16BE(1, 4);
  font.writeUInt16BE(16, 6);
  font.writeUInt16BE(0, 8);
  font.writeUInt16BE(0, 10);
  font.write('name', 12, 'ascii');
  font.writeUInt32BE(28, 20);
  font.writeUInt32BE(1, 24);
  font[28] = 0;
  return font;
}

describe('public content gate', () => {
  const rejected = [
    { name: 'a missing draft field', contents: '---\ntitle: Missing\n---\nBody', reason: 'missing explicit draft: false' },
    { name: 'draft: true', contents: '---\ndraft: true\n---\nBody', reason: 'draft must be the boolean false' },
    { name: 'a string false', contents: '---\ndraft: "false"\n---\nBody', reason: 'draft must be the boolean false' },
    { name: 'invalid YAML', contents: '---\ndraft: [false\n---\nBody', reason: 'invalid YAML frontmatter' },
    { name: 'missing frontmatter', contents: '# No frontmatter', reason: 'missing valid frontmatter block' },
    { name: 'a UTF-8 BOM before frontmatter', contents: '\uFEFF---\ndraft: false\n---\nBody', reason: 'UTF-8 BOM is not allowed before frontmatter' },
  ];

  for (const testCase of rejected) {
    it(`rejects ${testCase.name} and reports the file and reason`, () => {
      const result = runContentGate([{ path: 'unsafe.mdx', contents: testCase.contents }]);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('unsafe.mdx');
      expect(result.stderr).toContain(testCase.reason);
    });
  }

  it('accepts nested Markdown and MDX only when draft is explicitly boolean false', () => {
    const result = runContentGate([
      { path: 'public.md', contents: '---\ndraft: false # deliberately public\n---\nPublic' },
      { path: 'nested/public.mdx', contents: '---\ndraft: FALSE\n---\n# Public MDX' },
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
  });
});

describe('tracked public snapshot gate', () => {
  it('allows only regular stage-0 blob modes and rejects every other mode shape', () => {
    expect(isAllowedIndexBlobMode('100644')).toBe(true);
    expect(isAllowedIndexBlobMode('100755')).toBe(true);
    expect(isAllowedIndexBlobMode('120000')).toBe(false);
    expect(isAllowedIndexBlobMode('160000')).toBe(false);
    expect(isAllowedIndexBlobMode('100664')).toBe(false);
    expect(isAllowedIndexBlobMode('garbage')).toBe(false);
  });

  const sensitiveFixtures = [
    { name: 'an ordinary email', path: 'notes.txt', contents: `contact: writer${'@'}sample.org`, reason: 'email address' },
    { name: 'a GitHub token', path: 'config.txt', contents: `${'GITHUB_'}${'TOKEN'}=${'ghp_'}${'A'.repeat(36)}`, reason: 'GitHub token' },
    { name: 'a fine-grained GitHub token', path: 'config.txt', contents: `credential=${'github_'}${'pat_'}${'A'.repeat(32)}`, reason: 'GitHub token' },
    { name: 'an AWS access key', path: 'config.txt', contents: `key=${'AKIA'}${'A'.repeat(16)}`, reason: 'AWS access key' },
    {
      name: 'private key material',
      path: 'key.pem',
      contents: `-----BEGIN PRIVATE KEY-----\n${'A'.repeat(64)}\n-----END PRIVATE KEY-----`,
      reason: 'private key',
    },
    { name: 'a token assignment', path: 'config.txt', contents: `API_${'TOKEN'}=${'x'.repeat(24)}`, reason: 'token or secret assignment' },
    { name: 'a Windows user path', path: 'notes.txt', contents: 'C:\\Users\\sample-user\\Documents\\draft.md', reason: 'absolute user path' },
  ];

  for (const fixture of sensitiveFixtures) {
    it(`rejects ${fixture.name} from the real tracked snapshot`, () => {
      const result = runSnapshotGate([{ path: fixture.path, contents: fixture.contents }]);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(fixture.path);
      expect(result.stderr).toContain(fixture.reason);
      expect(result.stderr).not.toContain(fixture.contents);
    });
  }

  it('allows narrow documentation placeholders without ignoring the rest of README', () => {
    const safeReadme = [
      '# Security checklist',
      'Never commit email, token, secret, password, AWS credentials, or private keys.',
      'Contact placeholder: user@example.invalid',
      `${'GITHUB_'}${'TOKEN'}=<YOUR_GITHUB_TOKEN>`,
      'AWS_ACCESS_KEY_ID=<YOUR_AWS_ACCESS_KEY_ID>',
      `${'PRIVATE_'}${'KEY'}=<REDACTED>`,
      'Example path: <USER_HOME>/project',
    ].join('\n');
    const result = runSnapshotGate([{ path: 'README.md', contents: safeReadme }]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
  });

  it('still scans non-placeholder content elsewhere in a safe README', () => {
    const result = runSnapshotGate([
      { path: 'README.md', contents: `${'GITHUB_'}${'TOKEN'}=<YOUR_GITHUB_TOKEN>` },
      { path: 'src/config.txt', contents: `owner=writer${'@'}sample.org` },
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('src/config.txt');
  });

  it('reads the staged blob when an unsafe email was replaced by a safe worktree file', () => {
    const result = runSnapshotGate(
      [{ path: 'notes.txt', contents: `owner=writer${'@'}sample.org` }],
      [{ path: 'notes.txt', contents: 'owner=<PUBLIC_ALIAS>' }],
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('notes.txt');
    expect(result.stderr).toContain('email address');
  });

  it('reads staged post frontmatter when draft true was replaced by false in the worktree', () => {
    const result = runSnapshotGate(
      [{ path: 'src/content/posts/staged.md', contents: '---\ndraft: true\n---\nStaged draft' }],
      [{ path: 'src/content/posts/staged.md', contents: '---\ndraft: false\n---\nSafe worktree' }],
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('src/content/posts/staged.md');
    expect(result.stderr).toContain('draft must be the boolean false');
  });

  it('accepts a normal stage-0 snapshot with explicit public frontmatter', () => {
    const result = runSnapshotGate([
      { path: 'src/content/posts/public.mdx', contents: '---\ndraft: false\n---\n# Public' },
      { path: 'README.md', contents: 'Contact: user@example.invalid' },
    ]);

    expect(result.status, result.stderr).toBe(0);
  });

  it('fails closed when the index contains unresolved merge stages', () => {
    const result = runUnmergedSnapshotGate();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('conflict.txt');
    expect(result.stderr).toContain('unresolved index stages');
  });

  it.each(['../README.md', '.git/config'])(
    'rejects a staged symbolic link whose target is %s without reading through it',
    (target) => {
      const result = runIndexedModeGate('120000', target);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('public/leak');
      expect(result.stderr).toContain('unsupported git index mode 120000');
    },
  );

  it('rejects a staged gitlink before attempting to read its object as text', () => {
    const result = runIndexedModeGate('160000', 'nested repository placeholder');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('public/leak');
    expect(result.stderr).toContain('unsupported git index mode 160000');
  });

  it('accepts ordinary executable text stored as a regular 100755 blob', () => {
    const result = runExecutableTextGate();

    expect(result.status, result.stderr).toBe(0);
  });

  it('rejects a symbolic-link root in explicit directory fixture mode', () => {
    const result = runDirectoryRootSymlinkGate();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('symbolic links cannot be scanned in directory mode');
  });

  it('decodes and rejects an email in UTF-16LE text', () => {
    const contents = Buffer.from(`\uFEFFowner=writer${'@'}sample.org`, 'utf16le');
    const result = runSnapshotGate([{ path: 'notes.txt', contents }]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('notes.txt');
    expect(result.stderr).toContain('email address');
  });

  it('decodes and rejects an email in UTF-16BE text', () => {
    const result = runSnapshotGate([
      { path: 'notes.txt', contents: utf16BigEndian(`owner=writer${'@'}sample.org`) },
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('notes.txt');
    expect(result.stderr).toContain('email address');
  });

  it('fails closed on unexplained NUL bytes in a common text file', () => {
    const result = runSnapshotGate([
      { path: 'notes.txt', contents: Buffer.from('safe\0unreadable', 'utf8') },
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('notes.txt');
    expect(result.stderr).toContain('unexpected NUL byte');
  });

  it.each([
    { name: 'SOH', bytes: [0x01] },
    { name: 'ESC', bytes: [0x1b] },
    { name: 'DEL', bytes: [0x7f] },
    { name: 'a valid UTF-8 C1 control', bytes: [0xc2, 0x80] },
  ])('rejects $name control characters after strict text decoding', ({ bytes }) => {
    const result = runSnapshotGate([
      { path: 'notes.txt', contents: Buffer.concat([Buffer.from('safe'), Buffer.from(bytes)]) },
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('notes.txt');
    expect(result.stderr).toContain('forbidden control character');
  });

  it('accepts tabs, line feeds, carriage returns and valid UTF-8 Chinese text', () => {
    const result = runSnapshotGate([
      { path: 'docs/text.txt', contents: '标题\t公开\r\n正文\n下一行\r结尾' },
    ]);

    expect(result.status, result.stderr).toBe(0);
  });

  it('rejects a PNG blob even when it contains no sensitive pattern', () => {
    const result = runSnapshotGate([
      { path: 'public/logo.png', contents: Buffer.concat([pngSignature, Buffer.from([0x00, 0xff])]) },
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('binary, archive, or compressed content is not accepted');
  });

  it('rejects plain sensitive text renamed with a binary extension', () => {
    const result = runSnapshotGate([
      { path: 'public/not-an-image.png', contents: `owner=writer${'@'}sample.org` },
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('public/not-an-image.png');
    expect(result.stderr).toContain('email address');
  });

  it('scans printable UTF-8 bytes after a valid PNG signature', () => {
    const contents = Buffer.concat([
      pngSignature,
      Buffer.from(`\n作者 owner=writer${'@'}sample.org`, 'utf8'),
    ]);
    const result = runSnapshotGate([{ path: 'public/annotated.png', contents }]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('email address');
  });

  it('scans printable bytes after a valid PDF signature', () => {
    const result = runSnapshotGate([
      { path: 'public/annotated.pdf', contents: Buffer.from(`%PDF-1.7\nowner=writer${'@'}sample.org`, 'utf8') },
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('email address');
  });

  it('scans UTF-16LE sensitive text embedded in a confirmed binary', () => {
    const contents = Buffer.concat([
      pngSignature,
      Buffer.from(`owner=writer${'@'}sample.org`, 'utf16le'),
    ]);
    const result = runSnapshotGate([{ path: 'public/utf16le.png', contents }]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('email address');
  });

  it('scans UTF-16BE sensitive text embedded in a confirmed binary', () => {
    const contents = Buffer.concat([
      pngSignature,
      utf16BigEndian(`owner=writer${'@'}sample.org`),
    ]);
    const result = runSnapshotGate([{ path: 'public/utf16be.png', contents }]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('email address');
  });

  it('rejects real image, PDF and font magic instead of claiming those formats are safe', () => {
    const result = runSnapshotGate([
      { path: 'public/a.png', contents: pngSignature },
      { path: 'public/a.jpg', contents: Buffer.from([0xff, 0xd8, 0xff, 0xe0]) },
      { path: 'public/a.jpeg', contents: Buffer.from([0xff, 0xd8, 0xff, 0xe1]) },
      { path: 'public/a.gif', contents: Buffer.from('GIF89a', 'ascii') },
      { path: 'public/a.webp', contents: Buffer.concat([Buffer.from('RIFF', 'ascii'), Buffer.alloc(4), Buffer.from('WEBP', 'ascii')]) },
      { path: 'public/a.ico', contents: Buffer.from([0x00, 0x00, 0x01, 0x00]) },
      { path: 'public/a.pdf', contents: Buffer.from('%PDF-1.7', 'ascii') },
      { path: 'public/a.woff', contents: Buffer.from('wOFF', 'ascii') },
      { path: 'public/a.woff2', contents: Buffer.from('wOF2', 'ascii') },
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('binary, archive, or compressed content is not accepted');
  });

  it('rejects safe and visibly sensitive gzip blobs', () => {
    const gzip = Buffer.from([0x1f, 0x8b, 0x08, 0x00]);
    const result = runSnapshotGate([
      { path: 'public/safe.gz', contents: Buffer.concat([gzip, Buffer.from([0x00, 0x01, 0x02])]) },
      { path: 'public/unsafe.gz', contents: Buffer.concat([gzip, Buffer.from(`owner=writer${'@'}sample.org`, 'ascii')]) },
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('public/safe.gz');
    expect(result.stderr).toContain('public/unsafe.gz');
    expect(result.stderr).toContain('binary, archive, or compressed content is not accepted');
    expect(result.stderr).toContain('email address');
  });

  it('rejects populated and empty ZIP signatures without an allowlist ambiguity', () => {
    const result = runSnapshotGate([
      { path: 'public/data.zip', contents: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]) },
      { path: 'public/empty.zip', contents: Buffer.from([0x50, 0x4b, 0x05, 0x06, 0x00, 0x00]) },
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('public/data.zip');
    expect(result.stderr).toContain('public/empty.zip');
    expect(result.stderr).toContain('binary, archive, or compressed content is not accepted');
  });

  it('rejects real empty and non-empty Brotli streams staged with a .br extension', () => {
    const result = runSnapshotGate([
      { path: 'public/empty.br', contents: brotliCompressSync(Buffer.alloc(0)) },
      { path: 'public/content.br', contents: brotliCompressSync(Buffer.from('safe text', 'utf8')) },
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('public/empty.br');
    expect(result.stderr).toContain('public/content.br');
    expect(result.stderr).toContain('known dangerous extension');
  });

  it('rejects dangerous extensions case-insensitively even when bytes look like text', () => {
    const paths = [
      'public/a.GZIP', 'public/a.tar', 'public/a.tgz', 'public/a.bz2', 'public/a.xz',
      'public/a.7z', 'public/a.rar', 'public/a.zst', 'public/a.PDF', 'public/a.JPEG',
      'public/a.WOFF2', 'public/a.otf', 'public/a.wasm', 'public/archive.tar.GZ',
    ];
    const result = runSnapshotGate(paths.map((path) => ({ path, contents: 'plain UTF-8 text' })));

    expect(result.status).toBe(1);
    for (const path of paths) expect(result.stderr).toContain(path);
    expect(result.stderr).toContain('known dangerous extension');
  });

  it('rejects a valid image magic followed by compressed payload bytes', () => {
    const result = runSnapshotGate([
      {
        path: 'public/compressed.png',
        contents: Buffer.concat([pngSignature, Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0x00])]),
      },
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('binary, archive, or compressed content is not accepted');
  });

  it('continues to allow safe UTF-8 text and text SVG blobs', () => {
    const result = runSnapshotGate([
      { path: 'docs/note.txt', contents: '公开的纯文本说明' },
      { path: 'public/mark.svg', contents: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>' },
    ]);

    expect(result.status, result.stderr).toBe(0);
  });

  it('allows JSON true and ordinary text beginning with former font magic words', () => {
    const result = runSnapshotGate([
      { path: 'data/value.json', contents: 'true' },
      { path: 'docs/true-story.txt', contents: 'true stories are ordinary text' },
      { path: 'docs/otto.txt', contents: 'OTTO is ordinary text here' },
      { path: 'docs/woff.txt', contents: 'wOFF and wOF2 are ordinary words here' },
    ]);

    expect(result.status, result.stderr).toBe(0);
  });

  it('still rejects a structurally complete minimal TrueType sfnt header', () => {
    const result = runSnapshotGate([
      { path: 'public/font.dat', contents: minimalTrueTypeFont() },
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('binary, archive, or compressed content is not accepted');
  });

  it('scans sensitive patterns in the staged Git path itself', () => {
    const result = runSnapshotGate([
      { path: `docs/writer${'@'}sample.org-notes.txt`, contents: 'safe content' },
      { path: `docs/credential-${'ghp_'}${'A'.repeat(36)}.txt`, contents: 'safe content' },
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('sensitive file path');
    expect(result.stderr).toContain('email address');
    expect(result.stderr).toContain('GitHub token');
  });

  it('accepts a safe staged path containing spaces, punctuation and non-ASCII characters', () => {
    const result = runSnapshotGate([
      { path: '文章/安全 [v1] #.txt', contents: '公开内容' },
    ]);

    expect(result.status, result.stderr).toBe(0);
  });

  it.each([
    { name: 'C0', path: 'control-\u0001.txt', escaped: 'U+0001' },
    { name: 'TAB', path: 'control-\t.txt', escaped: 'U+0009' },
    { name: 'LF', path: 'control-\n.txt', escaped: 'U+000A' },
    { name: 'CR', path: 'control-\r.txt', escaped: 'U+000D' },
    { name: 'DEL', path: 'control-\u007f.txt', escaped: 'U+007F' },
    { name: 'C1', path: 'control-\u0085.txt', escaped: 'U+0085' },
  ])('rejects $name controls in staged Git paths without injecting them into logs', ({ path, escaped }) => {
    const result = runRawIndexedPathGate(path);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('index path contains forbidden control character');
    expect(result.stderr).toContain(escaped);
    expect(result.stderr).not.toContain(path);
  });

  it('accepts a raw staged Git path containing safe Chinese, spaces and punctuation', () => {
    const result = runRawIndexedPathGate('文章 安全 [v1] #.txt');

    expect(result.status, result.stderr).toBe(0);
  });
});
