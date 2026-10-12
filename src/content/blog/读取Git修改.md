---
title: 读取Git修改
createTime: '2026/03/01 19:23:46'
code: b1ymnjbdi
permalink: /blog/b1ymnjbdi/
tags:
  - Java
  - Git
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/b0accf531a544795e92b0c042a29563.jpg
---

先在仓库目录用 Git 命令确认想读取什么，再从 Java 调用。已提交的差异和未提交的差异是不同对象。

```bash
git log -1 --format="%H%n%an%n%aI%n%s"
git diff HEAD~1 HEAD --
git diff --
git diff --cached --
```

第二条比较最近两个提交，要求存在父提交。第三条读取工作区相对暂存区的修改，第四条读取暂存区相对 HEAD 的修改；普通 diff 不包含未跟踪文件。

## Java 中读取命令输出

JDK 8 或更高版本，Git 已安装且位于 PATH。保存为 `GitInfoDemo.java`，在一个已有提交的 Git 仓库目录运行：

```java
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

public class GitInfoDemo {
    public static String run(String... command) throws IOException, InterruptedException {
        Path output = Files.createTempFile("git-tutorial-", ".txt");
        Process process = null;
        try {
            process = new ProcessBuilder(command)
                    .redirectErrorStream(true)
                    .redirectOutput(output.toFile())
                    .start();
            if (!process.waitFor(30, TimeUnit.SECONDS)) {
                throw new IOException("Git 命令超时");
            }
            if (Files.size(output) > 1024 * 1024) throw new IOException("输出超过示例的 1 MiB 上限");
            String text = new String(Files.readAllBytes(output), StandardCharsets.UTF_8);
            if (process.exitValue() != 0) throw new IOException("Git 退出码 " + process.exitValue() + ": " + text);
            return text;
        } finally {
            if (process != null && process.isAlive()) {
                process.destroyForcibly();
                process.waitFor(5, TimeUnit.SECONDS);
            }
            Files.deleteIfExists(output);
        }
    }

    public static void main(String[] args) throws Exception {
        System.out.print(run("git", "log", "-1", "--format=%H%n%an%n%aI%n%s"));
        System.out.print(run("git", "diff", "--"));
    }
}
```

```bash
javac -encoding UTF-8 GitInfoDemo.java
java GitInfoDemo
```

`ProcessBuilder` 每个参数单独传，不拼接 shell 命令。临时文件避免标准输出管道填满后互相等待；超时会终止进程，非零退出码会连同错误信息报告。最后保留原始换行，而不是只读取第一行。

本例限制读取到内存的大小，输出文件在进程运行期间仍可能增长；自动化服务应进一步限制磁盘和进程资源。Git 输出可能含源码和个人信息，发送给外部模型前需要核对传输范围。

参考：[git diff](https://git-scm.com/docs/git-diff)、[git log](https://git-scm.com/docs/git-log)。
