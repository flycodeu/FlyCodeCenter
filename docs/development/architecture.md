# FlyCodeCenter 当前架构与功能基线

核对日期：2026-10-20。范围是本仓库的博客与技术教程站点，不是一个在线 USB 继电器控制平台。

这是根据当前源码整理的实现清单。下面的“已有实现”不等于所有外部服务、生产部署、硬件或安全性均已验收。本轮复核结果见[USB 教程发布验证](../verification/usb-relay-2026-10-20.md)。

## 系统边界与数据流

本站使用 Astro 7，静态页面优先，少量接口由 Vercel adapter 输出为服务端函数。没有独立的内容管理后台或业务数据库服务。文章、教程、项目介绍与页面资料保存在仓库中；浏览器本地状态和可选外部服务分别管理。

```text
Markdown / MDX + frontmatter + src/site.config.ts
  → 内容集合、稳定路由与派生元数据
  → 构建插件：Markdown 转换、代码高亮、集成装配
  → Astro 布局与页面 → dist/client + Vercel 服务端产物
  → 浏览器运行时：目录、代码复制、图表、搜索、主题和交互演示

构建索引：Minisearch → public/search/；Pagefind → 完整构建后的 HTML
按需服务端接口：/api/views、/api/jarvis/chat、/api/jarvis/stream
公开下载：public/examples/；不随站点发布的完整工程：examples/
```

`public/` 会原样发布，Git 忽略规则不会阻止它进入构建产物。纯静态 HTTP 服务器只能验证页面和下载，不能执行上述服务端接口。

## 模块划分

这是本次归纳的功能分组，不是新加的程序目录或服务拆分。

| 编号 | 模块 | 职责 |
| --- | --- | --- |
| CONTENT | 内容组织 | 文章、教程、面试题、项目与内容索引 |
| PRESENTATION | 阅读与导航 | 主题、布局、站点导航与分页 |
| RENDERING | 内容渲染 | 构建插件和文章页运行时 |
| SEARCH | 站内检索 | 索引生成、搜索提供方与弹窗 |
| ENGAGEMENT | 阅读反馈 | 评论适配、访问统计与本地阅读历史 |
| PROTECTION | 内容访问提示 | 加密内容流程、访问门槛和客户端反爬提示 |
| AI | JARVIS 助手 | 模型与会话设置、非流式/流式代理 |
| DELIVERY | 示例与交付 | 教学示例、质量门禁、构建与发布 |

## 当前功能与操作能力

### CONTENT.ARTICLE_ROUTING 文章集合与稳定路由

已有实现：文章集合按 schema 读取 Markdown/MDX，路由由元数据和路由工具解析，而不是只由文件名决定。

入口：`src/content.config.ts`、`src/utils/content-route.ts`、`src/utils/content-code.ts`、`src/pages/blog/[key].astro`、`src/pages/[prefix]/[code].astro`。

- `INGEST`：读取内容集合。加载正文与 frontmatter 并供页面查询。
- `ROUTE`：解析稳定文章地址。保留 code/permalink 与文章元数据的对应关系。

验证边界：本轮确认 USB 文章路由和构建结果，没有逐篇人工审核全部历史文章。

### CONTENT.TUTORIAL_READER 教程系列阅读

已有实现：教程索引、系列目录、章节阅读布局和侧栏导航。

入口：`src/pages/tutorials/index.astro`、`src/pages/tutorials/[series]/[slug].astro`、`src/layouts/TutorialReaderLayout.astro`、`src/components/TutorialSidebar.astro`、`src/utils/tutorial-series.ts`。

- `SERIES`：组织教程系列。根据内容资料生成系列与章节入口。
- `CHAPTERS`：阅读与切换章节。提供章节正文、侧栏和目录。

验证边界：本轮重跑既有人脸教程结构测试；没有重做相机、模型或全部教程交互验收。

### CONTENT.INTERVIEW_CENTER 面试题阅读

已有实现：分类和题目页面、顺序控制、答案显隐及浏览器状态。

入口：`src/pages/interview/index.astro`、`src/pages/interview/[space]/[slug].astro`、`src/utils/interview.ts`、`src/scripts/interview-answer-toggle.ts`、`src/scripts/interview-state.ts`。

