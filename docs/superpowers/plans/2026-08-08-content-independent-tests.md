# 内容独立测试 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让完整验证在任意公开文章集合（包括零篇）下都能通过，而测试不再引用真实文章。

**Architecture:** 内容集合的目录允许由测试专用环境变量覆盖，生产环境仍默认读取 `src/content/posts`。评论构建测试使用仓库内的独立测试文章；浏览器测试通过公开搜索索引发现当前文章，并在零篇文章时验证空状态。生命周期脚本把受控内容目录传给 Playwright 的 Astro 开发服务器。

**Tech Stack:** Astro 7、TypeScript、Vitest、Playwright、Node.js 24。

## Global Constraints

- 真实文章目录仍是 `src/content/posts`；生产环境未设置测试环境变量时行为不变。
- 测试不得写死真实文章的 id、标题、分类、标签或 URL。
- 测试夹具不属于公开文章集合，不能进入网站文章列表、RSS 或搜索索引。
- 保留公开内容门禁、GitHub Pages base path 和 Windows 生命周期端口释放检查。
- 采用测试先行；每个行为必须先出现可解释的失败。

---

### Task 1: 添加受控的测试内容目录边界

**Files:**
- Modify: `src/content.config.ts:1-32`
- Create: `src/lib/content-source.ts`
- Create: `tests/fixtures/content-independent/sample.md`
- Create: `tests/fixtures/content-independent-empty/.gitkeep`
- Test: `tests/unit/content-source.test.ts`

**Interfaces:**
- Consumes: `BLOG_CONTENT_DIR?: string`。
- Produces: 内容 collection 的 `dateAwareGlob({ base })`；未设置时 `base === './src/content/posts'`，设置时使用指定目录。

- [ ] **Step 1: 写出失败的目录选择测试**

```ts
import { describe, expect, it } from 'vitest';
import { resolvePostsDirectory } from '../../src/lib/content-source';

describe('post content source', () => {
  it('uses the production posts directory when no test override exists', () => {
    expect(resolvePostsDirectory(undefined)).toBe('./src/content/posts');
  });

  it('uses an explicit test-only content directory', () => {
    expect(resolvePostsDirectory('tests/fixtures/content-independent')).toBe('tests/fixtures/content-independent');
  });
});
```

- [ ] **Step 2: 运行测试，确认它因缺少模块而失败**

Run: `npx vitest run tests/unit/content-source.test.ts`

Expected: FAIL，提示无法解析 `src/lib/content-source`。

- [ ] **Step 3: 实现最小目录解析与测试夹具**

```ts
// src/lib/content-source.ts
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function resolvePostsDirectory(override = process.env.BLOG_CONTENT_DIR) {
  const directory = override?.trim();
  return directory ? pathToFileURL(resolve(directory)).href : './src/content/posts';
}

// src/content.config.ts
import { resolvePostsDirectory } from './lib/content-source';

loader: dateAwareGlob({ pattern: '**/*.{md,mdx}', base: resolvePostsDirectory() }),
```

Create `tests/fixtures/content-independent/sample.md` exactly as follows, then create the empty fixture directory with `.gitkeep`.

```md
---
title: 独立测试文章
description: 这是一篇只用于自动化构建验证的独立内容夹具，不属于公开博客文章。
publishedAt: 2026-08-08
category: 随想
tags:
  - 测试
draft: false
---

自动化测试不应依赖作者实际发布的任何文章。
```

- [ ] **Step 4: 运行目录选择测试并构建夹具**

Run: `npx vitest run tests/unit/content-source.test.ts`

Expected: PASS，2 tests。

Run: `$env:BLOG_CONTENT_DIR='tests/fixtures/content-independent'; npm.cmd run build:pages`

Expected: PASS，产物含 `/posts/sample/`，默认公开文章不出现在该构建中。

- [ ] **Step 5: 提交 Task 1**

```bash
git add src/content.config.ts src/lib/content-source.ts tests/fixtures/content-independent/sample.md tests/fixtures/content-independent-empty/.gitkeep tests/unit/content-source.test.ts
git commit -m "test: isolate post content fixtures"
```

