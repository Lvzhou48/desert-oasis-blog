import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const checker = resolve('scripts/check-static-links.mjs');

function runLinkCheck(base: string, files: Array<{ path: string; contents: string }>) {
  const root = mkdtempSync(join(tmpdir(), 'oasis-links-'));
  for (const file of files) {
    const path = join(root, file.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.contents);
  }
  return spawnSync(process.execPath, [checker, '--dist', root, '--base', base], {
    encoding: 'utf8',
  });
}

describe('static internal link checker', () => {
  it('fails when the configured dist directory does not exist', () => {
    const missing = join(tmpdir(), `oasis-missing-dist-${process.pid}-${Date.now()}`);
    const result = spawnSync(process.execPath, [checker, '--dist', missing, '--base', '/'], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('dist directory does not exist');
  });

  it('fails when dist contains no HTML files', () => {
    const result = runLinkCheck('/', [{ path: 'assets/site.css', contents: 'body{}' }]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no HTML files');
  });

  it('fails when dist has HTML but no root index.html', () => {
    const result = runLinkCheck('/', [{ path: 'about/index.html', contents: '<h1>About</h1>' }]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('root index.html is missing');
  });

  it('accepts valid root-path links, relative links, assets and fragments', () => {
    const result = runLinkCheck('/', [
      { path: 'index.html', contents: '<a href="/articles/">Articles</a><link href="/assets/site.css"><a href="#top">Top</a>' },
      { path: 'articles/index.html', contents: '<a href="../about/">About</a><img src="/assets/logo.svg">' },
      { path: 'about/index.html', contents: '<h1>About</h1>' },
      { path: 'assets/site.css', contents: 'body{}' },
      { path: 'assets/logo.svg', contents: '<svg></svg>' },
    ]);

    expect(result.status, result.stderr).toBe(0);
  });

  it('maps Astro canonical /404/ to the generated root 404.html artifact', () => {
    const result = runLinkCheck('/', [
      { path: 'index.html', contents: '<h1>Home</h1>' },
      { path: '404.html', contents: '<link rel="canonical" href="https://lvzhou48.github.io/404/">' },
    ]);

    expect(result.status, result.stderr).toBe(0);
  });

  it('accepts valid project-base links without looking for the base inside dist', () => {
    const result = runLinkCheck('/desert-oasis-blog/', [
      { path: 'index.html', contents: '<a href="/desert-oasis-blog/articles/">Articles</a>' },
      { path: 'articles/index.html', contents: '<a href="/desert-oasis-blog/">Home</a>' },
    ]);

    expect(result.status, result.stderr).toBe(0);
  });

  it('rejects an absolute link that escapes the configured project base', () => {
    const result = runLinkCheck('/desert-oasis-blog/', [
      { path: 'index.html', contents: '<a href="/articles/">Escaped</a>' },
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('index.html');
    expect(result.stderr).toContain('outside configured base');
    expect(result.stderr).toContain('/articles/');
  });

  it('rejects a missing internal target for both HTML routes and static assets', () => {
    const result = runLinkCheck('/', [
      { path: 'index.html', contents: '<a href="/missing/">Missing</a><script src="/assets/missing.js"></script>' },
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('/missing/');
    expect(result.stderr).toContain('/assets/missing.js');
    expect(result.stderr).toContain('target not found');
  });

  it('ignores external protocols while still checking same-origin absolute URLs', () => {
    const result = runLinkCheck('/', [
      {
        path: 'index.html',
        contents: [
          '<a href="https://example.invalid/elsewhere">External</a>',
          '<a href="mailto:user@example.invalid">Mail</a>',
          '<a href="https://lvzhou48.github.io/about/">Same origin</a>',
        ].join(''),
      },
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('/about/');
    expect(result.stderr).not.toContain('example.invalid/elsewhere');
  });

  it('ignores href-like text in prose, escaped code, preformatted text, scripts and comments', () => {
    const result = runLinkCheck('/', [
      {
        path: 'index.html',
        contents: [
          '<p>Documentation says href="/missing/prose/" without creating a link.</p>',
          '<code>&lt;a href="/missing/code/"&gt;example&lt;/a&gt;</code>',
          '<pre>href=\'/missing/pre/\'</pre>',
          '<script>const example = \'href="/missing/script/"\';</script>',
          '<!-- <a href="/missing/comment/">commented out</a> -->',
        ].join(''),
      },
    ]);

    expect(result.status, result.stderr).toBe(0);
  });

  it('uses parsed HTML attributes with case, quote and entity semantics', () => {
    const result = runLinkCheck('/', [
      {
        path: 'index.html',
        contents: [
          '<A HREF=&#x2F;about&#x2F;>About</A>',
          '<IMG SRC="&#x2F;assets&#x2F;logo.svg">',
          '<img SRCSET="/assets/logo.svg 1x, /assets/logo-2.svg 2x">',
        ].join(''),
      },
      { path: 'about/index.html', contents: '<h1>About</h1>' },
      { path: 'assets/logo.svg', contents: '<svg></svg>' },
      { path: 'assets/logo-2.svg', contents: '<svg></svg>' },
    ]);

    expect(result.status, result.stderr).toBe(0);
  });

  it('honors the first HTML base href when resolving relative links', () => {
    const result = runLinkCheck('/', [
      {
        path: 'index.html',
        contents: '<base href="/docs/"><a href="guide/">Guide</a>',
      },
      { path: 'docs/index.html', contents: '<h1>Docs</h1>' },
      { path: 'docs/guide/index.html', contents: '<h1>Guide</h1>' },
    ]);

    expect(result.status, result.stderr).toBe(0);
  });

  it('checks a real unquoted srcset attribute instead of matching source text', () => {
    const result = runLinkCheck('/', [
      { path: 'index.html', contents: '<img SRCSET=/assets/missing.svg>' },
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('/assets/missing.svg');
    expect(result.stderr).toContain('target not found');
  });
});
