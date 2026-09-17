---
title: 密码哈希与Shiro历史数据迁移
createTime: '2026/03/01 19:23:46'
code: b1zkj0k3j
permalink: /blog/b1zkj0k3j/
tags:
  - shiro
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/54a61c380016520913632d86c850a39.jpg
---

旧项目中常见 `Shiro SimpleHash("MD5", password, salt, 1024)`。它计算的是密码哈希，不能解密；加盐和重复计算也不能把 MD5 变成适合新系统的密码存储方案。

## 新密码使用自适应哈希

在 Spring Security 项目中，可使用 `PasswordEncoder` 统一生成和校验密码哈希。下面使用委托编码器：默认以 bcrypt 编码，并在结果前保存算法标识，便于以后迁移。具体机制见 [Spring Security 密码存储文档](https://docs.spring.io/spring-security/reference/features/authentication/password-storage.html)。

```java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class PasswordConfig {
    @Bean
    public PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }
}
```

注册和修改密码时保存 `encode()` 的完整结果。登录时使用 `matches()`，不能重新 `encode()` 后直接比较字符串，因为每次编码会生成新的随机盐。

```java
String storedHash = passwordEncoder.encode(rawPassword);
boolean matched = passwordEncoder.matches(presentedPassword, storedHash);
```

算法标识、盐和成本参数随编码结果一起保存，不要截断。工作因子需要在实际服务器上测量，兼顾密码校验成本和登录吞吐。

## 兼容历史 Shiro 数据

若数据库已经保存旧哈希，不能直接替换算法后要求新旧结果相等。迁移过程应保留原算法、盐处理方式和迭代次数：

1. 查询用户记录，确认该记录采用的算法。
2. 旧记录使用原校验逻辑；新记录使用对应的 `PasswordEncoder`。
3. 用户通过旧密码校验后，用本次提交的明文密码生成新哈希，再更新算法标识和密码字段。
4. 无法完成兼容校验的用户走重置密码流程。

旧数据如果先对盐做过一次 MD5，兼容校验也要保持该行为；这只是历史格式约束，不是增强盐安全性的步骤。迁移逻辑应通过旧系统生成的测试向量验证，不能随意编造一段十六进制字符串当作计算结果。

## 传输与存储分开处理

Base64 是编码，不提供保密性。登录请求使用 HTTPS，密码不写入日志、URL 或浏览器持久存储。数据库中的密码哈希也不能作为客户端登录凭据直接发送。
