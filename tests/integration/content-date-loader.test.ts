import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const astroCli = resolve(dirname(require.resolve('astro')), '..', 'bin', 'astro.mjs');
const temporaryRoots: string[] = [];

function write(path: string, contents: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function createFixture(posts: Record<string, string>) {
  const root = mkdtempSync(resolve('tests', '.content-date-site-'));
  temporaryRoots.push(root);
  const loaderUrl = pathToFileURL(resolve('src/lib/content-loader.ts')).href;
  const dateUrl = pathToFileURL(resolve('src/lib/content-date.ts')).href;
  write(join(root, 'src', 'content.config.ts'), `
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { dateAwareGlob } from ${JSON.stringify(loaderUrl)};
import { parseContentDate } from ${JSON.stringify(dateUrl)};
const date = z.unknown().transform((value, context) => {
  try { return parseContentDate(value); }
  catch {
    context.addIssue({ code: 'custom', message: 'Expected valid YYYY-MM-DD or timezone-aware ISO datetime in years 1900-9999' });
    return z.NEVER;
  }
});
const posts = defineCollection({
  loader: dateAwareGlob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({ publishedAt: date, updatedAt: date.optional(), draft: z.boolean() }),
});
export const collections = { posts };
`);
  write(join(root, 'src', 'pages', 'data.json.ts'), `
import { getCollection } from 'astro:content';
export async function GET() {
  const posts = await getCollection('posts');
  return Response.json(Object.fromEntries(posts.map((post) => [post.id, {
    publishedAt: post.data.publishedAt.toISOString(),
    updatedAt: post.data.updatedAt?.toISOString(),
  }])));
}
`);
  for (const [name, frontmatter] of Object.entries(posts)) {
    write(join(root, 'src', 'content', 'posts', `${name}.md`), `---\n${frontmatter}\ndraft: false\n---\nBody\n`);
  }
  return root;
}

function buildFixture(root: string) {
  const dist = join(root, 'dist');
  const result = spawnSync(process.execPath, [astroCli, '--root', root, 'build', '--outDir', dist, '--force'], {
    encoding: 'utf8',
  });
  return { ...result, dist };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('real Astro content date loading', () => {
  it('preserves raw date semantics through aliases and explicit timestamp tags', () => {
    const root = createFixture({
      'alias-date': `date: &date 2026-08-08\npublishedAt: *date\nupdatedAt: !!timestamp 2026-08-09`,
      'tag-and-alias-datetime': `publishedAt: !!timestamp 2026-08-08\ntime: &time 2026-08-08T08:30:00+08:00\nupdatedAt: *time`,
      'quoted-direct': `publishedAt: '2026-08-08'\nupdatedAt: 2026-08-08T08:30:00+08:00`,
      'year-boundaries': `date: &date 1900-01-01\npublishedAt: *date\nupdatedAt: !!timestamp 9999-12-31`,
    });

    const result = buildFixture(root);
    expect(result.status, result.stderr || result.stdout).toBe(0);
    const data = JSON.parse(readFileSync(join(result.dist, 'data.json'), 'utf8'));
    expect(data).toEqual({
      'alias-date': {
        publishedAt: '2026-08-07T16:00:00.000Z',
        updatedAt: '2026-08-08T16:00:00.000Z',
      },
      'quoted-direct': {
        publishedAt: '2026-08-07T16:00:00.000Z',
        updatedAt: '2026-08-08T00:30:00.000Z',
      },
      'tag-and-alias-datetime': {
        publishedAt: '2026-08-07T16:00:00.000Z',
        updatedAt: '2026-08-08T00:30:00.000Z',
      },
      'year-boundaries': {
        publishedAt: '1899-12-31T16:00:00.000Z',
        updatedAt: '9999-12-30T16:00:00.000Z',
      },
    });
  }, 30_000);

  it.each([
    ['cyclic alias', `cycle: &cycle { next: *cycle }\npublishedAt: *cycle`],
    ['non-scalar alias', `object: &object { value: 2026-08-08 }\npublishedAt: *object`],
    ['invalid date-only scalar', `publishedAt: 2026-02-30`],
    ['invalid timezone publishedAt', `publishedAt: 2026-02-30T08:00:00+08:00`],
    ['invalid timezone updatedAt alias', `publishedAt: 2026-08-08\ntime: &time 2026-04-31T08:00:00+08:00\nupdatedAt: *time`],
    ['invalid explicit timestamp timezone', `publishedAt: !!timestamp 2026-02-30T08:00:00+08:00`],
    ['out-of-range year alias', `date: &date 0099-01-01\npublishedAt: *date`],
    ['out-of-range year explicit timestamp', `publishedAt: !!timestamp 1899-12-31`],
  ])('fails closed with a clear error for %s', (_name, frontmatter) => {
    const result = buildFixture(createFixture({ invalid: frontmatter }));
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('Expected valid YYYY-MM-DD or timezone-aware ISO datetime');
  }, 30_000);
});
