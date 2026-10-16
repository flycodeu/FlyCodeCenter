# 仓库维护

## 目录

| 目录 | 放什么 |
| --- | --- |
| `src/content/` | 文章和教程；路由由 frontmatter 的 `permalink` 决定 |
| `src/components/`、`src/plugins/`、`src/styles/` | 网站组件、功能和样式 |
| `public/` | 会原样发布的字体、图片、脚本和下载文件 |
| `examples/` | 独立运行的完整示例工程，不随网站发布 |
| `scripts/` | 开发、构建和仓库检查工具 |
| `tests/unit/` | Node 单元测试 |
| `tests/e2e/`、`tests/browser/` | Playwright 测试和指定站点的浏览器校验 |
| `docs/` | 配置与开发说明 |

`public/examples/face-recognition/` 是文章直接链接的 Python 源码下载，保留在公开目录。
登录加密的 Java 工程放在 `examples/login-encryption/`；文章下载仍使用 `public/examples/login-encryption.zip`。
修改 Java 示例后，需同步更新下载包，仅打包源码，不包含 `target/`。

## 哪些文件不提交

依赖、构建输出、虚拟环境、模型权重、测试报告、截图和本地 `.env` 不提交。
环境变量模板可命名为 `.env.example` 或 `.env.production.example`，只能放占位值。
`.gitattributes` 约束文本行尾；不要为统一格式而重写所有历史文件。

临时验证应放在仓库外，或使用已忽略的 `.tmp-build-*`。
测试报告统一放 `test-results/`、`playwright-report/`，不要在项目根目录新增一次性脚本。

注意：`.gitignore` 只影响 Git，不阻止 Astro 发布 `public/` 中的文件。
不要在 `public/` 里编译 Java、安装依赖、建虚拟环境或存放模型及测试照片。
`public/search/minisearch.json` 和 `public/encrypted/` 是构建流程管理的例外。

## 提交前

```powershell
npm run check
npm run build
git diff --check
git status --short
```

`check` 包括仓库检查、单元测试、frontmatter 和内容质量检查。
构建前也会执行仓库检查：检查 Git 已跟踪及未忽略的新文件，并直接扫描 `public/`，拒绝编译目录、环境文件和模型权重等产物。
它是文件名规则检查，不是完整的密钥扫描或内容审计。暂存后还应检查 `git diff --cached`，确认没有隐私数据。

## 人脸教程页面验证

启动开发服务或构建产物的静态服务器后执行：

```powershell
$env:FACE_BASE_URL = 'http://127.0.0.1:4337'
$env:BROWSER_CHANNEL = 'msedge' # 本机已安装 Edge 时；否则使用 Playwright Chromium
npm run test:face-browser
```

默认地址为 `http://127.0.0.1:4321`，不设置 `BROWSER_CHANNEL` 时使用 Playwright Chromium。
检查五篇文章的桌面/手机布局、公式、图表、链接和九个源码下载，截图写入 `test-results/face-tutorial/`。
此脚本使用网站现有的爬虫白名单检查正文，不代表普通访客的反爬交互验收。
