---
title: SpringBoot自定义实现日志记录
createTime: '2026/03/01 19:23:46'
code: bt05wy98x
permalink: /blog/bt05wy98x/
tags:
  - SpringBoot
---

日志切面可以记录操作名称、方法、结果和耗时。计时必须从业务方法调用前开始，并在异常时也记录结果。下面只写应用日志，先验证切面行为，再按需要加入审计存储。

## 运行条件

已有 Spring Boot 3.x Web 项目，加入 `spring-boot-starter-aop`。三个文件位于启动类扫描的 `example` 包中。

`OperationLog.java`：

```java
package example;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface OperationLog {
    String value();
}
```

`OperationLogAspect.java`：

```java
package example;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Aspect
@Component
public class OperationLogAspect {
    private static final Logger LOG = LoggerFactory.getLogger(OperationLogAspect.class);

    @Around("@annotation(operation)")
    public Object record(ProceedingJoinPoint call, OperationLog operation) throws Throwable {
        long started = System.nanoTime();
        boolean succeeded = false;
        String errorType = "";
        try {
            Object result = call.proceed();
            succeeded = true;
            return result;
        } catch (Throwable error) {
            errorType = error.getClass().getSimpleName();
            throw error;
        } finally {
            long elapsedMs = (System.nanoTime() - started) / 1_000_000;
            LOG.info("operation={} method={} succeeded={} elapsedMs={} errorType={}",
                    operation.value(), call.getSignature().toShortString(),
                    succeeded, elapsedMs, errorType);
        }
    }
}
```

`LogDemoController.java`：

```java
package example;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class LogDemoController {
    @OperationLog("读取演示状态")
    @GetMapping("/log-demo")
    public String read() { return "ok"; }
}
```

启动应用并访问 `http://localhost:8080/log-demo`，检查应用日志中是否出现 operation、method 和 elapsedMs。日志描述的是一次方法调用，不代表数据库事务已提交或异步任务已完成。

## 接入业务审计时

- 操作者从已经认证的上下文获取；日志切面不重新解析并打印 Token。
- 请求参数、响应内容按字段白名单提取并限制长度，不直接序列化全部对象。
- X-Forwarded-For 等代理头只有来自可信代理时才可用于识别来源，不能直接信任任意客户端提供的值。
- 异步入库要有有界队列、失败处理和关闭流程；审计是否允许丢失由业务决定。

Spring AOP 依靠代理拦截调用，同一个对象里的 `this.method()` 通常不会再次经过代理。对异步、响应式方法计时，需要覆盖实际任务生命周期，不能仅测返回 Future 或 Flux 的速度。

参考：[Spring AOP 代理机制](https://docs.spring.io/spring-framework/reference/core/aop/proxying.html)。