### Task 2: 让评论构建测试不依赖真实文章

**Files:**
- Modify: `tests/unit/comments-build.test.ts:1-80`
- Test: `tests/unit/comments-build.test.ts`

**Interfaces:**
- Consumes: `BLOG_CONTENT_DIR='tests/fixtures/content-independent'` 和夹具 slug `sample`。
- Produces: 五组 giscus 配置测试，它们只读取 `posts/sample/index.html`。

- [ ] **Step 1: 写出对独立夹具路径的失败断言**

```ts
it('builds its comment target from the isolated fixture content', () => {
  const html = buildArticle({});
  expect(html).toContain('独立测试文章');
});
```

将 `buildArticle` 中的输出读取目标改为 `posts/sample/index.html`，但先不传入 `BLOG_CONTENT_DIR`。

- [ ] **Step 2: 运行测试，确认构建目标不存在而失败**

Run: `npx vitest run tests/unit/comments-build.test.ts`

Expected: FAIL，读取 `posts/sample/index.html` 时 `ENOENT`；这证明测试仍错误依赖真实文章源。

- [ ] **Step 3: 仅为该构建传入夹具目录**

```ts
const env = {
  ...process.env,
  BLOG_CONTENT_DIR: resolve('tests/fixtures/content-independent'),
  PUBLIC_GISCUS_REPO: '',
  PUBLIC_GISCUS_REPO_ID: '',
  PUBLIC_GISCUS_CATEGORY: '',
  PUBLIC_GISCUS_CATEGORY_ID: '',
  ...config,
};
```

保留现有 giscus fallback 与完整配置断言，不更改评论组件。

- [ ] **Step 4: 运行评论构建测试**

Run: `npx vitest run tests/unit/comments-build.test.ts`

Expected: PASS，5 tests；删除或改名 `src/content/posts/` 中任意真实文章不会影响它。

- [ ] **Step 5: 提交 Task 2**

```bash
git add tests/unit/comments-build.test.ts
git commit -m "test: use isolated post fixture for comments"
```

### Task 3: 让浏览器测试按当前内容自发现并覆盖空状态

**Files:**
- Modify: `tests/e2e/blog.spec.ts:1-285`
- Modify: `scripts/e2e-lifecycle-options.mjs:1-12`
- Modify: `package.json:8-18`
- Test: `tests/e2e/blog.spec.ts`

**Interfaces:**
- Consumes: `GET /search-index.json`，每条记录为 `{ id, title, description, category, tags, href }`。
- Consumes: `--content-dir <path>` 生命周期参数。
- Produces: `npm run test:e2e:lifecycle:empty`，它以空文章目录运行同一浏览器套件。

- [ ] **Step 1: 写出动态文章发现与空状态的失败测试**

```ts
type SearchRecord = { id: string; title: string; description: string; category: string; tags: string[]; href: string };

async function getPublishedPosts(request: APIRequestContext): Promise<SearchRecord[]> {
  const response = await request.get(sitePath('/search-index.json'));
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test('empty publication state remains readable', async ({ page, request }) => {
  test.skip((await getPublishedPosts(request)).length !== 0, 'requires empty fixture');
  await page.goto(sitePath('/'));
  await expect(page.getByText('绿洲正在生长，第一篇文章很快抵达。')).toBeVisible();
  await page.goto(sitePath('/articles/'));
  await expect(page.getByText('0 篇文章')).toBeVisible();
});
```

将当前所有硬编码的 `first-oasis`、`绿洲的第一粒种子`、`随想` 和固定文章数量断言替换为 `getPublishedPosts(request)` 返回的第一条记录；尚不实现 `--content-dir` 参数。

- [ ] **Step 2: 运行空内容生命周期测试，确认它无法使用该参数而失败**

Run: `node scripts/check-e2e-lifecycle.mjs --base /desert-oasis-blog/ --content-dir tests/fixtures/content-independent-empty`