- `SORT`：按分类与题目排序。使用 order、时间与方向配置组织列表。
- `ANSWERS`：查看答案并保留阅读状态。答案交互与状态由浏览器脚本处理。

验证边界：源码已定位，未在本轮逐项操作面试中心。访问门槛不等于服务端账号权限。

### CONTENT.CONTENT_DISCOVERY 项目与内容索引

已有实现：项目列表/详情、标签、归档、时间线与类型索引页面，以及关于、收藏站点、摄影图库等资料页。

入口：`src/pages/projects/index.astro`、`src/pages/projects/[code].astro`、`src/pages/tags/[tag].astro`、`src/pages/archives.astro`、`src/pages/timeline.astro`、`src/pages/types/index.astro`、`src/pages/about.astro`、`src/pages/sites.astro`、`src/pages/gallery.astro`。

- `PROJECTS`：浏览项目资料。呈现仓库内维护的项目介绍，不自动监控项目实际运行状态。
- `INDEXES`：从索引发现文章。按标签、归档、时间线和类型进入内容。

验证边界：页面参与本轮构建；未逐条检查外链和项目外部部署。

### PRESENTATION.THEME_LAYOUT 主题与阅读布局

已有实现：统一站点配置、主题预设、布局预设及响应式阅读样式。

入口：`src/site.config.ts`、`src/components/ThemeToggle.astro`、`src/layouts/BaseLayout.astro`、`src/layouts/PostLayout.astro`、`src/styles/global.css`。

- `THEMES`：切换主题外观。由配置及主题样式控制展示。
- `RESPONSIVE`：适配不同屏幕阅读。文章、目录和代码容器按布局配置呈现。

验证边界：本轮检查 USB 文章 1440/390 像素页面；未穷举所有主题、浏览器和页面组合。

### PRESENTATION.SITE_NAVIGATION 站点导航与分页

已有实现：页头菜单、列表分页、延迟初始化的全局交互。

入口：`src/components/Header.astro`、`src/components/Nav.astro`、`src/components/Pagination.astro`、`src/utils/pagination.ts`、`src/scripts/base-layout-runtime.js`。

- `NAVIGATE`：通过菜单进入站点栏目。导航内容受统一配置影响。
- `PAGINATE`：切换内容列表页。按列表配置分页或加载更多。

验证边界：构建已通过，本轮不宣称所有导航交互已专项验收。

### RENDERING.BUILD_PLUGINS 构建期内容插件

已有实现：聚合 build 插件，装配 Astro integrations、remark/rehype 与代码高亮。

入口：`astro.config.mjs`、`src/plugins/core/build-pipeline.mjs`、`src/plugins/build/index.mjs`、`src/plugins/build/markdown.plugin.mjs`、`src/plugins/build/code-highlight.plugin.mjs`。

- `PIPELINE`：装配构建流水线。各插件返回 integrations、Markdown 转换和高亮设置。
- `MARKDOWN`：转换扩展语法。支持 include、数学公式、图片和其他已登记扩展。

验证边界：本轮完整构建通过，USB 文中的 Mermaid 在浏览器正常生成；未穷举所有扩展组合。

### RENDERING.ARTICLE_RUNTIME 文章交互增强

已有实现：代码块复制/行号/折叠、图表按需初始化、Tabs、公式复制及教学交互演示。

入口：`src/plugins/runtime/article/index.js`、`src/scripts/article-runtime-entry.js`、`src/plugins/runtime/article/video-coding-demo.js`、`src/plugins/runtime/article/login-crypto-demo.js`。

- `CODE_TOOLS`：复制与展开代码。运行时增强代码块，复制结果应与源文件一致。
- `DIAGRAMS_DEMOS`：显示图表与交互演示。按配置接入 Mermaid、Draw.io、ECharts、Chart.js 等能力。

验证边界：本轮 USB 文章代码复制/折叠与 Mermaid 通过；既有视频/登录加密模型单元测试通过。没有重新验收全部图表提供方。

### SEARCH.SEARCH_PROVIDERS 站内检索

