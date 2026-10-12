---
title: Github Actions使用
createTime: '2026/03/01 19:23:46'
code: b1e46tgp0
permalink: /blog/b1e46tgp0/
tags:
  - Actions
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/990667183ad3256336a04340846abae.jpg
---

GitHub Actions 在仓库发生指定事件时运行工作流。先让它执行项目已有的构建和测试命令，再考虑部署。

## 运行 Maven 测试

下面要求仓库根目录已有 `pom.xml`，项目能在 Java 21 下构建。保存为 `.github/workflows/maven.yml`：

```yaml
name: Maven checks
on:
  push:
    branches: [master]
  pull_request:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-java@v5
        with:
          distribution: temurin
          java-version: '21'
          cache: maven
      - run: mvn --batch-mode --no-transfer-progress verify
```

`master` 是示例目标分支；仓库用 `main` 时同步替换。`verify` 包含前面的构建阶段，但是否执行单元和集成测试仍由 `pom.xml` 决定。项目有 Maven Wrapper 时可改为 `./mvnw --batch-mode verify`。

## 查看结果

提交工作流并推送到对应分支，在仓库 **Actions** 页面打开此次运行，查看失败步骤的日志。先在本地执行相同的 Maven 命令，有助于区分代码问题和 Runner 环境问题。

工作流使用的 checkout/setup-java 主版本已经固定；需要更严格的可复现性时，可按官方发布页固定完整提交 SHA。自托管 Runner 还要核对 Node 运行时要求。

## 读取提交差异时的区别

默认 checkout 只拉取较浅的历史。如果脚本使用 `HEAD~1`，第一次提交没有父提交；PR 的默认检出还可能是合并引用，不能把 `HEAD~1` 当作任意 PR 的基准。

需要历史时设置 `fetch-depth: 0`，并按事件选取基准 SHA。`push` 可使用事件中的 before/after；PR 应比较明确的 base/head，或使用 GitHub 的 PR 文件接口。外部分支 PR 不应依赖仓库 Secrets。

参考：[GitHub Actions](https://docs.github.com/en/actions)、[checkout](https://github.com/actions/checkout)、[setup-java](https://github.com/actions/setup-java)。
