# “沙漠里的绿洲”个人博客 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建并验证一个由公开仓库 `Lvzhou48/desert-oasis-blog` 承载、通过 GitHub Pages 发布的“沙漠里的绿洲”独立个人博客，支持 Markdown 写作、分类与搜索、同仓库 giscus 评论和自动发布检查。

**Architecture:** Astro 在构建时从类型化内容集合读取 Markdown 文章并生成静态页面；纯函数负责文章过滤、排序、搜索索引和相邻文章计算，页面组件只负责展示。公开 GitHub 仓库同时承载源码、已确认文章、Pages 工作流与 Discussions；评论由独立 `Comments` 组件延迟加载 giscus，GitHub Actions 仅在公开内容检查、测试和生产构建通过后部署静态产物。

**Tech Stack:** Astro、TypeScript、Markdown/MDX、Vitest、Playwright、giscus、GitHub Actions、GitHub Pages

## Global Constraints

- 网站名称固定为“沙漠里的绿洲”。
- 首页代表句固定为“在喧嚣世界里，保留一小片生长。”
- 首页介绍固定为“记录数据工程与 AI，也记录生活、远方，以及那些尚未有答案的思考。”
- 初始分类固定为“数据工程和 AI”“生活与成长”“远方与见闻”“随想”。
- 不展示作者真实姓名、正脸、雇主或能够直接识别作者的信息。
- 第一版不实现自建账号、在线写作后台、简历作品集、邮件订阅、广告或用户追踪。
- 私人草稿只保存在 Git 忽略的 `drafts/` 目录或仓库之外，绝不提交到公开仓库。
- `draft: true` 只控制页面生成，不提供保密能力；发布检查发现 `src/content/posts/` 中存在草稿时必须失败。
- 无封面文章必须使用完整的纯排版卡片；评论失败不得阻断正文阅读。
- 日期显示使用 `Asia/Shanghai`，实现时不得依赖运行机器的本地时区。
- 所有公开页面必须支持键盘操作、减少动态效果设置和移动端布局。
- Node.js 固定使用 24 LTS；`.nvmrc` 和 GitHub Actions 必须使用同一主版本。
- 远端仓库固定为公开仓库 `Lvzhou48/desert-oasis-blog`，Pages 使用项目站点 `https://lvzhou48.github.io/desert-oasis-blog/`。
- giscus 固定使用同一仓库的 GitHub Discussions，不创建独立评论仓库。
- 首次推送前必须取得 GitHub `noreply` 隐私邮箱，并把已验证的工作快照整理为一个不继承旧历史的公开根提交。

---

## File Map

```text
.
├── .github/workflows/deploy.yml            # 检查、构建和 Pages 部署
├── astro.config.mjs                        # Astro、站点 URL、Pages base 配置
├── .nvmrc                                  # Node.js 24 LTS
├── package.json                            # 开发、测试、构建命令与依赖
├── playwright.config.ts                    # 浏览器验收配置
├── scripts/check-public-content.mjs        # 阻止草稿或敏感内容进入公开发布
├── tsconfig.json                           # TypeScript 严格配置
├── vitest.config.ts                        # 纯函数测试配置
├── public/
│   ├── favicon.svg                         # 抽象绿洲标志
│   └── robots.txt                          # 抓取策略
├── src/
│   ├── content.config.ts                   # 文章集合 schema
│   ├── content/posts/                      # Markdown 文章
│   ├── data/site.ts                        # 站点文案、导航与分类常量
│   ├── lib/posts.ts                        # 过滤、排序、搜索、相邻文章
│   ├── lib/format.ts                       # 上海时区日期与阅读时间格式
│   ├── styles/global.css                   # 设计令牌、排版、响应式与动效降级
│   ├── components/
│   │   ├── SiteHeader.astro                # 品牌、桌面导航、移动菜单
│   │   ├── SiteFooter.astro                # 页脚签名
│   │   ├── OasisMark.astro                 # 抽象绿洲 SVG
│   │   ├── Hero.astro                      # 首页首屏
│   │   ├── ArticleCard.astro               # 文章卡片
│   │   ├── ArticleCollection.astro         # 文章列表与搜索筛选
│   │   └── Comments.astro                  # giscus 与降级入口
│   ├── layouts/
│   │   ├── BaseLayout.astro                # HTML shell、SEO、全局样式
│   │   └── ArticleLayout.astro             # 正文、目录、前后篇与评论
│   └── pages/
│       ├── index.astro                     # 首页
│       ├── articles/index.astro            # 全部文章与搜索
│       ├── categories/index.astro          # 分类入口
│       ├── categories/[category].astro     # 单分类文章列表
│       ├── posts/[id].astro                # 文章详情
│       ├── about.astro                     # 关于页
│       ├── 404.astro                       # 迷失在沙漠
│       ├── rss.xml.ts                      # 仅公开文章的 RSS
│       └── search-index.json.ts            # 仅公开文章的搜索索引
└── tests/
    ├── unit/posts.test.ts                  # 内容领域逻辑
    ├── unit/format.test.ts                 # 日期与阅读时间
    └── e2e/blog.spec.ts                    # 页面、键盘、移动端与 404 验收
```

## Task 1: Project Foundation and Typed Content

