---
title: Redis管理用户登录状态
createTime: '2026/03/01 19:23:46'
code: bvz54msz2
permalink: /blog/bvz54msz2/
tags:
  - Redis
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/496a940d9a8095dd63d22e97dd8a2a34.jpg
---

Spring Session 把 HTTP Session 保存到 Redis，多实例可以读取同一会话。浏览器仍通过 Cookie 携带 Session ID；Redis 不是直接用来保存用户密码。

## 依赖与配置

下面适用于 Spring Boot 3.x 的 Servlet Web 项目，版本由项目的 Spring Boot BOM 管理。加入两个依赖：

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
<dependency>
  <groupId>org.springframework.session</groupId>
  <artifactId>spring-session-data-redis</artifactId>
</dependency>
```

先按 [Redis Docker 教程](/blog/b5v3zffdg/) 启动服务，再配置 `application.yaml`：

```yaml
spring:
  data:
    redis:
      host: 127.0.0.1
      port: 16379
  session:
    timeout: 30m
    redis:
      namespace: tutorial:session
server:
  servlet:
    session:
      cookie:
        http-only: true
        same-site: lax
```

Spring Boot 3 可根据依赖自动配置 Redis Session，不需要旧的 `spring.session.store-type`。`spring.data.redis.ttl` 不是控制 HTTP Session 过期的属性。

## 会话何时产生

登录代码将服务端确认的用户标识写入会话，例如 `request.getSession().setAttribute("userId", userId)`。登录成功应更新会话 ID；退出时调用 `session.invalidate()`。写入操作仍需由已有的认证逻辑决定，不能把任意客户端提交的 userId 当作已登录身份。

用浏览器完成一次登录，在开发者工具查看响应的 Session Cookie，再检查 Redis 中是否生成 `tutorial:session` 前缀的键。默认 Spring Session Cookie 常见名称为 `SESSION`，以实际响应为准。

`timeout` 是会话闲置过期时间，Cookie 的 `max-age` 是浏览器保存期限，两者作用不同。Cookie 还在并不代表服务端会话仍有效。使用 HTTPS 时再配置 `secure=true`，跨站 Cookie 还需结合 SameSite、CORS 和 CSRF 设计。

参考：[Spring Boot Session](https://docs.spring.io/spring-boot/3.5/reference/web/spring-session.html)、[Spring Session Redis](https://docs.spring.io/spring-session/reference/configuration/redis.html)。
