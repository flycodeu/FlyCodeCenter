---
title: SpringBoot结合七牛云
createTime: '2026/03/01 19:23:46'
code: bzjza4ilr
permalink: /blog/bzjza4ilr/
tags:
  - SpringBoot
  - 对象存储
---

文件上传先确认 HTTP 收到文件，再写入七牛空间，最后确认浏览器能访问。对象 key、磁盘路径和下载 URL 是不同的值；上传成功不保证直接拼出的地址能访问私有文件。

## 依赖和配置

下面用于已有 Java 21 / Spring Boot 3 项目，添加 Web starter 与固定 SDK 版本：

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-web</artifactId>
</dependency>
<dependency>
  <groupId>com.qiniu</groupId>
  <artifactId>qiniu-java-sdk</artifactId>
  <version>7.19.0</version>
</dependency>
```

保存配置，运行环境设置四个变量。QINIU_DOMAIN 使用空间绑定且可访问的 HTTPS 下载域名，末尾不带斜杠：

```yaml
spring:
  servlet:
    multipart:
      max-file-size: 5MB
      max-request-size: 6MB
qiniu:
  access-key: ${QINIU_ACCESS_KEY}
  secret-key: ${QINIU_SECRET_KEY}
  bucket: ${QINIU_BUCKET}
  domain: ${QINIU_DOMAIN}
```

## 保存上传控制器

`QiniuUploadController.java` 放在启动类扫描范围，包名改成自己的。示例按华东 region0 配置，其他区域必须按空间所在地修改。

```java
package example;

import java.util.Map;
import java.util.UUID;
import com.qiniu.storage.Configuration;
import com.qiniu.storage.Region;
import com.qiniu.storage.UploadManager;
import com.qiniu.util.Auth;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class QiniuUploadController {
    private final Auth auth;
    private final String bucket;
    private final String domain;
    private final UploadManager uploader;

    public QiniuUploadController(@Value("${qiniu.access-key}") String access,
            @Value("${qiniu.secret-key}") String secret,
            @Value("${qiniu.bucket}") String bucket,
            @Value("${qiniu.domain}") String domain) {
        this.auth = Auth.create(access, secret);
        this.bucket = bucket;
        this.domain = domain.replaceAll("/+$", "");
        var config = Configuration.create(Region.region0());
        config.connectTimeout = 5;
        config.readTimeout = 15;
        config.writeTimeout = 15;
        this.uploader = new UploadManager(config);
    }

    @PostMapping("/api/images")
    public Map<String, Object> upload(@RequestParam("file") MultipartFile file)
            throws Exception {
        if (file.isEmpty() || file.getSize() > 5L * 1024 * 1024) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "文件大小不符合要求");
        }
        byte[] bytes = file.getBytes();
        boolean png = bytes.length >= 8 && bytes[0] == (byte) 0x89
                && bytes[1] == 0x50 && bytes[2] == 0x4e && bytes[3] == 0x47
                && bytes[4] == 0x0d && bytes[5] == 0x0a
                && bytes[6] == 0x1a && bytes[7] == 0x0a;
        boolean jpg = bytes.length >= 3 && bytes[0] == (byte) 0xff
                && bytes[1] == (byte) 0xd8 && bytes[2] == (byte) 0xff;
        if (!png && !jpg) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "只接受 PNG/JPEG 签名文件");
        }
        String key = "tutorial/" + UUID.randomUUID() + (png ? ".png" : ".jpg");
        String token = auth.uploadToken(bucket, key, 300, null);
        var response = uploader.put(bytes, key, token);
        try {
            if (!response.isOK()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "对象存储上传失败");
            }
        }
        finally { response.close(); }
        String url = auth.privateDownloadUrl(domain + "/" + key, 300);
        return Map.of("errno", 0, "data", Map.of("key", key, "url", url));
    }
}
```

SDK 的超时单位为秒。内容签名是基础格式检查，不是完整图片解码验证；面向公网应进一步限制像素数量并按需要重新编码。文件名由服务端生成，避免原文件名变成路径。这个例子以内存缓冲上传小图片，不用于大视频。

## 发送一次请求

只在本机实验启动服务，使用自己的图片：

```powershell
curl.exe --fail --form 'file=@demo.png' http://127.0.0.1:8080/api/images
```

返回 errno=0 和 data.url 后，马上在浏览器打开 URL，核对图片和空间内的 key。签名地址示例五分钟后过期，不应永久写入文章；数据库保存 key，展示时由后端重新鉴权并生成 URL。已有 Spring Security 项目还要按认证和 CSRF 协议发送请求。

这里没有提供公网身份认证和配额，接入项目后须加在上传接口前。网页的 `accept="image/*"` 只是选择提示，不能替代后端校验。

本地保存文件同样可以使用配置目录，不需要 `ServletContext.getRealPath("")`；可执行 JAR 中这个值可能为空。磁盘文件还需下载接口或资源映射，不能把磁盘路径直接返回当图片 URL。

参考：[七牛 Java SDK](https://developer.qiniu.com/kodo/sdk/java)、[资源外链](https://developer.qiniu.com/kodo/kb/1321/how-to-acquire-the-outside-storage-file-links)。