**Files:**
- Create: `package.json`
- Create: `.nvmrc`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/data/site.ts`
- Create: `src/content.config.ts`
- Create: `src/content/posts/first-oasis.md`
- Create: `scripts/check-public-content.mjs`
- Create: `tests/unit/site.test.ts`
- Create: `tests/unit/public-content.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `siteConfig`, `NAV_ITEMS`, `CATEGORIES`, `Category`, Astro collection `posts`.
- Consumes: none.

- [ ] **Step 1: Add deterministic project commands and install dependencies**

Create `package.json` with scripts:

```json
{
  "name": "desert-oasis-blog",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24 <25" },
  "scripts": {
    "dev": "astro dev",
    "check": "astro check",
    "check:public": "node scripts/check-public-content.mjs",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "build": "astro check && astro build",
    "preview": "astro preview"
  }
}
```

Create `.nvmrc` with exactly:

```text
24
```

Run:

```bash
npm install astro@latest @astrojs/check@latest @astrojs/rss@latest @astrojs/sitemap@latest typescript@latest
npm install --save-dev vitest@latest @playwright/test@latest
npx playwright install chromium
```

Expected: `package-lock.json` records exact resolved versions and Chromium installs successfully.

- [ ] **Step 2: Write the failing site configuration test**

Create `tests/unit/site.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CATEGORIES, NAV_ITEMS, siteConfig } from '../../src/data/site';

describe('site configuration', () => {
  it('keeps the approved identity and taxonomy', () => {
    expect(siteConfig.name).toBe('沙漠里的绿洲');
    expect(siteConfig.tagline).toBe('在喧嚣世界里，保留一小片生长。');
    expect(CATEGORIES).toEqual(['数据工程和 AI', '生活与成长', '远方与见闻', '随想']);
    expect(NAV_ITEMS.map((item) => item.href)).toEqual(['/', '/articles/', '/categories/', '/about/']);
  });
});
```

- [ ] **Step 3: Run the test and verify the missing module failure**

Run: `npm test -- tests/unit/site.test.ts`

Expected: FAIL because `src/data/site.ts` does not exist.

- [ ] **Step 4: Implement immutable site configuration**

Create `src/data/site.ts`:

```ts
export const CATEGORIES = ['数据工程和 AI', '生活与成长', '远方与见闻', '随想'] as const;
export type Category = (typeof CATEGORIES)[number];

export const NAV_ITEMS = [
  { label: '首页', href: '/' },
  { label: '文章', href: '/articles/' },
  { label: '分类', href: '/categories/' },
  { label: '关于', href: '/about/' },
] as const;

export const siteConfig = {
  name: '沙漠里的绿洲',
  tagline: '在喧嚣世界里，保留一小片生长。',
  description: '记录数据工程与 AI，也记录生活、远方，以及那些尚未有答案的思考。',
  locale: 'zh-CN',
  timeZone: 'Asia/Shanghai',
} as const;
```

- [ ] **Step 5: Configure Astro, TypeScript, Vitest and Playwright**

Create `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://lvzhou48.github.io',
  base: process.env.BASE_PATH ?? '/',
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap()],
});
```

Create `tsconfig.json`:

```json
{ "extends": "astro/tsconfigs/strict" }
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['tests/unit/**/*.test.ts'] } });
```

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:4321', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1', port: 4321, reuseExistingServer: !process.env.CI },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

- [ ] **Step 6: Write the failing public-content safety test**

Create `tests/unit/public-content.test.ts`:

```ts
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('public content gate', () => {
  it('rejects Markdown files explicitly marked as drafts', () => {
    const root = mkdtempSync(join(tmpdir(), 'oasis-content-'));
    const posts = join(root, 'src', 'content', 'posts');
    mkdirSync(posts, { recursive: true });
    writeFileSync(join(posts, 'private.md'), '---\ndraft: true\n---\n私密');
    expect(() => execFileSync(process.execPath, [resolve('scripts/check-public-content.mjs')], { cwd: root }))
      .toThrow();
  });
});
```

- [ ] **Step 7: Verify the public-content test fails**

Run: `npm test -- tests/unit/public-content.test.ts`

Expected: FAIL because `scripts/check-public-content.mjs` does not exist.

- [ ] **Step 8: Implement the public-content gate and ignored draft workspace**

Create `scripts/check-public-content.mjs`:

```js
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function findDraftFiles(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return findDraftFiles(path);
    if (!['.md', '.mdx'].includes(extname(entry.name))) return [];
    const frontmatter = readFileSync(path, 'utf8').split('---', 3)[1] ?? '';
    return /^draft:\s*true\s*$/m.test(frontmatter) ? [path] : [];
  }).toSorted();
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  const drafts = findDraftFiles('src/content/posts');
  if (drafts.length) {
    console.error(`Refusing public release; draft files found:\n${drafts.join('\n')}`);
    process.exitCode = 1;
  }
}
```

Add `drafts/` to `.gitignore`. This directory is the only in-project location allowed for private draft material.

- [ ] **Step 9: Define the article schema and first public welcome article**

