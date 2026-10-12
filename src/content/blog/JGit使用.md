---
title: JGit使用
createTime: '2026/03/01 19:23:46'
code: b1ncetof4
permalink: /blog/b1ncetof4/
tags:
  - Git
cover: 'https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/bg01.jpg'
---

JGit 是 Java 的 Git 实现。下面只做克隆，先把远程仓库和本地目录的关系跑通。

## 依赖与运行条件

本例使用 JDK 21 和 JGit `7.8.0.202609011348-r`。在已有 Maven 项目加入：

```xml
<dependency>
  <groupId>org.eclipse.jgit</groupId>
  <artifactId>org.eclipse.jgit</artifactId>
  <version>7.8.0.202609011348-r</version>
</dependency>
```

保存为 `src/main/java/CloneDemo.java`：

```java
import java.io.File;
import org.eclipse.jgit.api.Git;

public class CloneDemo {
    public static void main(String[] args) throws Exception {
        if (args.length != 2) {
            throw new IllegalArgumentException("参数：仓库 URL、本地空目录");
        }
        try (Git git = Git.cloneRepository()
                .setURI(args[0])
                .setDirectory(new File(args[1]))
                .setTimeout(60)
                .call()) {
            System.out.println("分支：" + git.getRepository().getBranch());
            System.out.println("目录：" + git.getRepository().getWorkTree());
        }
    }
}
```

在 IDE 中运行该 main 类，程序参数填：

```text
https://github.com/flycodeu/FlyCodeCenter.git ./cloned-flycodecenter
```

目标目录应为空或不存在，重复克隆到已有仓库会失败。`setTimeout(60)` 的单位是秒；返回的 `Git` 实例需要关闭。

## 常用公开配置

| 方法 | 用途 |
| --- | --- |
| `setURI` | 指定远程仓库地址 |
| `setDirectory` | 指定工作区目录 |
| `setBranch` | 选择检出的分支或引用，先确认它存在 |
| `setBare(true)` | 克隆裸仓库，只保存 Git 数据，没有普通工作区 |
| `setCloneAllBranches(true)` | 获取全部分支，不等同于指定全部标签 |
| `setCloneSubmodules(true)` | 同时初始化子模块 |
| `setNoCheckout(true)` | 获取仓库但跳过工作区检出 |

公开仓库通常不需要 Token。私有 HTTPS 仓库需要有权读取它的凭据；SSH 使用相应的 SSH 传输与密钥配置。不要把 CloneCommand 的内部状态字段当作可设置的公开 API。

提交与推送另见 [Java 中提交 Git 文件](/blog/bvyycunzy/)。

参考：[JGit 项目](https://projects.eclipse.org/projects/technology.jgit)、[JGit 7.8 API](https://download.eclipse.org/jgit/site/7.8.0.202609011348-r/apidocs/)。