已有实现：Pagefind、Minisearch、Algolia 适配与搜索弹窗。当前默认 Pagefind，开发环境使用 Minisearch；配置了 Minisearch 回退路径。

入口：`src/providers/search/index.ts`、`src/providers/search/pagefind.ts`、`src/providers/search/minisearch.ts`、`src/providers/search/algolia.ts`、`src/scripts/search-modal.ts`、`scripts/build-minisearch.mjs`、`scripts/pagefind-index.mjs`。

- `INDEX`：生成站内索引。构建前生成 Minisearch，构建后对完整 HTML 生成 Pagefind。
- `QUERY`：在弹窗检索。按 provider 配置加载引擎并展示结果。

验证边界：本轮两套本地索引构建成功；没有验证真实 Algolia 凭证、网络服务或全部回退场景。

### ENGAGEMENT.COMMENTS 可插拔评论

已有实现：评论组件根据配置选择 Giscus、Waline、Twikoo、Utterances 或关闭。

入口：`src/components/Comments.astro`、`src/components/Giscus.astro`、`src/providers/comment/index.ts`、`src/site.config.ts`。

- `SELECT`：选择评论提供方。统一配置决定渲染方式。
- `MOUNT`：挂载评论组件。依赖相应服务地址、仓库或分类等外部参数。

验证边界：默认配置名为 Giscus，不等于外部服务已经配置并成功收发评论；本轮没有发出测试评论。

### ENGAGEMENT.READING_STATS 访问统计与阅读历史

已有实现：访问统计接口支持可选 KV/Upstash，未配置或失败时回退进程内存；浏览器保存阅读历史。

入口：`src/pages/api/views.ts`、`src/plugins/runtime/article/index.js`、`src/pages/reading.astro`。

- `COUNTS`：读取与累计访问计数。按 slug 与客户端标识去重；内存回退不保证持久性或跨实例一致性。
- `HISTORY`：查看本机阅读历史。记录保存在访问者的浏览器，不是跨设备账号同步。

验证边界：仅检查源码与构建；静态预览不执行访问统计函数，也不证明线上 KV 持久化。

### PROTECTION.ACCESS_GATES 加密内容与访问提示

已有实现：文章加密产物脚本、浏览器解密、面试中心访问界面、客户端反爬提示及限制。

入口：`scripts/encrypt.mjs`、`src/utils/encrypt.ts`、`src/scripts/encrypt-gate.ts`、`src/components/InterviewAccessGate.astro`、`src/scripts/runtime/anti-crawl.js`。

- `ENCRYPTED_CONTENT`：生成并解密受控正文。按当前脚本处理加密内容，实际发布泄露面仍需单独审查。
- `INTERVIEW_GATE`：显示面试中心访问门槛。不把前端校验描述成服务端身份认证。
- `ANTI_CRAWL`：提示或限制疑似自动化访问。客户端规则与现有白名单不构成完整安全边界。

验证边界：本轮生成加密载荷数为 0，没有加密文章往返验证；生产构建结构检查使用既有爬虫白名单，普通访客仅做 HTTP/标题冒烟检查。没有修改或削弱反爬规则，也没有做完整安全审计。

### AI.JARVIS_CHAT JARVIS 模型会话

已有实现：会话、角色与模型配置的浏览器界面；非流式和 SSE 流式聊天代理。上游地址处理包含部分限制，但本轮不对其作安全保证。

入口：`src/pages/jarvis.astro`、`src/scripts/jarvis-page.ts`、`src/components/JarvisOrb.astro`、`src/pages/api/jarvis/chat.ts`、`src/pages/api/jarvis/stream.ts`、`src/utils/upstream-url.ts`。

- `LOCAL_CHAT`：管理本地模型角色与会话。使用浏览器存储和本地密钥处理流程，不等于站点统一账号系统。
- `PROXY`：请求上游并接收回复。服务端函数转发当前请求指定的上游配置，支持普通文本与流式事件。

验证边界：只确认源码和构建，未调用收费模型、未验证真实凭证、完整 SSE 会话或生产接口安全性。

### DELIVERY.BUILD_PUBLICATION 构建与发布产物

已有实现：frontmatter 同步、质量检查、索引、加密脚本、Astro/Vercel 构建，以及 RSS、robots 和 sitemap。

