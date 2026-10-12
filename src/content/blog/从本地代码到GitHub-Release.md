---
title: GitHub Release 怎么上传安装包：从零到发布
createTime: '2026/09/29 20:30:00'
code: github-release-upload-guide
permalink: /blog/github-release-upload-guide/
summary: 参考 GitHub 官方文档，说明如何创建 Release、上传附件和验证下载结果。
tags:
  - GitHub
  - Release
  - Git
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/990667183ad3256336a04340846abae.jpg
---

GitHub 仓库里有两类内容：提交记录保存源代码，Release 保存某个版本给用户下载的文件。安装包、压缩包、APK、校验文件都属于 Release 附件，不需要直接提交到源码仓库。

下面用 `my-app` 和 `v1.0.0` 做示例，文件名可以替换成自己的项目。

## 流程图

```mermaid
flowchart LR
  A[准备构建文件] --> B[确认版本标签]
  B --> C[创建 Release]
  C --> D[上传附件]
  D --> E[发布 Release]
  E --> F[下载并校验]
```

## 1. 准备发布文件

```text
my-app-v1.0.0-windows.zip
my-app-v1.0.0.apk
SHA256SUMS.txt
```

```powershell
Get-FileHash .\my-app-v1.0.0.apk -Algorithm SHA256
```

Release 附件可以不进入 Git 提交，但需要在本地保留一份，方便重传和核对。

## 2. 安装并登录 GitHub CLI

官方文档：[Installing GitHub CLI](https://cli.github.com/manual/installation)、[gh auth login](https://cli.github.com/manual/gh_auth_login)

```powershell
gh auth login
gh auth status
```

如果刚安装 CLI 后当前终端找不到 `gh`，关闭 PowerShell 后重新打开，让新的 PATH 生效。

## 3. 推送源码（可选）

```powershell
git status --short
# 只暂存已核对的源码路径，替换为自己的文件
git add src README.md
git diff --cached --stat
git commit -m "release: prepare v1.0.0"
$branch = git branch --show-current
if (-not $branch) { throw '当前为 detached HEAD，请先确认发布分支' }
git push origin $branch
if ($LASTEXITCODE -ne 0) { throw '推送失败，停止发布' }
git tag -a v1.0.0 -m 'My App 1.0.0'
git push origin v1.0.0
if ($LASTEXITCODE -ne 0) { throw '标签推送失败，停止发布' }
```

这一步只更新仓库代码，不上传 Release 附件。

## 4. 创建并上传 Release

官方文档：[gh release create](https://cli.github.com/manual/gh_release_create)

```powershell
gh release create v1.0.0 `
  .\my-app-v1.0.0-windows.zip `
  .\my-app-v1.0.0.apk `
  .\SHA256SUMS.txt `
  --verify-tag --draft `
  --title "My App 1.0.0" `
  --notes "首个正式版本。"
```

这条命令要求远端标签已存在，上传附件并创建草稿。检查草稿后用 `gh release edit v1.0.0 --draft=false` 发布。标签指向构建附件对应的提交，不要让缺失标签默认指向远端默认分支的最新提交。

已有 Release 时，使用官方上传命令：[gh release upload](https://cli.github.com/manual/gh_release_upload)

```powershell
gh release upload v1.0.0 `
  .\my-app-v1.0.0-windows.zip `
  .\my-app-v1.0.0.apk `
  .\SHA256SUMS.txt
```

替换同名附件时增加 `--clobber`：

```powershell
gh release upload v1.0.0 .\my-app-v1.0.0.apk --clobber
```

## 5. 查看和下载

```powershell
gh release view v1.0.0
gh release list
gh release download v1.0.0 --dir .\release-check
```

```powershell
Get-FileHash .\release-check\my-app-v1.0.0.apk -Algorithm SHA256
```

## 6. 网页操作方式

官方文档：[Managing releases in a repository](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)

1. 打开仓库，进入 **Releases**。
2. 点击 **Draft a new release**。
3. 选择或创建标签，例如 `v1.0.0`。
4. 填写标题和发布说明。
5. 将安装包拖入附件区域。
6. 点击 **Publish release**。

网页操作和 `gh release create` 使用的是同一个 GitHub Release，只是入口不同。

## 7. 版本标签

常见形式是 `v主版本.次版本.修订版本`：

```text
v1.0.0
v1.1.0
v1.1.1
```

同一个标签对应一个 Release。发布新版本时创建新的标签，不要把新文件混到旧版本标签里。

## 8. 已推送标签后的最小示例

```powershell
gh auth status
Get-Item .\dist\my-app-v1.0.0.zip
gh release create v1.0.0 .\dist\my-app-v1.0.0.zip --verify-tag --draft --title "My App 1.0.0" --notes "首次发布"
gh release view v1.0.0
```

简单理解：`git push` 更新代码，`gh release create` 发布安装包，`gh release upload` 向已有版本补充附件。
