---
title: git忽略提交文件集合
createTime: '2026/03/01 19:23:46'
code: b2n5c43s0
permalink: /blog/b2n5c43s0/
tags:
  - Git
---

## 忽略文件集合
```gitignore

HELP.md
.gradle
build/
!gradle/wrapper/gradle-wrapper.jar
!**/src/main/**/build/
!**/src/test/**/build/

### STS ###
.apt_generated
.classpath
.factorypath
.project
.settings
client.xml
.springBeans
.sts4-cache

### IntelliJ IDEA ###
.idea
*.iws
*.iml
*.ipr
out/
!**/src/main/**/out/
!**/src/test/**/out/

### NetBeans ###
/nbproject/private/
/nbbuild/
/dist/
/nbdist/
/.nb-
### VS Code ###
.vscode/

### maven ###
target/
*.class
*.war
*.ear
*.zip
*.tar
*.tar.gz
.idea/
```

## gitignore文件不生效
`.gitignore` 只影响未跟踪文件。已经跟踪的文件需从索引中移除；只指定需要忽略的路径，不必清空整个仓库的索引。这个操作保留工作区文件，也不会删除历史提交中的内容。参见 [Git ignore 文档](https://git-scm.com/docs/gitignore)。
```bash
git rm --cached -- path/to/local-config
git add .gitignore
git diff --cached
```
