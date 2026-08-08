import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

function argumentValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function normalizeBase(value) {
  const trimmed = `/${String(value ?? '/').replace(/^\/+|\/+$/g, '')}/`;
  return trimmed === '//' ? '/' : trimmed;
}

function listHtmlFiles(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return listHtmlFiles(path);
    return entry.name.toLowerCase().endsWith('.html') ? [path] : [];
  });
}

function pagePath(file, root, base) {
  const path = relative(root, file).split(sep).join('/');
  const route = path === 'index.html' ? '' : path.replace(/(?:^|\/)index\.html$/, '/').replace(/\.html$/, '');
  return `${base}${route}`.replace(/\/{2,}/g, '/');
}

function urlsFromSrcset(value) {
  const urls = [];
  let position = 0;
  while (position < value.length) {
    while (position < value.length && /[\t\n\f\r ,]/.test(value[position])) position += 1;
    if (position >= value.length) break;

    const start = position;
    while (position < value.length && !/[\t\n\f\r ]/.test(value[position])) position += 1;
    let url = value.slice(start, position);
    const endedWithComma = url.endsWith(',');
    url = url.replace(/,+$/, '');
    if (url) urls.push(url);
    if (endedWithComma) continue;

    let parentheses = 0;
    while (position < value.length) {
      const character = value[position];
      position += 1;
      if (character === '(') parentheses += 1;
      else if (character === ')' && parentheses > 0) parentheses -= 1;
      else if (character === ',' && parentheses === 0) break;
    }
  }
  return urls;
}

function parsedHtmlReferences(html) {
  const document = parse(html);
  const references = [];
  let baseHref;

  function visit(node) {
    if (node.tagName && Array.isArray(node.attrs)) {
      const attributes = new Map(node.attrs.map(({ name, value }) => [name, value]));
      if (node.tagName === 'base' && baseHref === undefined && attributes.has('href')) {
        baseHref = attributes.get('href');
      }
      for (const attribute of ['href', 'src']) {
        if (attributes.has(attribute)) {
          references.push({ value: attributes.get(attribute), isBase: node.tagName === 'base' && attribute === 'href' });
        }
      }
      if (attributes.has('srcset')) {
        references.push(...urlsFromSrcset(attributes.get('srcset')).map((value) => ({ value, isBase: false })));
      }
    }
    for (const child of node.childNodes ?? []) visit(child);
  }

  visit(document);
  return { references, baseHref };
}

function targetCandidates(root, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return [];
  }
  const relativeTarget = decoded.replace(/^\/+/, '');
  if (relativeTarget === '') return [join(resolve(root), 'index.html')];
  if (decoded === '/404/') return [join(resolve(root), '404.html')];
  const exact = resolve(root, relativeTarget);
  if (!exact.startsWith(`${resolve(root)}${sep}`) && exact !== resolve(root)) return [];
  if (decoded.endsWith('/')) return [join(exact, 'index.html')];
  if (extname(decoded)) return [exact];
  return [exact, `${exact}.html`, join(exact, 'index.html')];
}

export function findBrokenStaticLinks({ root, base, site = 'https://lvzhou48.github.io' }) {
  const normalizedRoot = resolve(root);
  const normalizedBase = normalizeBase(base);
  const siteOrigin = new URL(site).origin;
  const violations = [];

  if (!existsSync(normalizedRoot)) {
    return [{ source: String(root), reference: '', reason: 'dist directory does not exist' }];
  }
  const htmlFiles = listHtmlFiles(normalizedRoot);
  if (htmlFiles.length === 0) {
    return [{ source: String(root), reference: '', reason: 'dist contains no HTML files' }];
  }
  if (!existsSync(join(normalizedRoot, 'index.html'))) {
    violations.push({ source: String(root), reference: '', reason: 'root index.html is missing' });
  }

  for (const file of htmlFiles) {
    const source = relative(normalizedRoot, file).split(sep).join('/');
    const sourceUrl = new URL(pagePath(file, normalizedRoot, normalizedBase), siteOrigin);
    const { references, baseHref } = parsedHtmlReferences(readFileSync(file, 'utf8'));
    let documentBase = sourceUrl;
    if (baseHref !== undefined) {
      try {
        documentBase = new URL(baseHref, sourceUrl);
      } catch {
        documentBase = sourceUrl;
      }
    }
    for (const { value: reference, isBase } of references) {
      if (!reference || reference.startsWith('#') || /^(?:mailto|tel|data|javascript):/i.test(reference)) continue;
      let target;
      try {
        target = new URL(reference, isBase ? sourceUrl : documentBase);
      } catch {
        violations.push({ source, reference, reason: 'invalid URL' });
        continue;
      }
      if (target.origin !== siteOrigin) continue;
      const inBase = normalizedBase === '/'
        || target.pathname === normalizedBase.slice(0, -1)
        || target.pathname.startsWith(normalizedBase);
      if (!inBase) {
        violations.push({ source, reference, reason: `outside configured base ${normalizedBase}` });
        continue;
      }
      const withoutBase = normalizedBase === '/' ? target.pathname : target.pathname.slice(normalizedBase.length - 1);
      const candidates = targetCandidates(normalizedRoot, withoutBase);
      if (!candidates.some((candidate) => existsSync(candidate) && statSync(candidate).isFile())) {
        violations.push({ source, reference, reason: 'target not found' });
      }
    }
  }
  return violations;
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  const root = argumentValue('--dist', 'dist');
  const base = argumentValue('--base', '/');
  const violations = findBrokenStaticLinks({ root, base });
  if (violations.length > 0) {
    console.error([
      `Static link check failed for ${violations.length} internal reference(s):`,
      ...violations.map(({ source, reference, reason }) => `- ${source}: ${reference} (${reason})`),
    ].join('\n'));
    process.exitCode = 1;
  }
}
