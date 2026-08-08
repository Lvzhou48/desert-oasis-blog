# 首次公开发布验证清单

验证日期：2026-08-08

目标公开仓库：`Lvzhou48/desert-oasis-blog`

初始站点：`https://lvzhou48.github.io/desert-oasis-blog/`

## 已验证的本地候选版本

- Astro 类型与内容检查通过：0 errors、0 warnings、0 hints；内容 schema 已使用 Astro 7 推荐的 `astro/zod` 导入。
- 公开内容门禁采用 fail-closed：它从 Git index 读取真正待提交的唯一 stage-0 项，并且只接受普通 `100644`/`100755` blob；`120000` 符号链接、`160000` gitlink、未知 mode、重复或未解决 stages 都会在读取对象前拒绝。显式目录 fixture 模式通过 `lstat` 拒绝根或子项符号链接及其他非普通文件，不沿链接读取目标。同一快照中的 Markdown/MDX 只有 frontmatter 可解析且显式为布尔值 `draft: false` 才允许发布，并扫描内容与 Git 路径中的邮箱、常见 GitHub/AWS 凭据、私钥、token/secret 赋值和本机用户绝对路径。UTF-8 与 UTF-16LE/BE 都先严格解码，再拒绝除 TAB/LF/CR 外的 C0、DEL 和 C1 控制字符。所有 blob 都先接受有界的 ASCII/UTF-8 与 UTF-16LE/BE 可识别敏感扫描；已知危险扩展、已识别 binary/archive magic 或无效文本编码都会拒绝。当前候选版本不宣称支持图片、PDF、字体或压缩附件，也没有可由同一提交修改的 allowlist。伪装成纯文本且 bytes 无法区分的内容超出自动检测能力，必须进入未来独立审核流程；添加封面前也必须另行设计清洗与审核。
- 官方 `@astrojs/mdx` 7.0.5 已接入，并通过独立 MDX 页面真实构建和渲染回归。
- 14 个 Vitest 测试文件、146 项测试全部通过；其中包含 Git index 普通/可执行 blob、符号链接/gitlink/未知 mode/merge stage、目录 junction、敏感 Git 路径、C0/DEL/C1 控制字符、Brotli 与危险多扩展、二进制/归档/压缩拒绝与原始 bytes、字体 magic 误报回归、公开门禁、UTF-16、敏感快照、MDX 构建、空构建目录、真实 HTML 属性静态链接、giscus 配置矩阵、对比度、上海跨年年份、稳定文章排序、标签 JSON 序列化、E2E 生命周期参数和 GitHub Pages workflow 契约检查。
- 根路径与 `/desert-oasis-blog/` 项目子路径均覆盖 23 项 Playwright 测试，包括含 `|` 标签的精确筛选、分类词搜索、顶部搜索入口的跨页与同页重复激活聚焦、移动菜单、标题层级、About/404 首视口布局、上海日期产物和评论备用入口。
- 首页、文章列表、分类、关于页和两篇公开文章在 390×844 下均只有一个可见 `h1`，跳转正文链接可通过键盘聚焦，无横向溢出或浏览器控制台错误。
- 减少动态效果偏好生效，装饰与交互元素的动画和过渡时长严格为 0ms。
- Playwright 自行持有并关闭测试服务器；Windows 冷启动连续三次自然退出、返回 0，并通过真实 TCP bind 证明 4321 端口可复用，其中一次覆盖 `/desert-oasis-blog/` 子路径；1ms 强制超时会有界地非零退出并同样释放端口。
- 根路径与 Pages 生产构建均生成首页、404、文章、分类、RSS、搜索索引和 sitemap；静态链接检查使用直接精确依赖 `parse5@7.3.0` 的官方解析 API，只遍历真实元素的 `href`、`src`、`srcset`，遵循大小写、引号、HTML entity 与首个 `<base href>` 语义，并分别按 `/` 与 `/desert-oasis-blog/` 验证 base 边界和目标存在性。正文、转义代码、`pre` 文本、脚本内容和 HTML 注释中的 `href` 示例不会造成假阳性。
- Pages 流水线按 Astro check → 公开门禁/敏感扫描 → 单元测试 → Pages build → 静态链接检查 → base-path E2E → artifact upload 排序；PR 不上传或部署，上传与部署仅允许 `refs/heads/main`，工作流级并发会取消同分支旧运行。
- giscus 只在四项配置非空且仓库严格匹配 `Lvzhou48/desert-oasis-blog` 时加载。无配置、部分配置、空白值或错误仓库均显示精确降级文案且不加载脚本；即使正确配置的外部脚本加载失败，页面仍保留指向固定仓库 Discussions 的安全备用说明和链接。
- 普通小字使用的 `--muted` 已通过独立 sRGB 相对亮度计算，对纸张、渐变浅色与沙色表面的对比度均不低于 4.5:1。
- 页脚年份固定从 `Asia/Shanghai` 推导，并覆盖 UTC 跨年边界；同时间文章以 id 升序作为稳定第二排序键，相邻文章继续从该顺序派生。
- 生产预览已在 1440×900 和 390×844 检查首页、文章列表、文章详情、分类页与 404：沙色/森林绿配色一致，文字未裁切，无封面文章卡片正常。
- 当前已跟踪文件不含字面邮箱地址或常见 GitHub、云服务及私钥模式；当前 Git 配置中的邮箱也未出现在待发布工作快照中。

## 未解除的隐私门禁

当前本地 Git 历史的作者和提交者信息仍含非隐私邮箱，**不得直接推送当前分支或任何继承该历史的分支**。公开内容检查通过不等于历史已经安全。

首次外部发布前必须：

1. 由作者从 GitHub **Settings → Emails** 复制当前准确的 `noreply` 邮箱；不能猜测或拼接。
2. 另行取得作者对本地历史替换的明确批准。
3. 从已验证工作快照创建一个无父提交的 orphan 根提交，并仅使用作者提供的 `noreply` 身份。
4. 确认新根提交没有父提交，且待推历史中的作者与提交者邮箱只有该 `noreply` 地址。
5. 本地保留旧历史备份分支，但只能推送新的 `main`；禁止使用 `--all` 或 `--mirror`。
6. 再次取得作者对远端创建与公开发布的明确批准，才可创建仓库并推送。

## 外部服务门禁

本地验证没有执行以下操作：

- 创建或修改 GitHub 远端仓库；
- 推送任何提交或改写当前历史；
- 启用 GitHub Pages 或 Discussions；
- 安装、授权或配置 giscus；
- 绑定自定义域名。

只有仓库存在且发布获批后，才能在同一仓库启用 Pages 与 Discussions；giscus 必须最后安装并仅授权 `Lvzhou48/desert-oasis-blog`。
