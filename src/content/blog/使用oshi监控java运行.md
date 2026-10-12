---
title: 使用oshi监控java运行
createTime: '2026/03/01 19:23:46'
code: bjnavexot
permalink: /blog/bjnavexot/
tags:
  - SpringBoot
---

OSHI 读取主机硬件与操作系统信息，Java 管理接口读取当前 JVM。先区分主机内存、JVM 堆内存和进程驻留内存，它们不是同一个指标。

## 依赖与采样

下面使用 Java 21、OSHI 7.7.1，在 Maven 项目添加：

```xml
<dependency>
  <groupId>com.github.oshi</groupId>
  <artifactId>oshi-core</artifactId>
  <version>7.7.1</version>
</dependency>
```

保存 `SystemSample.java`：

```java
import java.lang.management.ManagementFactory;
import oshi.SystemInfo;

public class SystemSample {
    public static void main(String[] args) throws InterruptedException {
        var info = new SystemInfo();
        var hardware = info.getHardware();
        var cpu = hardware.getProcessor();
        long[] before = cpu.getSystemCpuLoadTicks();
        Thread.sleep(1000);
        double load = cpu.getSystemCpuLoadBetweenTicks(before);
        System.out.printf("主机 CPU（采样区间）：%.1f%%%n", load * 100);
        var memory = hardware.getMemory();
        System.out.printf("主机内存：total=%.1f MiB, available=%.1f MiB%n",
                memory.getTotal() / 1048576.0, memory.getAvailable() / 1048576.0);
        var heap = ManagementFactory.getMemoryMXBean().getHeapMemoryUsage();
        System.out.printf("当前 JVM 堆：used=%.1f MiB, committed=%.1f MiB, max=%d bytes%n",
                heap.getUsed() / 1048576.0, heap.getCommitted() / 1048576.0, heap.getMax());
    }
}
```

在项目目录运行：

```powershell
mvn package dependency:copy-dependencies
java -cp 'target/classes;target/dependency/*' SystemSample
```

项目需配置 Java 编译版本，完整 Maven 结构可参考 [Java HTML 示例](/blog/bjhex8h9z/)，将它的依赖替换成 OSHI。Linux/macOS 的 classpath 分隔符改为冒号。

## 指标怎么读

CPU 是两次计数之间的平均占用，单次累计 tick 不是当前使用率。示例等待一秒是采样需要，不能让每个 HTTP 请求同步等待一秒；后台按固定间隔采样，接口返回最近快照和采样时间。

OSHI 的内存单位是字节，除以 1024² 后标为 MiB。JVM committed 是已提交容量，max 是上限，max 为 -1 表示未定义；堆占用不能代表整个 Java 进程占用。容器内的主机信息与资源限额还需分别核对。

前端不要用 `value ? value : '-'` 显示数值，0 是有效结果，应使用 `value ?? '-'`。采样失败显示未知和时间，不填 0 冒充正常。

参考：[OSHI](https://github.com/oshi/oshi)、[MemoryUsage](https://docs.oracle.com/en/java/javase/21/docs/api/java.management/java/lang/management/MemoryUsage.html)。
