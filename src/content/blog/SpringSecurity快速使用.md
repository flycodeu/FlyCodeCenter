---
title: Spring Security 入门：登录与接口权限
createTime: '2026/03/01 19:23:46'
code: b19w55cur
permalink: /blog/b19w55cur/
tags:
  - SpringBoot
---

下面使用 Spring Boot 3.x、Spring Security 6 和 Java 17+，在已有 Spring MVC 项目中配置两个本地练习账号。先验证公开、登录和管理员入口，再接自己的用户数据库。

## 依赖和密码配置

在 `pom.xml` 加入：

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-security</artifactId>
</dependency>
```

`application.yaml` 加入：

```yaml
demo:
  admin-password: ${DEMO_ADMIN_PASSWORD}
  reader-password: ${DEMO_READER_PASSWORD}
```

启动前在自己的终端设置这两个环境变量。它们只用于演示账号，不能作为生产默认账号配置。

## 安全过滤链

保存为启动类扫描包下的 `SecurityConfig.java`，本例包名为 `example`：

```java
package example;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {
    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    @Bean
    UserDetailsService users(PasswordEncoder encoder,
            @Value("${demo.admin-password}") String adminPassword,
            @Value("${demo.reader-password}") String readerPassword) {
        return new InMemoryUserDetailsManager(
                User.withUsername("admin").password(encoder.encode(adminPassword)).roles("ADMIN").build(),
                User.withUsername("reader").password(encoder.encode(readerPassword)).roles("USER").build());
    }

    @Bean
    SecurityFilterChain security(HttpSecurity http) throws Exception {
        return http.authorizeHttpRequests(auth -> auth
                        .requestMatchers("/public").permitAll()
                        .requestMatchers("/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated())
                .formLogin(Customizer.withDefaults())
                .httpBasic(Customizer.withDefaults())
                .build();
    }
}
```

`roles("ADMIN")` 对应权限字符串 `ROLE_ADMIN`。配置保留默认 CSRF 防护；Cookie 会话下的修改请求需要正确携带 CSRF Token，不能为了消除 403 直接关闭防护。

## 验证接口

保存 `SecurityDemoController.java`：

```java
package example;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SecurityDemoController {
    @GetMapping("/public")
    public String publicData() { return "public data"; }
    @GetMapping("/admin/data")
    public String adminData() { return "admin data"; }
}
```

应用默认在 8080 时，PowerShell 中运行：

```powershell
curl.exe -i http://localhost:8080/public
curl.exe -i -u reader http://localhost:8080/admin/data
curl.exe -i -u admin http://localhost:8080/admin/data
```

`curl -u 用户名` 会提示输入密码。公开接口返回 200，reader 请求管理员接口得到 403，admin 得到 200。浏览器还可以访问 `/login` 使用默认登录表单；未登录请求的响应形式可能是登录重定向或 HTTP 认证提示，取决于请求协商和入口配置。

内存账号随进程重建，不能保存注册、改密和长期用户数据。迁移到数据库时实现相应的 UserDetailsService，并保留密码编码、禁用状态及权限规则。

参考：[Spring Security Servlet 入门](https://docs.spring.io/spring-security/reference/servlet/getting-started.html)、[请求授权](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html)。
