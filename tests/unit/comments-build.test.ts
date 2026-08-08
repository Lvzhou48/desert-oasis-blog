import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const astroPackage = JSON.parse(readFileSync(resolve('node_modules/astro/package.json'), 'utf8'));
const astroCli = resolve('node_modules/astro', astroPackage.bin.astro);
const discussionsUrl = 'https://github.com/Lvzhou48/desert-oasis-blog/discussions';

function buildArticle(config: Partial<Record<string, string>>) {
  const output = mkdtempSync(join(tmpdir(), 'oasis-comments-dist-'));
  const env = {
    ...process.env,
    PUBLIC_GISCUS_REPO: '',
    PUBLIC_GISCUS_REPO_ID: '',
    PUBLIC_GISCUS_CATEGORY: '',
    PUBLIC_GISCUS_CATEGORY_ID: '',
    ...config,
  };
  const result = spawnSync(process.execPath, [astroCli, 'build', '--outDir', output], {
    encoding: 'utf8',
    env,
  });
  try {
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    return readFileSync(join(output, 'posts', 'first-oasis', 'index.html'), 'utf8');
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
}

function expectSafeFallback(html: string) {
  expect(html).toContain(`href="${discussionsUrl}"`);
  expect(html).toMatch(/rel="[^"]*noopener[^"]*"/);
  expect(html).toMatch(/rel="[^"]*noreferrer[^"]*"/);
}

describe('giscus build-time enhancement', { sequential: true }, () => {
  it.each([
    ['no configuration', {}],
    ['partial configuration', { PUBLIC_GISCUS_REPO: 'Lvzhou48/desert-oasis-blog' }],
    ['blank generated values', {
      PUBLIC_GISCUS_REPO: 'Lvzhou48/desert-oasis-blog',
      PUBLIC_GISCUS_REPO_ID: ' ',
      PUBLIC_GISCUS_CATEGORY: '\t',
      PUBLIC_GISCUS_CATEGORY_ID: ' ',
    }],
    ['wrong repository', {
      PUBLIC_GISCUS_REPO: 'attacker/wrong-repo',
      PUBLIC_GISCUS_REPO_ID: 'R_repo',
      PUBLIC_GISCUS_CATEGORY: 'Announcements',
      PUBLIC_GISCUS_CATEGORY_ID: 'D_category',
    }],
  ])('keeps the safe fallback and omits giscus for %s', (_label, config) => {
    const html = buildArticle(config);
    expect(html).toContain('评论将在 GitHub Discussions 配置后开放。');
    expectSafeFallback(html);
    expect(html).not.toContain('https://giscus.app/client.js');
  });

  it('loads giscus only for the complete fixed repository and keeps fallback usable', () => {
    const html = buildArticle({
      PUBLIC_GISCUS_REPO: 'Lvzhou48/desert-oasis-blog',
      PUBLIC_GISCUS_REPO_ID: 'R_repo',
      PUBLIC_GISCUS_CATEGORY: 'Announcements',
      PUBLIC_GISCUS_CATEGORY_ID: 'D_category',
    });

    expect(html).toContain('https://giscus.app/client.js');
    expect(html).toContain('data-repo="Lvzhou48/desert-oasis-blog"');
    expect(html).toContain('如果评论未能加载，可前往 GitHub Discussions 参与讨论。');
    expectSafeFallback(html);
  });
});