入口：`package.json`、`astro.config.mjs`、`scripts/dev-server.mjs`、`src/pages/rss.xml.ts`、`src/pages/robots.txt.ts`、`src/utils/seo.ts`。

- `BUILD`：生成页面和服务端产物。静态资源与接口使用不同运行方式。
- `FEEDS_SEO`：输出站点发现资料。生成 RSS、robots、sitemap 与页面元数据。

验证边界：本地完整构建通过。Git 推送成功与 Vercel 部署成功是不同事件；线上结果需另查。

### DELIVERY.REPO_QUALITY 仓库质量门禁

已有实现：公开目录受限产物检查、Node 单元测试、frontmatter 检查和内容质量检查。

入口：`scripts/check-repo.mjs`、`scripts/lint-frontmatter-tags.mjs`、`scripts/quality-guard.mjs`、`tests/unit/usb-relay-tutorial.test.mjs`、`docs/development/repository.md`。

- `PUBLIC_GUARD`：检查发布目录与提交边界。同时检查 Git 文件列表和 public 实际内容。
- `CHECKS`：运行测试和内容门禁。包含 USB 文中完整代码与下载文件逐字一致性检查。

验证边界：门禁不是完整密钥扫描或安全审计；本轮另行审阅本次暂存内容，不声称全仓库绝无秘密信息。

### DELIVERY.TEACHING_EXAMPLES 教学示例与 USB 继电器教程

已有实现：按初学者操作顺序重写的 USB 教程、17 行独立开/关空载示例（含缺少依赖时的安装提示与 UTF-8 BOM 下载）、可选的原命令行工具与离线测试；仓库另有人脸算法源码及登录加密示例工程。

入口：`src/content/blog/USB单路继电器零基础入门与Python实操.md`、`public/examples/usb-relay/relay_demo.py`、`public/examples/usb-relay/test_relay_demo.py`、`public/examples/usb-relay/relay_control.py`、`public/examples/usb-relay/test_relay_control.py`、`public/examples/face-recognition/algorithms.py`、`examples/login-encryption/pom.xml`。

- `USB_DRY_RUN`：可选原工具提供离线指令演练，不打开串口；该工具的真实 CLI 指令另需显式端口、USB 标识检查与人工空载确认。短示例不提供 dry-run，由串口替身测试验证。
- `USB_LEARNING`：先认识开关和端子，再找串口，分别运行短程序的 on 和 off，最后逐段解释和排障。短程序必须人工输入小写 yes 才打开指定串口，检查 4 字节完整写出，但不执行 USB 标识检查或自动反向动作；原长工具折叠为可选下载，现场联动仅说明方向。
- `OTHER_EXAMPLES`：取得其他教学源码。公开下载与独立工程按仓库职责分开保存，不把演示模型测试当成真实外部系统验收。

验证边界：2026-10-20 13:50:09 / 13:50:23 在实际 COM7 分别执行当时的短程序 on / off，均完整写出 4 字节并正常退出，最后发关；使用者随后确认听到了本次测试的切换声。后续只补充编码与依赖提示、环境说明并离线验证，没有再次向硬件发送指令；没有触点测量、外部负载、断电默认状态或现场常驻控制服务验收。各轮离线测试结果见发布验证记录。

## ForgeFlow 同步规则

以项目 `FLYCODECENTER` 登记当前仓库和 GitHub 远端，按上面 8 个模块、16 项功能、34 项操作能力建立可追溯清单。分组和编码是本次清单标识，不改变站点运行架构。

同步内容包括项目架构/需求/技术说明、功能与操作说明、源码入口、发布验证记录和追加式工作记录。使用已认证的接口写入，不直接修改运行数据库。

初次登记的生命周期按平台创建/设计接口自动推进，不手工改成“已验收”，也不据此声称代码没有实现。实现与验证事实写在说明和工程映射里；不补造历史 Run，不代替负责人批准，不修改其他项目或其历史状态。

后续同步应先读取当前版本并使用版本头校验；遇到并发修改应停止并核对，不覆盖新版本。本次完整回读报告及同步前备份保存在本机验证目录，不将运行数据库、凭证和备份发布到博客。
