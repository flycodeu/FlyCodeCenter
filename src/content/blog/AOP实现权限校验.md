---
title: AOP实现权限校验
createTime: '2026/03/01 19:23:46'
code: b95ilnego
permalink: /blog/b95ilnego/
tags:
  - AOP
---

AOP 在调用业务方法前检查权限。权限来源必须是服务端已验证的身份；不能信任请求里自报的角色，也不能把未知角色当作无需权限而放行。

下面用于已经配置 Spring Security 登录的 Spring Boot 3.x 项目，需要 `spring-boot-starter-aop` 和 `spring-boot-starter-security`。三个文件放在启动类扫描的 `example` 包下。

## 定义角色注解

`RequireRole.java`：

```java
package example;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RequireRole {
    Role value();
    enum Role { USER, ADMIN }
}
```

用枚举限制可声明的角色，拼错角色名会在编译阶段失败。

## 方法执行前校验

`RoleAspect.java`：

```java
package example;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Aspect
@Component
public class RoleAspect {
    @Around("@annotation(required)")
    public Object check(ProceedingJoinPoint call, RequireRole required) throws Throwable {
        Authentication user = SecurityContextHolder.getContext().getAuthentication();
        if (user == null || !user.isAuthenticated() || user instanceof AnonymousAuthenticationToken) {
            throw new AuthenticationCredentialsNotFoundException("请先登录");
        }
        String authority = "ROLE_" + required.value().name();
        boolean allowed = user.getAuthorities().stream()
                .anyMatch(granted -> authority.equals(granted.getAuthority()));
        if (!allowed) throw new AccessDeniedException("没有所需角色");
        return call.proceed();
    }
}
```

这里约定权限为 `ROLE_USER` / `ROLE_ADMIN`。ADMIN 不会自动包含 USER；需要层级关系时必须明确配置。

## 使用与验证

`RoleDemoController.java`：

```java
package example;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RoleDemoController {
    @RequireRole(RequireRole.Role.ADMIN)
    @GetMapping("/role-demo")
    public String read() { return "admin data"; }
}
```

用未登录、普通用户、管理员分别请求 `/role-demo`。前两者不能进入业务方法，管理员得到 `admin data`。API 的 401 / 403 响应由现有安全过滤链和异常处理共同决定，不能被全局 RuntimeException 处理器转换为成功响应。

同一对象内 `this.read()` 通常绕过 Spring 代理，切面不能覆盖这种调用。常规项目可以优先使用 Spring Security 的 `@EnableMethodSecurity` 与 `@PreAuthorize("hasRole('ADMIN')")`，不必额外维护相同的角色切面。

参考：[Spring AOP 代理](https://docs.spring.io/spring-framework/reference/core/aop/proxying.html)、[Spring Security 方法授权](https://docs.spring.io/spring-security/reference/servlet/authorization/method-security.html)。