Expected: FAIL；当前参数解析只认识 `--base`，浏览器仍会读真实文章并跳过空状态断言。

- [ ] **Step 3: 传递受控内容目录并完成动态测试改造**

```js
// scripts/e2e-lifecycle-options.mjs
const contentIndex = arguments_.indexOf('--content-dir');
const contentDir = contentIndex >= 0 ? arguments_[contentIndex + 1] : undefined;
return {
  ...normalizedEnvironment,
  BASE_PATH: normalized === '//' ? '/' : normalized,
  ...(contentDir ? { BLOG_CONTENT_DIR: contentDir } : {}),
};
```

Add this script:

```json
"test:e2e:lifecycle:empty": "node scripts/check-e2e-lifecycle.mjs --base /desert-oasis-blog/ --content-dir tests/fixtures/content-independent-empty"
```

In E2E tests, keep shell, navigation, 404 and accessibility assertions unconditional. For content-specific tests, use `test.skip(!post, 'requires a public post')`; when a post exists, navigate with its `href`, search using its `title` or `category`, and assert RSS contains its `href` and title. Add empty-state RSS assertion that `<item>` is absent.

- [ ] **Step 4: 验证有文章和零文章两条路径**

Run: `npm.cmd run test:e2e:lifecycle:pages`

Expected: PASS；当前公开文章由搜索索引自动发现。

Run: `npm.cmd run test:e2e:lifecycle:empty`

Expected: PASS；空状态测试运行，文章详情相关测试有明确 skip，端口 4321 被释放。

- [ ] **Step 5: 提交 Task 3**

```bash
git add tests/e2e/blog.spec.ts scripts/e2e-lifecycle-options.mjs package.json
git commit -m "test: discover published posts dynamically"
```

### Task 4: 将两种内容状态纳入发布门禁

**Files:**
- Modify: `package.json:8-18`
- Modify: `.github/workflows/deploy.yml:23-25`
- Modify: `README.md:41-72`
- Modify: `tests/unit/workflow.test.ts:14-73`
- Test: `npm.cmd run verify`

**Interfaces:**
- Consumes: `test:e2e:lifecycle:pages` 与 `test:e2e:lifecycle:empty`。
- Produces: 完整验证包含默认公开内容和零文章状态；README 向作者说明文章调整不需要测试维护。

- [ ] **Step 1: 写出失败的工作流契约测试**

```ts
it('runs both normal and empty-content browser coverage before Pages deployment', () => {
  const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
  expect(workflow).toContain('npm run test:e2e:lifecycle:pages');
  expect(workflow).toContain('npm run test:e2e:lifecycle:empty');
});
```

Add `npm run test:e2e:lifecycle:empty` immediately after the existing Pages E2E item in the `orderedSteps` array, and append it to the expected `packageJson.scripts.verify` string before changing production files.

- [ ] **Step 2: 运行契约测试，确认缺少空内容门禁而失败**

Run: `npx vitest run tests/unit/workflow.test.ts`

Expected: FAIL，部署 workflow 尚未调用 `test:e2e:lifecycle:empty`。

- [ ] **Step 3: 更新本地与 GitHub 发布链路**

```json
"verify": "npm run check && npm run check:public && npm test && npm run build:pages && npm run check:links:pages && npm run test:e2e:lifecycle:pages && npm run test:e2e:lifecycle:empty"
```

Add `- run: npm run test:e2e:lifecycle:empty` immediately after the existing Pages E2E command in `.github/workflows/deploy.yml`. Update README's publishing section: authors only supply content and confirmation; regression checks discover content automatically and also test an empty blog.

- [ ] **Step 4: 执行完整验证**

Run: `npm.cmd run verify`

Expected: PASS；Astro 检查、公开内容门禁、单元测试、Pages 构建、链接检查、正常文章 E2E 和空文章 E2E 都完成，两个 E2E 运行都释放端口 4321。

- [ ] **Step 5: 提交 Task 4**

```bash
git add package.json .github/workflows/deploy.yml README.md tests/unit/workflow.test.ts
git commit -m "test: validate blogs with any article count"
```
