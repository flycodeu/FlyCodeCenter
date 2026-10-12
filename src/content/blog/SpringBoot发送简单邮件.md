---
title: SpringBoot发送简单邮件
createTime: '2026/03/01 19:23:46'
code: b1dkdwda0
permalink: /blog/b1dkdwda0/
tags:
  - SpringBoot
  - 邮件
---

下面使用 Spring Boot 3、Java 17 以上版本，通过 SMTP 发送纯文本或 HTML 邮件。SMTP 授权码和网页登录密码可能不同，以邮箱服务商说明为准。

## 依赖与配置

在已有 Spring Boot 项目添加依赖，由 Boot 管理版本：

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-mail</artifactId>
</dependency>
```

`application.yml` 示例使用 SMTPS 465。服务器、端口与 TLS 模式必须和服务商一致；使用 STARTTLS 587 时不要照抄这份 SSL 配置。

```yaml
spring:
  mail:
    host: ${SMTP_HOST}
    port: 465
    username: ${SMTP_USER}
    password: ${SMTP_PASSWORD}
    default-encoding: UTF-8
    properties:
      mail.smtp.auth: true
      mail.smtp.ssl.enable: true
      mail.smtp.connectiontimeout: 5000
      mail.smtp.timeout: 5000
      mail.smtp.writetimeout: 5000
```

通过运行环境设置这三个变量，不提交授权码。保存下面的 `MailService.java` 到启动类扫描范围，包名改成自己的：

```java
package example;

import jakarta.mail.MessagingException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class MailService {
    private final JavaMailSender sender;
    private final String from;

    public MailService(JavaMailSender sender,
                       @Value("${spring.mail.username}") String from) {
        this.sender = sender;
        this.from = from;
    }

    public void sendText(String to, String subject, String text) {
        SimpleMailMessage mail = new SimpleMailMessage();
        mail.setFrom(from);
        mail.setTo(to);
        mail.setSubject(subject);
        mail.setText(text);
        sender.send(mail);
    }

    public void sendHtml(String to, String subject, String html)
            throws MessagingException {
        var mail = sender.createMimeMessage();
        var helper = new MimeMessageHelper(mail, false, "UTF-8");
        helper.setFrom(from);
        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(html, true);
        sender.send(mail);
    }
}
```

从已有业务方法注入 `MailService` 后，调用 `sendText(自己的收件邮箱, "SMTP 测试", "这是一封测试邮件")`。不要把真实发送放进每次自动运行的测试；单元测试用模拟的 JavaMailSender 检查邮件内容。

## 怎样判断成功

`sender.send` 无异常说明 SMTP 服务器接受了这次提交，不代表邮件最终进入收件箱。首次只发给自己的邮箱，同时查看垃圾邮件和退信。

连接超时先查主机、端口与网络；认证失败查 SMTP 是否开启、授权码和发件地址；SSL 错误查 TLS 模式与证书。不要通过关闭证书校验解决问题。

参考：[Spring Boot 邮件配置与超时](https://docs.spring.io/spring-boot/reference/io/email.html)。
