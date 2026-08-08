# 沙漠里的绿洲

“沙漠里的绿洲”是一个关于数据工程和 AI、生活与成长、远方与见闻，以及随想的个人博客。网站使用 Astro、Markdown 和 MDX 构建，并由 GitHub Pages 发布。

顶部“搜索”可以直达文章搜索区并将键盘焦点放到搜索框。文章可按标题、摘要、分类名或标签搜索。

## 本地运行

需要 Node.js 24（以 `.nvmrc` 为准）和 npm。

```bash
npm ci
npm run dev
```

提交前必须完整检查：

```bash
npm run verify
```

常用的单项命令：

```bash
npm run check
npm run check:public
npm test
npm run build
npm run check:links
npm run test:e2e:lifecycle
```

`npm run verify` 与发布流水线使用相同的生产顺序：Astro 检查、公开内容与 Git index 暂存快照扫描、单元测试、Pages 子路径构建、静态内部链接检查，以及会确认测试进程自然退出和端口释放的 base-path E2E。也可以分别运行：

```bash
npm run build:pages
npm run check:links:pages
npm run test:e2e:lifecycle:pages
```

## 写一篇文章

公开文章放在 `src/content/posts/`，文件扩展名可以是 `.md` 或 `.mdx`。Frontmatter 必须符合下面的格式：

```yaml
---
title: 一篇文章的标题
description: 这里填写二十到一百八十个字符的文章摘要，用于列表、搜索和订阅。
publishedAt: 2026-08-08
updatedAt: 2026-08-09
category: 数据工程和 AI
tags:
  - 数据工程
  - AI
draft: true
---
```

`category` 只能是“数据工程和 AI”“生活与成长”“远方与见闻”“随想”之一。没有更新日期时，可以删除 `updatedAt`。

只写日期的 `publishedAt` / `updatedAt`（例如 `2026-08-08`）按 Asia/Shanghai 当天 00:00 解释；需要精确到时刻时，请写带时区的 datetime（例如 `2026-08-08T08:30:00+08:00`），该时刻会被原样保留。博客内容的日期年份范围统一为 1900–9999。日期可以是普通或带引号的 YAML scalar，也支持指向日期 scalar 的 anchor/alias 与显式 `!!timestamp`；alias 必须安全解析到单个 scalar，循环引用、对象/数组、范围外年份和其他无效日期都会让构建失败。

推荐的发布步骤：

1. 私人初稿只写在被忽略的 `drafts/` 目录，或仓库之外。
2. 与 Codex 一起完善内容，确认其中没有私人信息。
3. 准备公开时，将文章复制到 `src/content/posts/`，先保留 `draft: true`。
4. 与 Codex 一起预览和检查文章。
5. 只有作者明确确认发布后，才将 `draft` 改为 `false` 并推送到 `main`。
6. 自动检查会在后台验证格式、隐私、链接、浏览器体验和空文章状态；作者不需要为了增删改文章维护测试文件。

重要：`src/content/posts/` 中的 `.md` 和 `.mdx` 只有 frontmatter 可解析且显式写成布尔值 `draft: false` 才能通过公开门禁；缺失字段、字符串形式的 `false`、草稿、损坏的 YAML 或 BOM 都会被拒绝。`draft: true` 只会阻止文章进入网站构建，**不会**隐藏公开仓库里的源文件。私人草稿绝不能提交到 Git。也不要提交邮箱地址、密钥、令牌、真实身份资料或其他可识别个人的信息。

## 首次公开前隐私门禁

当前本地 Git 历史的提交作者信息中含有非隐私邮箱，因此**绝不能直接推送当前分支或任何继承这段历史的分支**。`npm run check:public` 从 Git index 读取真正待提交的、唯一 stage-0 的普通 `100644`/`100755` blobs，并使用同一批内容检查文章 frontmatter、Git 路径与敏感模式。路径会拒绝全部 C0、DEL、C1 控制字符，并在错误日志中把它们安全转义；文件内容允许 TAB、LF、CR 三种文本空白，但拒绝其余 C0 与全部 DEL、C1。符号链接、gitlink、未知 mode、未解决的 merge stages 和无法可靠解码的文本也都会 fail-closed，且不会沿符号链接读取目标。显式目录测试模式也会用 `lstat` 拒绝符号链接和其他非普通文件。所有 blob 都会先扫描可识别的 ASCII/UTF-8 与 UTF-16LE/BE 敏感片段；门禁会拒绝已知危险扩展（包括 Brotli/常见归档、图片、PDF、字体和 WASM）、已识别的二进制 magic，以及包含非文本字节的内容。仓库内目前只接受可审计的安全文本素材，例如文本 SVG。若文件伪装成普通文本且 bytes 与文本无法区分，自动门禁不能证明其业务语义安全，仍需在未来独立审核流程中处理。以后添加封面或其他二进制附件前，必须另行设计不可由同一提交绕过的清洗与人工审核流程，不能靠项目内 allowlist 自助放行。该门禁不能清除旧提交里的作者邮箱，也不能代替首次公开前的历史审计。

