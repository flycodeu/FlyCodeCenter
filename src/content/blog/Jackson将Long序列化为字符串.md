---
title: Jackson将Long序列化为字符串
createTime: '2026/03/01 19:23:46'
code: b1ckhf6gb
permalink: /blog/b1ckhf6gb/
tags:
  - SpringBoot
---

## 精度丢失问题

JavaScript `Number` 的最大安全整数是 `2^53 - 1`（9007199254740991）。超过这个范围的整数可能在 JSON 解析为 Number 时丢失精度；随后再转字符串也无法恢复原值。标识符应由后端作为 JSON 字符串返回，或在前端解析原始 JSON 前使用支持大整数的方案。参见 [MDN 安全整数](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER)。

## 后端处理

主要就是使用jackson将Long类型转换为String给前端

```java
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;

/**
 * Spring MVC Json 配置
 */
@Configuration
public class JsonConfig {

    /**
     * 添加 Long 转 json 精度丢失的配置
     */
    @Bean
    public ObjectMapper jacksonObjectMapper(Jackson2ObjectMapperBuilder builder) {
        ObjectMapper objectMapper = builder.createXmlMapper(false).build();
        SimpleModule module = new SimpleModule();
        module.addSerializer(Long.class, ToStringSerializer.instance);
        module.addSerializer(Long.TYPE, ToStringSerializer.instance);
        objectMapper.registerModule(module);
        return objectMapper;
    }
}
```

全局注册会把所有 `Long`（包括计数等字段）序列化为字符串，需要同步接口契约。只处理 ID 时可在相应字段上配置 `@JsonSerialize(using = ToStringSerializer.class)`。