Create `src/content.config.ts` using this schema:

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { CATEGORIES } from './data/site';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: ({ image }) => z.object({
    title: z.string().min(1),
    description: z.string().min(20).max(180),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    category: z.enum(CATEGORIES),
    tags: z.array(z.string().min(1)).default([]),
    draft: z.boolean().default(true),
    cover: image().optional(),
    coverAlt: z.string().min(1).optional(),
  }).superRefine((data, ctx) => {
    if (data.cover && !data.coverAlt) {
      ctx.addIssue({ code: 'custom', path: ['coverAlt'], message: '封面存在时必须填写 coverAlt' });
    }
  }),
});

export const collections = { posts };
```

Create `first-oasis.md` with `draft: false`, category `随想`, title “绿洲的第一粒种子”, and a short public welcome note derived only from the approved blog purpose. Do not include a name, employer, email, private draft, or unapproved personal experience.

- [ ] **Step 10: Run foundation verification**

Run:

```bash
npm test -- tests/unit/site.test.ts
npm test -- tests/unit/public-content.test.ts
npm run check
npm run check:public
```

Expected: both unit tests PASS, Astro reports zero errors, and public-content gate exits 0.

- [ ] **Step 11: Commit the foundation**

```bash
git add .gitignore package.json package-lock.json .nvmrc astro.config.mjs tsconfig.json vitest.config.ts playwright.config.ts scripts/check-public-content.mjs src/data/site.ts src/content.config.ts src/content/posts/first-oasis.md tests/unit/site.test.ts tests/unit/public-content.test.ts
git commit -m "chore: scaffold typed Astro blog"
```

## Task 2: Article Domain Logic

**Files:**
- Create: `src/lib/posts.ts`
- Create: `src/lib/format.ts`
- Create: `tests/unit/posts.test.ts`
- Create: `tests/unit/format.test.ts`

**Interfaces:**
- Consumes: `Category`, `CollectionEntry<'posts'>`.
- Produces: `getPublishedPosts(posts, now)`, `getPostsByCategory(posts, category)`, `getAdjacentPosts(posts, id)`, `toSearchRecord(post)`, `formatPublishedDate(date)`, `estimateReadingMinutes(body)`.

- [ ] **Step 1: Write failing filtering, ordering and adjacency tests**

Create lightweight typed fixtures in `tests/unit/posts.test.ts` and assert:

```ts
expect(getPublishedPosts([draft, future, older, newer], now).map((post) => post.id))
  .toEqual(['newer', 'older']);
expect(getPostsByCategory([newer, older], '数据工程和 AI')).toEqual([newer]);
expect(getAdjacentPosts([newer, older], 'newer')).toEqual({ previous: older, next: undefined });
expect(toSearchRecord(newer)).toMatchObject({
  id: 'newer',
  title: newer.data.title,
  category: '数据工程和 AI',
});
```

- [ ] **Step 2: Verify domain tests fail**

Run: `npm test -- tests/unit/posts.test.ts`

Expected: FAIL because `src/lib/posts.ts` does not exist.

- [ ] **Step 3: Implement article domain functions**

Implement `src/lib/posts.ts` with these signatures and rules:

```ts
import type { CollectionEntry } from 'astro:content';
import type { Category } from '../data/site';

export type Post = CollectionEntry<'posts'>;

export function getPublishedPosts(posts: Post[], now = new Date()): Post[] {
  return posts
    .filter((post) => !post.data.draft && post.data.publishedAt <= now)
    .toSorted((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());
}

export function getPostsByCategory(posts: Post[], category: Category): Post[] {
  return posts.filter((post) => post.data.category === category);
}

export function getAdjacentPosts(posts: Post[], id: string) {
  const index = posts.findIndex((post) => post.id === id);
  if (index < 0) return { previous: undefined, next: undefined };
  return { previous: posts[index + 1], next: posts[index - 1] };
}

export function toSearchRecord(post: Post) {
  return {
    id: post.id,
    title: post.data.title,
    description: post.data.description,
    category: post.data.category,
    tags: post.data.tags,
    publishedAt: post.data.publishedAt.toISOString(),
    href: `/posts/${post.id}/`,
  };
}
```

- [ ] **Step 4: Write failing date and reading-time tests**

Create `tests/unit/format.test.ts`:

```ts
expect(formatPublishedDate(new Date('2026-08-07T16:30:00.000Z'))).toBe('2026年8月8日');
expect(estimateReadingMinutes('中'.repeat(800))).toBe(2);
expect(estimateReadingMinutes('')).toBe(1);
```

- [ ] **Step 5: Verify format tests fail, then implement**

Run: `npm test -- tests/unit/format.test.ts`

Expected: FAIL because `src/lib/format.ts` does not exist.

Implement `src/lib/format.ts`:

```ts
const zhDate = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export function formatPublishedDate(date: Date): string {
  return zhDate.format(date);
}

export function estimateReadingMinutes(body: string): number {
  return Math.max(1, Math.ceil(body.replace(/\s/g, '').length / 400));
}
```

- [ ] **Step 6: Run domain verification**

Run: `npm test -- tests/unit/posts.test.ts tests/unit/format.test.ts`

Expected: all tests PASS.

- [ ] **Step 7: Commit domain logic**

```bash
git add src/lib/posts.ts src/lib/format.ts tests/unit/posts.test.ts tests/unit/format.test.ts
git commit -m "feat: add article domain logic"
```

## Task 3: Visual System and Shared Page Shell

**Files:**
- Create: `public/favicon.svg`
- Create: `src/styles/global.css`
- Create: `src/components/OasisMark.astro`
- Create: `src/components/SiteHeader.astro`
- Create: `src/components/SiteFooter.astro`
- Create: `src/layouts/BaseLayout.astro`
- Create: `src/pages/index.astro`
- Create: `tests/e2e/blog.spec.ts`

**Interfaces:**
- Consumes: `siteConfig`, `NAV_ITEMS`.
- Produces: `BaseLayout` props `{ title: string; description?: string; image?: string }`, shared `SiteHeader`, `SiteFooter`, `OasisMark`.

- [ ] **Step 1: Write the failing shell and mobile-navigation test**

Create `tests/e2e/blog.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('shared shell exposes the approved identity and keyboard navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/沙漠里的绿洲/);
  await expect(page.getByRole('link', { name: '沙漠里的绿洲' })).toBeVisible();
  await expect(page.getByRole('navigation')).toContainText('文章');
});