生产构建后的内部链接由精确锁定的 `parse5` 解析真实 HTML 元素，只检查实际 `href`、`src` 与 `srcset` 属性，并遵循 HTML entity、首个 `<base href>` 和配置的 Pages base 边界。正文、转义代码、脚本内容与 HTML 注释中的示例字符串不会被误当成链接。文章筛选的标签列表使用 JSON 序列化，因此标签本身可以安全包含 `|`。

首次公开必须按以下顺序处理：

1. 从 GitHub 账号的 **Settings → Emails** 获取该账号当前准确的 `noreply` 邮箱；不能猜测、拼接或沿用普通邮箱。
2. 运行全部验证，并从已验证的公开文件快照中排除 `drafts/`、本地环境文件、密钥、邮箱和可识别个人的信息。
3. 从这个已验证公开快照创建一个**不继承旧历史**的 clean orphan 根提交。不能把当前提交链直接推送，也不能用普通 squash 后仍保留有问题的根历史。
4. 推送前检查完整的待推历史：它必须只有经过确认的公开提交，所有提交的作者与提交者邮箱都只能是步骤 1 获得的准确 `noreply` 邮箱，并再次扫描全部待推内容是否含隐私信息或秘密。
5. 所有门禁通过后，才进入远端创建和发布步骤。

以下操作会改变历史或 GitHub 外部状态，**每一项都必须在执行当时分别获得用户明确批准**；对其中一项的批准不代表授权后续项目：

- 替换或重写本地公开历史，创建 clean orphan 根提交；
- 创建远端公开仓库；
- 推送任何分支或提交；
- 启用 GitHub Pages；
- 启用 GitHub Discussions；
- 安装或配置 giscus（包括 GitHub App 授权和仓库变量）。

在这些批准和门禁完成之前，只能继续本地开发、检查和生成待审阅快照。

## GitHub Pages 发布

正式公开仓库是 `Lvzhou48/desert-oasis-blog`，初始站点地址是 [https://lvzhou48.github.io/desert-oasis-blog/](https://lvzhou48.github.io/desert-oasis-blog/)。这是 GitHub Pages 的项目站点，因此生产构建使用 `/desert-oasis-blog/` 作为 base path；本地开发仍使用 `/`。

首次发布时，在仓库的 **Settings → Pages → Build and deployment** 中将 Source 设为 **GitHub Actions**。`.github/workflows/deploy.yml` 会在 pull request 中执行检查、Pages 构建、内部链接检查和 base-path E2E，但不会上传或部署；只有 `refs/heads/main`（包括手动选择 `main` 触发）在全部门禁通过后才能上传并部署 `dist/`。同一分支的新运行会取消尚未完成的旧运行，避免旧产物晚于新版本部署。

## 开启 GitHub 评论

评论使用与网站相同仓库中的 GitHub Discussions 和 giscus：

1. 在仓库 **Settings → General → Features** 中启用 Discussions。
2. 安装并授权 [giscus GitHub App](https://github.com/apps/giscus)，只授权 `Lvzhou48/desert-oasis-blog`。
3. 打开 [giscus.app/zh-CN](https://giscus.app/zh-CN)，填入仓库名，选择一个 Discussions 分类，并使用“pathname”映射。
4. 从生成的配置中取得仓库名、仓库 ID、分类名和分类 ID。
5. 在仓库 **Settings → Secrets and variables → Actions → Variables** 中创建以下四个 Repository variables：

   - `PUBLIC_GISCUS_REPO`
   - `PUBLIC_GISCUS_REPO_ID`
   - `PUBLIC_GISCUS_CATEGORY`
   - `PUBLIC_GISCUS_CATEGORY_ID`

只有四个值齐全且 `PUBLIC_GISCUS_REPO` 严格等于 `Lvzhou48/desert-oasis-blog` 时，生产构建才会加载 giscus。无配置、部分配置或仓库不匹配时，文章页显示“评论将在 GitHub Discussions 配置后开放。”，且不加载评论脚本。文章页始终保留指向固定仓库 Discussions 的安全外链；即使 giscus 脚本被网络或内容拦截器阻止，读者仍然可以前往 Discussions。

## 以后绑定自定义域名

1. 在域名服务商处按 GitHub Pages 文档配置 DNS；子域名通常使用指向 `lvzhou48.github.io` 的 CNAME。
2. 在仓库 **Settings → Pages → Custom domain** 中填写域名并保存。
3. 等待 DNS 检查通过，再启用 **Enforce HTTPS**。
4. 将生产环境的 `SITE_URL` 改为新的完整站点源地址，并根据最终 URL 判断是否仍需 `/desert-oasis-blog/` base；自定义域名通常改为 `/`。
5. 重新部署后检查首页、文章、分类、RSS、sitemap、搜索和评论链接，并确认浏览器地址及 HTTPS 证书正确。

自定义域名生效前，以 GitHub Pages 初始项目站点地址为准。
