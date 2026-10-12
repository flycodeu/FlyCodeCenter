---
title: Java中使用Git提交代码
createTime: '2026/03/01 19:23:46'
code: bvyycunzy
permalink: /blog/bvyycunzy/
tags:
  - Git
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/22678c319934c0e968b1ef06041698b.jpg
---

下面在一个已有的本地仓库中创建笔记、提交并推送。先理解 [JGit 克隆仓库](/blog/b1ncetof4/)，并准备自己的测试仓库，不能把示例指向别人的仓库。

## 前置条件

- Maven 项目使用 JDK 21，依赖 `org.eclipse.jgit:org.eclipse.jgit:7.8.0.202609011348-r`。
- 本地仓库已克隆，当前检出普通分支，远程名为 `origin`。
- 已在该仓库配置提交者：`git config user.name "Your Name"`、`git config user.email "you@example.com"`。
- HTTPS 推送凭据由 `GIT_USERNAME`、`GIT_TOKEN` 环境变量提供，并拥有该仓库的写入权限。

## 代码

保存为 `src/main/java/CommitDemo.java`：

```java
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.lib.Constants;
import org.eclipse.jgit.transport.PushResult;
import org.eclipse.jgit.transport.RemoteRefUpdate;
import org.eclipse.jgit.transport.UsernamePasswordCredentialsProvider;

public class CommitDemo {
    public static void main(String[] args) throws Exception {
        if (args.length != 1) throw new IllegalArgumentException("参数：已有本地仓库目录");
        String username = System.getenv("GIT_USERNAME");
        String token = System.getenv("GIT_TOKEN");
        if (username == null || token == null) throw new IllegalStateException("请设置推送凭据环境变量");
        try (Git git = Git.open(new File(args[0]))) {
            String branch = git.getRepository().getFullBranch();
            if (branch == null || !branch.startsWith(Constants.R_HEADS)) {
                throw new IllegalStateException("请先检出一个普通分支，不能在 detached HEAD 推送");
            }
            if (!git.status().call().isClean()) throw new IllegalStateException("请先处理仓库现有修改");
            String relative = "notes/" + UUID.randomUUID() + ".md";
            Path file = git.getRepository().getWorkTree().toPath().resolve(relative);
            Files.createDirectories(file.getParent());
            Files.write(file, "Git tutorial\n".getBytes(StandardCharsets.UTF_8));
            git.add().addFilepattern(relative).call();
            git.commit().setMessage("docs: add tutorial note").call();
            Iterable<PushResult> results = git.push().setRemote("origin").add(branch)
                    .setTimeout(60)
                    .setCredentialsProvider(new UsernamePasswordCredentialsProvider(username, token))
                    .call();
            for (PushResult result : results) {
                for (RemoteRefUpdate update : result.getRemoteUpdates()) {
                    if (update.getStatus() != RemoteRefUpdate.Status.OK
                            && update.getStatus() != RemoteRefUpdate.Status.UP_TO_DATE) {
                        throw new IllegalStateException("推送未成功：" + update.getStatus());
                    }
                }
            }
            System.out.println("已推送：" + relative);
        }
    }
}
```

在 IDE 设置运行参数为本地测试仓库路径，再设置上述环境变量。推送不接受时，先检查 Token 权限、目标分支和远程新提交。推送失败不会自动撤销本地 commit；修复原因后继续推送，不要反复创建同一笔记或关闭分支保护。

`git.add()` 只暂存本次生成的文件；`commit()` 创建本地提交；`push()` 才更新远程。`call()` 返回并不保证每条远程引用都更新成功，因此检查 `RemoteRefUpdate` 状态。

参考：[JGit API](https://download.eclipse.org/jgit/site/7.8.0.202609011348-r/apidocs/)、[GitHub HTTPS 认证](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github)。
