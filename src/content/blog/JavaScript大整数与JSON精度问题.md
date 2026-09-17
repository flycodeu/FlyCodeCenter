---
title: JavaScript大整数与JSON精度问题
createTime: '2026/03/01 19:23:46'
code: b2puex53r
permalink: /blog/b2puex53r/
tags:
  - Java
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/7e598d39ffe7f2e174751f73207be9a5.jpg
---

## 精度丢失
JavaScript `Number` 的最大安全整数是 `2^53 - 1`（9007199254740991）。超过这个范围的整数可能在 JSON 解析为 Number 时丢失精度；随后再转字符串也无法恢复原值。标识符应由后端作为 JSON 字符串返回，或在前端解析原始 JSON 前使用支持大整数的方案。参见 [MDN 安全整数](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER)。
![](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/20250731142444.png)

## 解决Long精度丢失
主要是后端通过jackson将长整型的数字转换为字符串返回。
```java
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
