---
title: Spring-Validation注解实现校验
createTime: '2026/03/01 19:23:46'
code: b1abyg6dj
permalink: /blog/b1abyg6dj/
tags:
  - SpringBoot
---

参数校验用于检查输入格式和范围。它不会代替权限、数据归属或数据库唯一约束。下面使用 Java 17+、Spring Boot 3.x 和 `jakarta.validation`。

## 加入依赖

在已有 Spring MVC 项目加入 Validation starter，版本由 Spring Boot 管理：

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-validation</artifactId>
</dependency>
```

## 定义请求对象

将下面类放在启动类能够扫描的包下，按文件名保存。本例包名为 `example`。

`RegistrationRequest.java`：

```java
package example;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegistrationRequest(
        @NotBlank(message = "用户名不能为空")
        @Size(min = 4, max = 10, message = "用户名长度为4到10") String username,
        @NotBlank(message = "手机号不能为空")
        @Pattern(regexp = "^1[3-9][0-9]{9}$", message = "手机号格式不正确") String phone,
        @NotNull @Valid Address address) {
    public record Address(@NotBlank String city) {}
}
```

`@Valid` 向嵌套对象继续校验，`@NotNull` 检查 address 是否存在。手机号正则只检查示例格式，不验证号码真实归属；`@Size` 的 String 长度基于 UTF-16 单元，不等于任意 Unicode 文本的可见字数。

`ValidationController.java`：

```java
package example;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ValidationController {
    @PostMapping("/validation/user")
    public Map<String, String> check(@Valid @RequestBody RegistrationRequest body) {
        return Map.of("result", "校验通过");
    }

    public record Batch(@NotEmpty @Valid List<RegistrationRequest> users) {}

    @PostMapping("/validation/batch")
    public Map<String, Integer> checkBatch(@Valid @RequestBody Batch body) {
        return Map.of("count", body.users().size());
    }
}
```

这里返回校验结果，没有保存数据库。批量输入用包装 DTO，不必为了校验复制整个 List 实现。

## 返回 400 与错误信息

`ValidationErrors.java`：

```java
package example;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ValidationErrors {
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Map<String, List<String>> invalid(MethodArgumentNotValidException error) {
        return Map.of("errors", error.getBindingResult().getFieldErrors().stream()
                .map(field -> field.getField() + ": " + field.getDefaultMessage()).toList());
    }
}
```

不要把参数错误一律包装成 HTTP 200；异常处理也不应回传 rejectedValue，以免回显密码等输入。

## 自己验证

启动应用后，用 PowerShell 发送 JSON：

```powershell
$payload = @{ username = 'demo'; phone = '13800138000'; address = @{ city = '杭州' } } | ConvertTo-Json
Invoke-RestMethod 'http://localhost:8080/validation/user' -Method Post -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($payload))
```

应返回“校验通过”。把 username 改为 `a`，应得到 400；把 address 改为 null，或 city 改为空字符串，也应失败。批量接口输入格式为 `{"users":[...]}`，空数组应失败。

## 分组与方法参数

创建和更新需要不同规则时，用 groups 指定约束所属组，入口用 `@Validated(组.class)` 选择它。选择自定义组后，不会自动同时执行 Default 组；需要同时执行时显式把 `Default.class` 加入。

Spring Framework 6.1+ 的 MVC 内置方法校验会处理直接放在参数上的约束，可能抛出 `HandlerMethodValidationException`。类级 `@Validated` 则走 AOP 方法校验方式，不要混用旧异常处理代码而假设所有校验都会抛同一种异常。

参考：[Spring MVC Validation](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-validation.html)、[Jakarta Validation](https://jakarta.ee/specifications/bean-validation/3.0/jakarta-bean-validation-spec-3.0.html)。