test('mobile menu can be opened with the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: '打开导航' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('link', { name: '分类' })).toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});
```

- [ ] **Step 2: Run the test and verify the page is missing**

Run: `npm run test:e2e -- --grep "shared shell|mobile menu"`

Expected: FAIL because the homepage and shared shell do not exist.

- [ ] **Step 3: Implement design tokens and accessible shell**

In `global.css`, start with these exact tokens:

```css
:root {
  --sand: #eadbbd;
  --paper: #f6f0e4;
  --forest: #496f55;
  --forest-deep: #173b31;
  --earth-gold: #a98247;
  --ink: #21372d;
  --muted: #66756c;
  --border: #d8cdb8;
  --shadow: 0 18px 48px rgb(23 59 49 / 14%);
  --font-serif: Georgia, 'Noto Serif SC', 'Songti SC', serif;
  --font-sans: Inter, 'Microsoft YaHei', system-ui, sans-serif;
}
*:focus-visible { outline: 3px solid var(--earth-gold); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
```

Add readable article line height, no horizontal overflow, and breakpoints at `48rem` and `72rem`. Do not load remote fonts in the first version.

Implement semantic SVG in `OasisMark.astro` with `aria-hidden="true"` when decorative. `SiteHeader` uses this contract:

```html
<button type="button" aria-expanded="false" aria-controls="site-menu" aria-label="打开导航">菜单</button>
<nav id="site-menu" aria-label="主导航">...</nav>
```

Its inline module toggles `aria-expanded`, updates the label between “打开导航” and “关闭导航”, closes on Escape, and closes after a menu link click. `BaseLayout` computes:

```ts
const canonical = new URL(Astro.url.pathname, Astro.site);
const pageTitle = title === siteConfig.name ? title : `${title} · ${siteConfig.name}`;
```

It renders canonical URL, description, Open Graph tags and one `<main id="main-content">` target preceded by `<a href="#main-content" class="skip-link">跳到正文</a>`.

- [ ] **Step 4: Add the minimal homepage shell**

Create `index.astro` using:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { siteConfig } from '../data/site';
---
<BaseLayout title={siteConfig.name} description={siteConfig.description}>
  <h1>{siteConfig.tagline}</h1>
</BaseLayout>
```

- [ ] **Step 5: Run shell verification**

Run:

```bash
npm run check
npm run test:e2e -- --grep "shared shell|mobile menu"
```

Expected: Astro check passes and both shell tests PASS.

- [ ] **Step 6: Commit shared shell**

```bash
git add public/favicon.svg src/styles/global.css src/components/OasisMark.astro src/components/SiteHeader.astro src/components/SiteFooter.astro src/layouts/BaseLayout.astro src/pages/index.astro tests/e2e/blog.spec.ts
git commit -m "feat: add oasis visual system and page shell"
```

## Task 4: Homepage and Article Cards

**Files:**
- Create: `src/components/Hero.astro`
- Create: `src/components/ArticleCard.astro`
- Modify: `src/pages/index.astro`
- Modify: `src/styles/global.css`
- Modify: `tests/e2e/blog.spec.ts`

**Interfaces:**
- Consumes: `siteConfig`, `getPublishedPosts`, `CollectionEntry<'posts'>`.
- Produces: `ArticleCard` props `{ post: CollectionEntry<'posts'>; featured?: boolean }`, finished homepage.

- [ ] **Step 1: Write the failing homepage test against the approved public welcome article**

The Task 1 welcome article is already public and titled “绿洲的第一粒种子”. Add:

```ts
test('homepage leads with identity and latest writing', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('在喧嚣世界里，保留一小片生长。');
  await expect(page.getByText('记录数据工程与 AI，也记录生活、远方，以及那些尚未有答案的思考。')).toBeVisible();
  await expect(page.getByRole('heading', { name: '最新文章' })).toBeVisible();
  await expect(page.getByRole('link', { name: /绿洲的第一粒种子/ })).toBeVisible();
});
```

- [ ] **Step 2: Verify homepage test fails**

Run: `npm run test:e2e -- --grep "homepage leads"`

Expected: FAIL because the article list is not rendered.

- [ ] **Step 3: Implement Hero and ArticleCard**

`Hero.astro` renders `DESERT · OASIS · NOTES`, the approved tagline, approved description, `<a href="#latest-writing">向下阅读</a>` and `OasisMark`. `ArticleCard.astro` accepts:

```ts
interface Props {
  post: CollectionEntry<'posts'>;
  featured?: boolean;
}
```

It renders category, linked title, summary, `formatPublishedDate(post.data.publishedAt)` and `estimateReadingMinutes(post.body ?? '')`. When `cover` exists, render Astro's `<Image>` with `alt={post.data.coverAlt}`; otherwise render `<div class="article-card__oasis" aria-hidden="true"></div>` and never an empty `<img>`.

- [ ] **Step 4: Complete the homepage composition**

Use this homepage data flow:

```astro
---
const posts = getPublishedPosts(await getCollection('posts')).slice(0, 6);
const [featured, ...morePosts] = posts;
---
<Hero />
<section id="latest-writing" aria-labelledby="latest-title">
  <h2 id="latest-title">最新文章</h2>
  {featured ? <ArticleCard post={featured} featured /> : <p>绿洲正在生长，第一篇文章很快抵达。</p>}
  {morePosts.map((post) => <ArticleCard post={post} />)}
  <a href="/articles/">查看全部文章</a>
</section>
```

- [ ] **Step 5: Run homepage verification**

Run:

```bash
npm run check
npm run test:e2e -- --grep "homepage leads"
```

Expected: checks pass and homepage test PASS.

- [ ] **Step 6: Commit homepage**

```bash
git add src/components/Hero.astro src/components/ArticleCard.astro src/pages/index.astro src/styles/global.css tests/e2e/blog.spec.ts
git commit -m "feat: build editorial oasis homepage"
```

## Task 5: Article Discovery, Categories and Search

**Files:**
- Create: `src/components/ArticleCollection.astro`
- Create: `src/pages/articles/index.astro`
- Create: `src/pages/categories/index.astro`
- Create: `src/pages/categories/[category].astro`
- Create: `src/pages/search-index.json.ts`
- Create: `src/content/posts/data-engineering-and-ai.md`
- Modify: `tests/e2e/blog.spec.ts`

**Interfaces:**
- Consumes: `CATEGORIES`, `getPublishedPosts`, `getPostsByCategory`, `toSearchRecord`, `ArticleCard`.
- Produces: static category routes, JSON search records, filter UI with query parameters `q`, `category`, `tag`.

- [ ] **Step 1: Add a second public article and failing discovery tests**

Create a concise public sample article titled “从数据仓库到智能系统” in category `数据工程和 AI` with tags `数据工程` and `AI`. Add tests:

```ts
test('articles can be searched and reset', async ({ page }) => {
  await page.goto('/articles/');
  await page.getByRole('searchbox', { name: '搜索文章' }).fill('智能系统');
  await expect(page.getByRole('link', { name: /从数据仓库到智能系统/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /绿洲的第一粒种子/ })).toBeHidden();
  await page.getByRole('button', { name: '清除筛选' }).click();
  await expect(page.getByRole('link', { name: /绿洲的第一粒种子/ })).toBeVisible();
});

test('category pages only show matching posts', async ({ page }) => {
  await page.goto('/categories/数据工程和%20AI/');
  await expect(page.getByRole('link', { name: /从数据仓库到智能系统/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /绿洲的第一粒种子/ })).toHaveCount(0);
});
```

- [ ] **Step 2: Verify discovery tests fail**

Run: `npm run test:e2e -- --grep "searched|category pages"`

Expected: FAIL with missing `/articles/` and category routes.

- [ ] **Step 3: Implement search index and collection UI**

Create `search-index.json.ts`:

```ts
import { getCollection } from 'astro:content';
import { getPublishedPosts, toSearchRecord } from '../lib/posts';

export async function GET() {
  const records = getPublishedPosts(await getCollection('posts')).map(toSearchRecord);
  return new Response(JSON.stringify(records), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
```

`ArticleCollection.astro` server-renders all passed articles for no-JavaScript usability. Each article wrapper must carry normalized `data-title`, `data-description`, `data-category`, and `data-tags` attributes. Add a progressive-enhancement module with this filtering core:

```js
const form = document.querySelector('[data-article-filters]');
const cards = [...document.querySelectorAll('[data-article-card]')];
const count = document.querySelector('[data-result-count]');
const normalize = (value) => value.trim().toLocaleLowerCase('zh-CN');

function applyFilters() {
  const data = new FormData(form);
  const query = normalize(String(data.get('q') ?? ''));
  const category = String(data.get('category') ?? '');
  let visible = 0;
  for (const card of cards) {
    const haystack = normalize(`${card.dataset.title} ${card.dataset.description} ${card.dataset.tags}`);
    const matches = (!query || haystack.includes(query)) && (!category || card.dataset.category === category);
    card.hidden = !matches;
    if (matches) visible += 1;
  }
  count.textContent = `${visible} 篇文章`;
}
```

Read initial URL parameters on load. On input/change call `applyFilters()`. “清除筛选” must call `form.reset()`, `history.replaceState({}, '', location.pathname)`, and `applyFilters()`.

- [ ] **Step 4: Implement articles and category routes**

`articles/index.astro` renders `<input type="search" aria-label="搜索文章" name="q">`, a category `<select>`, tag controls and results. `categories/index.astro` renders four category cards and public article counts. `[category].astro` defines routes exactly as:

```ts
export function getStaticPaths() {
  return CATEGORIES.map((category) => ({ params: { category }, props: { category } }));
}
```

The page receives a typed `Category` prop and renders `getPostsByCategory(publicPosts, category)`.

- [ ] **Step 5: Run discovery verification**

Run:

```bash
npm run check
npm run test:e2e -- --grep "searched|category pages"
```

Expected: checks pass and both discovery tests PASS.

- [ ] **Step 6: Commit discovery pages**

```bash
git add src/components/ArticleCollection.astro src/pages/articles/index.astro src/pages/categories/index.astro src/pages/categories/[category].astro src/pages/search-index.json.ts src/content/posts/data-engineering-and-ai.md tests/e2e/blog.spec.ts
git commit -m "feat: add article search and categories"
```

## Task 6: Article Detail, Navigation and GitHub Comments

**Files:**
- Create: `src/components/Comments.astro`
- Create: `src/layouts/ArticleLayout.astro`
- Create: `src/pages/posts/[id].astro`
- Modify: `tests/e2e/blog.spec.ts`

**Interfaces:**
- Consumes: `getPublishedPosts`, `getAdjacentPosts`, `formatPublishedDate`, `estimateReadingMinutes`.
- Produces: static article detail routes and `Comments` props `{ discussionUrl?: string }`; reads optional public env values `PUBLIC_GISCUS_REPO`, `PUBLIC_GISCUS_REPO_ID`, `PUBLIC_GISCUS_CATEGORY`, `PUBLIC_GISCUS_CATEGORY_ID`.

- [ ] **Step 1: Write failing article and comments-fallback tests**

```ts
test('article detail includes metadata, navigation and readable fallback comments', async ({ page }) => {
  await page.goto('/posts/data-engineering-and-ai/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('从数据仓库到智能系统');
  await expect(page.getByText('数据工程和 AI')).toBeVisible();
  await expect(page.getByRole('navigation', { name: '相邻文章' })).toBeVisible();
  await expect(page.getByText('评论将在 GitHub Discussions 配置后开放。')).toBeVisible();
});
```

- [ ] **Step 2: Verify article test fails**

Run: `npm run test:e2e -- --grep "article detail"`

Expected: FAIL because the detail route does not exist.

- [ ] **Step 3: Implement ArticleLayout and detail routes**

`[id].astro` creates only public paths and renders Markdown with this data flow:

```astro
---
export async function getStaticPaths() {
  const posts = getPublishedPosts(await getCollection('posts'));
  return posts.map((post) => ({ params: { id: post.id }, props: { post, posts } }));
}
const { post, posts } = Astro.props;
const { Content, headings } = await render(post);
const adjacent = getAdjacentPosts(posts, post.id);
---
<ArticleLayout post={post} headings={headings} adjacent={adjacent}>
  <Content />
</ArticleLayout>
```

`ArticleLayout` displays title, summary, date, optional update date, category, tags, reading time, generated headings, article body and an `aria-label="相邻文章"` navigation. Previous/next links come exclusively from the filtered public array.

- [ ] **Step 4: Implement giscus as an isolated enhancement**

Implement `Comments.astro` so giscus is isolated and optional:

```astro
---
interface Props { discussionUrl?: string }
const { discussionUrl } = Astro.props;
const repo = import.meta.env.PUBLIC_GISCUS_REPO;
const repoId = import.meta.env.PUBLIC_GISCUS_REPO_ID;
const category = import.meta.env.PUBLIC_GISCUS_CATEGORY;
const categoryId = import.meta.env.PUBLIC_GISCUS_CATEGORY_ID;
const enabled = Boolean(repo && repoId && category && categoryId);
---
<section aria-labelledby="comments-title" class="comments">
  <h2 id="comments-title">留言</h2>
  {enabled ? (
    <script is:inline
      src="https://giscus.app/client.js"
      data-repo={repo}
      data-repo-id={repoId}
      data-category={category}
      data-category-id={categoryId}
      data-mapping="pathname"
      data-strict="1"
      data-reactions-enabled="1"
      data-emit-metadata="0"
      data-input-position="bottom"
      data-theme="noborder_light"
      data-lang="zh-CN"
      data-loading="lazy"
      crossorigin="anonymous"
      async></script>
  ) : (
    <p>
      评论将在 GitHub Discussions 配置后开放。
      {discussionUrl && <a href={discussionUrl}>前往 Discussions</a>}
    </p>
  )}
</section>
```

The article must not import or depend on giscus JavaScript outside this component.

- [ ] **Step 5: Run detail verification**

Run:

```bash
npm run check
npm run test:e2e -- --grep "article detail"
```

Expected: checks pass and detail test PASS.

- [ ] **Step 6: Commit article experience**

```bash
git add src/components/Comments.astro src/layouts/ArticleLayout.astro src/pages/posts/[id].astro tests/e2e/blog.spec.ts
git commit -m "feat: add article reading and comments experience"
```

## Task 7: About, 404, RSS, Robots and Draft Exclusion

**Files:**
- Create: `src/pages/about.astro`
- Create: `src/pages/404.astro`
- Create: `src/pages/rss.xml.ts`
- Create: `public/robots.txt`
- Modify: `tests/e2e/blog.spec.ts`

**Interfaces:**
- Consumes: `siteConfig`, `getPublishedPosts`.
- Produces: about page, custom 404, public-only RSS, robots policy.

- [ ] **Step 1: Add failing supporting-page and draft-leak tests**

```ts
test('about and 404 preserve the mysterious oasis identity', async ({ page }) => {
  await page.goto('/about/');
  await expect(page.getByRole('heading', { name: '关于这片绿洲' })).toBeVisible();
  await expect(page.getByText('Lvzhou48')).toHaveCount(0);
  await page.goto('/missing-place/');
  await expect(page.getByRole('heading', { name: '你似乎迷失在沙漠里' })).toBeVisible();
  await expect(page.getByRole('link', { name: '返回绿洲' })).toBeVisible();
});

test('RSS contains public posts and excludes drafts', async ({ request }) => {
  const response = await request.get('/rss.xml');
  const xml = await response.text();
  expect(xml).toContain('从数据仓库到智能系统');
  expect(xml).not.toContain('草稿');
});
```

- [ ] **Step 2: Verify supporting-page tests fail**

Run: `npm run test:e2e -- --grep "about and 404|RSS contains"`

Expected: FAIL because pages and RSS do not exist.

- [ ] **Step 3: Implement about and 404 pages**

The about page explains the blog name, the four writing themes and the collaboration-based publishing process without naming the author. The 404 page uses `OasisMark`, the exact heading in the test, and links to `/` and `/articles/`.

- [ ] **Step 4: Implement RSS and crawl policy**

Create `src/pages/rss.xml.ts`:

```ts
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { getPublishedPosts } from '../lib/posts';
import { siteConfig } from '../data/site';

export async function GET(context: { site?: URL }) {
  const posts = getPublishedPosts(await getCollection('posts'));
  return rss({
    title: siteConfig.name,
    description: siteConfig.description,
    site: context.site ?? new URL('https://lvzhou48.github.io/desert-oasis-blog/'),
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.publishedAt,
      link: `posts/${post.id}/`,
    })),
  });
}
```

Create `public/robots.txt`:

```text
User-agent: *
Allow: /
Sitemap: https://lvzhou48.github.io/desert-oasis-blog/sitemap-index.xml
```

- [ ] **Step 5: Run supporting-page verification**

Run:

```bash
npm run build
npm run test:e2e -- --grep "about and 404|RSS contains"
```

Expected: production build succeeds and supporting tests PASS.

- [ ] **Step 6: Commit supporting pages**

```bash
git add src/pages/about.astro src/pages/404.astro src/pages/rss.xml.ts public/robots.txt tests/e2e/blog.spec.ts
git commit -m "feat: add supporting pages and public feeds"
```

## Task 8: Deployment Pipeline and Release Documentation

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `README.md`
- Modify: `astro.config.mjs`
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `tests/unit/workflow.test.ts`

**Interfaces:**
- Consumes: `npm run check`, `npm test`, `npm run build`, GitHub Pages environment.
- Produces: deployable `dist/`, Pages URL output, documented authoring and giscus configuration workflow.

- [ ] **Step 1: Write a failing workflow contract test**

Create `tests/unit/workflow.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('GitHub Pages workflow', () => {
  it('checks before it deploys', () => {
    const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
expect(workflow).toContain('npm run check');
expect(workflow).toContain('npm run check:public');
expect(workflow).toContain('npm test');
expect(workflow).toContain('npm run build');
expect(workflow).toContain('actions/upload-pages-artifact');
expect(workflow).toContain('actions/deploy-pages');
expect(workflow).toContain('needs: build');
  });
});
```

- [ ] **Step 2: Verify workflow test fails**

Run: `npm test -- tests/unit/workflow.test.ts`

Expected: FAIL because `.github/workflows/deploy.yml` does not exist.

- [ ] **Step 3: Implement protected Pages deployment**

Create `.github/workflows/deploy.yml`:

```yaml
name: Verify and deploy Pages
on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v5
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run check
      - run: npm run check:public
      - run: npm test
      - run: npm run build
        env:
          SITE_URL: https://lvzhou48.github.io
          BASE_PATH: /desert-oasis-blog
          PUBLIC_GISCUS_REPO: ${{ vars.PUBLIC_GISCUS_REPO }}
          PUBLIC_GISCUS_REPO_ID: ${{ vars.PUBLIC_GISCUS_REPO_ID }}
          PUBLIC_GISCUS_CATEGORY: ${{ vars.PUBLIC_GISCUS_CATEGORY }}
          PUBLIC_GISCUS_CATEGORY_ID: ${{ vars.PUBLIC_GISCUS_CATEGORY_ID }}
      - uses: actions/upload-pages-artifact@v4
        if: github.event_name != 'pull_request'
        with:
          path: dist
  deploy:
    if: github.event_name != 'pull_request'
    needs: build
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

The workflow reads Node major `24` from the `.nvmrc` created in Task 1. Pull requests run checks and build but never upload or deploy.

- [ ] **Step 4: Document the writing and publication runbook**

`README.md` must include:

1. Local commands and required Node major.
2. Exact article frontmatter example matching the schema.
3. Draft-to-public workflow with author confirmation before `draft: false`.
4. Public repository `Lvzhou48/desert-oasis-blog`, GitHub Pages project-site settings, and the initial URL `https://lvzhou48.github.io/desert-oasis-blog/`.
5. How to enable Discussions in the same repository, install giscus, obtain its four generated values, and set them as repository Actions variables.
6. How to bind and verify a custom domain later.
7. Privacy rule: keep private drafts under ignored `drafts/` or outside the repository; never commit private drafts, email addresses, secrets or identifying profile data.
8. Explain that `draft: true` does not hide a file in a public repository and that `npm run check:public` is mandatory before every push.

- [ ] **Step 5: Run workflow and production verification**

Run:

```bash
npm test -- tests/unit/workflow.test.ts
npm run check
npm run check:public
npm test
npm run build
```

Expected: all commands exit 0 and `dist/` contains `index.html`, article/category pages, `404.html`, `rss.xml`, `search-index.json`, and sitemap output.

- [ ] **Step 6: Commit deployment pipeline**

```bash
git add .github/workflows/deploy.yml README.md astro.config.mjs package.json package-lock.json .gitignore tests/unit/workflow.test.ts
git commit -m "ci: add verified GitHub Pages deployment"
```

## Task 9: Final Responsive, Accessibility and Release Verification

**Files:**
- Modify: `tests/e2e/blog.spec.ts`
- Modify: `src/styles/global.css`
- Modify: any directly implicated component when a failing test exposes a defect

**Interfaces:**
- Consumes: all public routes and components.
- Produces: verified first release candidate; no new product feature.

- [ ] **Step 1: Add final route and responsive regression coverage**

Add a route matrix for `/`, `/articles/`, `/categories/`, `/about/`, and both public article routes. For each route assert one visible `<h1>`, visible skip-link after keyboard focus, no horizontal overflow at `390×844`, and no console errors. Add a reduced-motion context and assert animated decorative elements use zero-duration or no animation.

- [ ] **Step 2: Run the new suite and capture every failure**

Run: `npm run test:e2e`

Expected: the new assertions may fail; record exact failing route and selector before changing implementation.

- [ ] **Step 3: Make only evidence-driven accessibility and responsive fixes**

For each failure, change only the component or CSS rule named by the failing test. Do not add new sections, analytics, subscriptions, personal details or motion effects during this task.

- [ ] **Step 4: Run the complete verification gate**

Run:

```bash
npm run check
npm run check:public
npm test
npm run build
npm run test:e2e
git diff --check
```

Expected: every command exits 0, all unit and browser tests pass, and Git reports no whitespace errors.

- [ ] **Step 5: Inspect the generated site manually**

Run `npm run preview -- --host 127.0.0.1`, then inspect desktop `1440×900` and mobile `390×844` screenshots for homepage, article list, a detail page, category page and 404. Confirm colors match the approved sand/forest palette, text is not clipped, cards work without cover images, and no personal identity is exposed.

- [ ] **Step 6: Commit release hardening**

```bash
git add tests/e2e/blog.spec.ts src/styles/global.css src/components src/layouts src/pages
git commit -m "test: verify responsive blog release"
```

- [ ] **Step 7: Report external publication gate**

Before pushing or enabling Pages, report the verified local build and request explicit approval for the destructive history rewrite and external publication. The report must state:

- Target: public `Lvzhou48/desert-oasis-blog`.
- Initial site: `https://lvzhou48.github.io/desert-oasis-blog/`.
- Current local history contains a non-private author email and must not be pushed.
- The user must copy the exact GitHub `noreply` address from GitHub Settings > Emails; do not invent it.
- After approval, record the current `git config user.email` value in a shell variable, scan the working tree for that value, and remove any matches from tracked files.
- Create a new orphan branch from the verified working-tree snapshot, commit it once with the supplied `noreply` identity, replace local `main` with that branch, and verify the new root commit has no parent.
- Verify `git log --format='%ae'` contains only the supplied GitHub `noreply` address before creating or pushing the remote.
- Enable Pages and Discussions in the same repository; install giscus only after the repository exists.

After the user supplies the exact `noreply` address and separately approves history replacement, use this PowerShell sequence from the repository root:

```powershell
$privacyEmail = Read-Host 'Paste the exact GitHub noreply email from Settings > Emails'
$oldEmail = git config user.email
rg -n --fixed-strings $oldEmail -g '!.git/**' .
git status --short
git branch private-history-backup main
git switch --orphan public-main
git add -A
git -c user.name='Lvzhou48' -c user.email=$privacyEmail commit -m 'feat: launch desert oasis blog'
git branch -D main
git branch -m main
git rev-list --parents -n 1 HEAD
git log --format='%ae' | Sort-Object -Unique
```

Stop if the email scan prints a tracked-file match or `git status --short` is non-empty. The `git rev-list` result must contain exactly one hash, proving the public root has no parent. The unique email output must equal the user-supplied `noreply` address. Keep `private-history-backup` local and push only with `git push -u origin main`; never use `--all` or `--mirror`.

Do not replace history, create the remote repository, push, enable Pages, expose a custom domain, or install giscus without that explicit approval.
