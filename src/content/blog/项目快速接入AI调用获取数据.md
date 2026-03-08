---
title: 项目快速接入AI调用获取数据
createTime: '2026/02/24 14:42:51'
code: rk410s73
permalink: /article/9slaraza/
---
# 1. 目标与约束

## 1.1 目标

在现有 Spring Boot（Java 8）+ MyBatis Plus + MySQL 项目中引入 AI 模块，实现：

1. **自然语言 → 接口调用**：用户输入“查看相机状态”，系统自动选择并调用对应后端接口/SQL。
2. **参数抽取**：对需要参数的接口，自动解析并生成符合约束的入参。
3. **多表联查与富媒体返回**：对返回图片 URL 的业务结果，输出 `images` 类型 UI Block，前端可直接渲染图片墙/轮播。
4. **可扩展**：新增能力只需新增“工具（Tool）”并声明入参 Schema；Router 自动可用。
5. **可维护**：提示词（Router/Composer）可版本化、可灰度发布、可回滚。
6. **可观测**：全链路日志可回放，包括 Router 计划、工具调用、耗时、输出 blocks。

## 1.2 约束与边界

- AI 模块不直接访问数据库；所有事实数据由后端工具（Mapper/Service）产生。
- Router 输出必须是**严格 JSON**，用于后端解析与校验；非 JSON 内容视为失败并触发降级策略。
- 工具调用入参必须通过 Schema 约束校验（字段白名单 + 类型约束），防止模型生成无效或危险参数。
- Composer 的文本输出必须来源于工具结果；禁止无依据推断业务数据。

------

# 2. 架构设计

## 2.1 总体流程

1. **Router**：将用户输入映射为结构化 `RouterPlan(JSON)`（工具名 + 参数）。
2. **ToolExecutor**：根据工具注册表执行对应工具，获得 `ToolResult(blocks, raw)`。
3. **Composer**：将工具结果组织为 `AiChatResponse(answer + blocks)`。
4. **Logging**：落库保存 RouterPlan、工具 traces、响应 blocks、耗时等。

## 2.2 分层职责

### Router（决策层）

- 输入：用户 query、上下文（可选）
- 输出：`RouterPlan`（仅包含工具调用计划）
- 非职责：生成业务事实数据、编写 SQL、推断数据库状态

### Tools（能力层）

- 输入：`args`（Map），并由 Schema 校验
- 输出：`ToolResult`（结构化 UI Blocks + 可选 raw）
- 职责：调用 Mapper/Service、执行多表联查、返回图片 URL

### Composer（表达层）

- 输入：工具结果
- 输出：面向用户的文本摘要 + blocks
- 可实现两种模式：
  - **模板模式（推荐初期）**：零幻觉、可控
  - **LLM 模式（可选）**：提升可读性，但仅允许基于工具结果重述

------

# 3. 数据协议

## 3.1 RouterPlan（Router 输出）

```
{
  "action": "tool_call|need_clarification|direct_answer",
  "calls": [
    {"name":"camera.status.count","args":{}}
  ],
  "clarify": "",
  "directAnswer": ""
}
```

## 3.2 ToolResult（工具输出）

- `blocks`：前端直接渲染所需结构
- `raw`：可选，供 Composer/排障使用

支持 Block 类型：

- `table`：表格
- `images`：图片列表（url + caption）
- `cards`：卡片
- `text`：文本
- `graph`：关系图（后续扩展）

------

# 4. 与现有接口的映射（无参能力）

给定 Mapper 接口：

```
@Select("select camera_status as cameraStatus,count(*) as count from CamHub.hm_camera_device where is_deleted = 0 group by camera_status")
List<CameraStatusCountVO> countByCameraStatusCountVos();

@Select("select cd.camera_name as cameraName,cd.ip,cd.camera_status as cameraStatus,cd.last_online_time as lastOnlineTime,cg.group_name as groupName from CamHub.hm_camera_device cd left join CamHub.hm_camera_group cg on cd.group_id = cg.id order by cd.create_time desc ")
List<CameraDeviceVo> listCameraDeviceVo();
```

在工具层分别封装为：

- `camera.status.count`（无参）
- `camera.device.list`（无参）

工具输出使用 `table` block，附带 `meta.columns` 与 `meta.valueMap`（例如 status 映射 0/1 → 离线/在线）。

------

# 5. 有参接口与多表联查示例设计

## 5.1 有参接口（示例：按条件查询相机）

工具：`camera.device.search`

- 入参（Schema 约束）：
  - `status`：0/1（可选）
  - `groupName`：string（可选）
  - `nameLike`：string（可选）
  - `limit`：int（默认 50，上限 200）

## 5.2 多表联查 + 图片 URL（示例：离线相机 + 最新抓拍）

工具：`camera.offline.latestSnapshots`

- 入参：
  - `groupName`（可选）
  - `limit`（默认 20）
- SQL：device(离线) + snapshot(最新一张) join/group
- 输出：
  - `table`：离线相机列表（名称/IP/分组/最后在线/抓拍时间）
  - `images`：抓拍图片列表（url + caption）

------

# 6. Prompt 版本化与灰度发布

## 6.1 版本化原则

- Router/Composer prompt 存储在 `ai_prompt_release` 表，按 `prompt_name` + `version` 区分。
- Prompt 发布时支持多版本同时启用，按 `traffic_percent` 分流。
- Prompt 使用缓存（TTL）减少频繁 DB 读取。

## 6.2 灰度分流策略

- 基于 `userId` 的稳定 hash（如 Murmur/CRC32）映射到 0..99
- 在启用的版本集合上按 `traffic_percent` 选择版本
- 具备回滚能力（调低新版本 traffic 或 disabled）

------

# 7. 全链路日志与回放

记录字段：

- userId / query
- router_plan（原始 JSON）
- tool_traces（每个工具：args、耗时、错误）
- answer / blocks（响应）
- ok / error_msg / cost_ms

目的：

- 复现 Router 误路由
- 识别参数校验失败
- 统计工具命中率与耗时分布

------

# 8. 可运行参考实现（完整代码）

以下代码为最小可运行实现，包含：

- 无参工具（你的两个接口）
- 有参工具（search）
- 多表联查 + images block（离线相机抓拍）
- Prompt 版本化/灰度/缓存
- 日志落库
- Router/Composer（Router 强 JSON；Composer 支持模板 + LLM 两种）

> 说明：代码使用 Jackson；LLM 调用采用 OpenAI-compatible `/chat/completions`。

------

## 8.1 Maven 依赖（pom.xml）

（与前版一致，可直接使用）

------

## 8.2 AI 模块模型定义

### AiChatRequest / AiChatResponse / UiBlock

```
package com.example.camai.ai.model;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class AiChatRequest {
  private String userId;
  private String query;
  private Map<String, Object> context;
}

@Data
public class AiChatResponse {
  private String answer;
  private List<UiBlock> blocks;
  private List<ToolTrace> traces;
}

@Data
public class UiBlock {
  private String type;        // table/images/text/cards/graph
  private String title;
  private Object data;
  private Map<String,Object> meta;

  public UiBlock() {}
  public UiBlock(String type, String title, Object data, Map<String,Object> meta) {
    this.type = type; this.title = title; this.data = data; this.meta = meta;
  }
}

@Data
public class ToolTrace {
  private String toolName;
  private Object args;
  private boolean ok;
  private String error;
  private long costMs;
}
```

### RouterPlan

```
package com.example.camai.ai.model;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data
public class RouterPlan {
  private String action;       // tool_call|need_clarification|direct_answer
  private String clarify;
  private String directAnswer;
  private List<ToolCall> calls = new ArrayList<>();

  @Data
  public static class ToolCall {
    private String name;
    private Map<String,Object> args;
  }
}
```

### ToolResult

```
package com.example.camai.ai.model;

import lombok.Data;

import java.util.*;

@Data
public class ToolResult {
  private String title;
  private List<UiBlock> blocks;
  private Map<String,Object> raw;

  public static ToolResult of(String title, List<UiBlock> blocks) {
    ToolResult r = new ToolResult();
    r.title = title;
    r.blocks = blocks;
    return r;
  }

  public static ToolResult table(String title, Object rows, Map<String,Object> meta) {
    return of(title, Collections.singletonList(new UiBlock("table", title, rows, meta)));
  }

  public static ToolResult images(String title, Object images, Map<String,Object> meta) {
    return of(title, Collections.singletonList(new UiBlock("images", title, images, meta)));
  }
}
```

------

## 8.3 工具注解与注册表

### @AiTool

```
package com.example.camai.ai.tools;

import java.lang.annotation.*;

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface AiTool {
  String name();
  String desc();
  String schema() default "{\"type\":\"object\",\"properties\":{},\"additionalProperties\":false}";
}
```

### ToolSpec

```
package com.example.camai.ai.tools;

import lombok.Data;

import java.lang.reflect.Method;

@Data
public class ToolSpec {
  private String name;
  private String desc;
  private String schema;
  private Object bean;
  private Method method;
}
```

### ToolRegistry

```
package com.example.camai.ai.tools;

import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.util.*;

@Component
public class ToolRegistry {
  private final Map<String, ToolSpec> tools = new HashMap<>();

  public ToolRegistry(ApplicationContext ctx) {
    for (String beanName : ctx.getBeanDefinitionNames()) {
      Object bean = ctx.getBean(beanName);
      for (Method m : bean.getClass().getMethods()) {
        AiTool ann = m.getAnnotation(AiTool.class);
        if (ann == null) continue;

        ToolSpec spec = new ToolSpec();
        spec.setName(ann.name());
        spec.setDesc(ann.desc());
        spec.setSchema(ann.schema());
        spec.setBean(bean);
        spec.setMethod(m);

        if (tools.containsKey(spec.getName())) {
          throw new IllegalStateException("Duplicate tool name: " + spec.getName());
        }
        tools.put(spec.getName(), spec);
      }
    }
  }

  public Collection<ToolSpec> list() { return Collections.unmodifiableCollection(tools.values()); }
  public ToolSpec get(String name) { return tools.get(name); }
  public boolean exists(String name) { return tools.containsKey(name); }
}
```

------

## 8.4 Schema 校验（字段白名单 + 关键约束）

```
package com.example.camai.ai.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.*;

public class SchemaValidator {
  private static final ObjectMapper M = new ObjectMapper();

  public static Map<String,Object> normalizeAndValidate(Map<String,Object> args, String schemaJson) {
    if (args == null) args = new HashMap<>();
    try {
      JsonNode schema = M.readTree(schemaJson);
      JsonNode props = schema.get("properties");
      boolean additional = schema.path("additionalProperties").asBoolean(true);

      Set<String> allowed = new HashSet<>();
      if (props != null && props.isObject()) props.fieldNames().forEachRemaining(allowed::add);

      if (!additional) {
        for (String k : args.keySet()) {
          if (!allowed.contains(k)) throw new IllegalArgumentException("Unexpected arg field: " + k);
        }
      }

      // 轻量类型校验（仅示例，可扩展）
      if (props != null && props.isObject()) {
        for (String k : allowed) {
          if (!args.containsKey(k)) continue;
          JsonNode def = props.get(k);
          if (def == null) continue;
          String type = def.path("type").asText("");
          Object v = args.get(k);
          if ("integer".equals(type) && !(v instanceof Number)) {
            // 允许字符串数字
            if (v instanceof String && ((String) v).matches("^-?\\d+$")) {
              args.put(k, Integer.parseInt((String) v));
            } else {
              throw new IllegalArgumentException("Arg '" + k + "' must be integer");
            }
          }
          if ("string".equals(type) && !(v instanceof String)) {
            args.put(k, String.valueOf(v));
          }
        }
      }
      return args;

    } catch (RuntimeException re) {
      throw re;
    } catch (Exception e) {
      throw new IllegalStateException("Invalid tool schema: " + e.getMessage(), e);
    }
  }
}
```

------

## 8.5 ToolExecutor（执行 + Trace）

```
package com.example.camai.ai.core;

import com.example.camai.ai.model.ToolResult;
import com.example.camai.ai.model.ToolTrace;
import com.example.camai.ai.tools.ToolRegistry;
import com.example.camai.ai.tools.ToolSpec;
import com.example.camai.ai.util.SchemaValidator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class ToolExecutor {

  private final ToolRegistry registry;

  public ExecResult execute(String toolName, Map<String,Object> args) {
    ToolTrace trace = new ToolTrace();
    trace.setToolName(toolName);
    trace.setArgs(args);

    long st = System.currentTimeMillis();
    try {
      ToolSpec spec = registry.get(toolName);
      if (spec == null) throw new IllegalArgumentException("Unknown tool: " + toolName);

      Map<String,Object> normalized = SchemaValidator.normalizeAndValidate(args, spec.getSchema());

      Object ret = spec.getMethod().invoke(spec.getBean(), normalized);
      if (!(ret instanceof ToolResult)) throw new IllegalStateException("Tool must return ToolResult");

      trace.setOk(true);
      trace.setCostMs(System.currentTimeMillis() - st);
      return new ExecResult((ToolResult) ret, trace);

    } catch (Exception e) {
      trace.setOk(false);
      trace.setError(e.getClass().getSimpleName() + ": " + e.getMessage());
      trace.setCostMs(System.currentTimeMillis() - st);
      return new ExecResult(null, trace);
    }
  }

  public static class ExecResult {
    public final ToolResult result;
    public final ToolTrace trace;
    public ExecResult(ToolResult result, ToolTrace trace) { this.result = result; this.trace = trace; }
  }
}
```

------

## 8.6 Prompt 发布与灰度选择（DB + 缓存）

### Entity：AiPromptReleaseEntity

```
package com.example.camai.ai.persistence.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("ai_prompt_release")
public class AiPromptReleaseEntity {
  private Long id;
  private String promptName;      // router/composer
  private String version;
  private Integer trafficPercent; // 0..100
  private Integer enabled;        // 1/0
  private String content;
  private LocalDateTime updatedAt;
}
```

### Mapper

```
package com.example.camai.ai.persistence.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.camai.ai.persistence.entity.AiPromptReleaseEntity;

public interface AiPromptReleaseMapper extends BaseMapper<AiPromptReleaseEntity> {}
```

### PromptService（选择版本 + 缓存）

```
package com.example.camai.ai.persistence;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.example.camai.ai.persistence.entity.AiPromptReleaseEntity;
import com.example.camai.ai.persistence.mapper.AiPromptReleaseMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.zip.CRC32;

@Service
@RequiredArgsConstructor
public class PromptService {

  private final AiPromptReleaseMapper mapper;

  @Value("${ai.prompt.cache-ttl-ms:30000}")
  private long ttlMs;

  private static class CacheVal {
    final long ts;
    final List<AiPromptReleaseEntity> list;
    CacheVal(long ts, List<AiPromptReleaseEntity> list){ this.ts=ts; this.list=list; }
  }

  private final Map<String, CacheVal> cache = new ConcurrentHashMap<>();

  public String getPromptContent(String promptName, String userId) {
    List<AiPromptReleaseEntity> releases = loadEnabled(promptName);
    if (releases.isEmpty()) {
      throw new IllegalStateException("No enabled prompt: " + promptName);
    }
    AiPromptReleaseEntity chosen = chooseByTraffic(releases, userId);
    return chosen.getContent();
  }

  private List<AiPromptReleaseEntity> loadEnabled(String promptName) {
    CacheVal cv = cache.get(promptName);
    long now = System.currentTimeMillis();
    if (cv != null && (now - cv.ts) < ttlMs) return cv.list;

    QueryWrapper<AiPromptReleaseEntity> qw = new QueryWrapper<>();
    qw.eq("prompt_name", promptName).eq("enabled", 1).orderByDesc("updated_at");
    List<AiPromptReleaseEntity> list = mapper.selectList(qw);

    cache.put(promptName, new CacheVal(now, list));
    return list;
  }

  private AiPromptReleaseEntity chooseByTraffic(List<AiPromptReleaseEntity> list, String userId) {
    int bucket = stableBucket(userId); // 0..99
    int acc = 0;
    // 建议同名下按 trafficPercent 配置成总和=100
    for (AiPromptReleaseEntity e : list) {
      int p = e.getTrafficPercent() == null ? 0 : e.getTrafficPercent();
      acc += p;
      if (bucket < acc) return e;
    }
    // 回退：若配置不满100，取最新
    return list.get(0);
  }

  private int stableBucket(String userId) {
    if (userId == null) userId = "";
    CRC32 crc = new CRC32();
    crc.update(userId.getBytes(StandardCharsets.UTF_8));
    long v = crc.getValue();
    return (int)(v % 100);
  }
}
```

------

## 8.7 LLM Client（OpenAI-compatible）

```
package com.example.camai.ai.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class LlmClient {

  private final OkHttpClient http = new OkHttpClient();
  private static final ObjectMapper M = new ObjectMapper();

  @Value("${ai.llm.base-url}") private String baseUrl;
  @Value("${ai.llm.api-key}")  private String apiKey;
  @Value("${ai.llm.model}")    private String model;

  public String chat(List<Map<String,Object>> messages, double temperature) {
    try {
      Map<String,Object> body = new LinkedHashMap<>();
      body.put("model", model);
      body.put("messages", messages);
      body.put("temperature", temperature);

      Request req = new Request.Builder()
        .url(baseUrl + "/chat/completions")
        .addHeader("Authorization", "Bearer " + apiKey)
        .addHeader("Content-Type", "application/json")
        .post(RequestBody.create(M.writeValueAsString(body), MediaType.parse("application/json")))
        .build();

      Response resp = http.newCall(req).execute();
      String respStr = resp.body() != null ? resp.body().string() : "";
      if (!resp.isSuccessful()) throw new RuntimeException("LLM http " + resp.code() + ": " + respStr);

      JsonNode root = M.readTree(respStr);
      return root.path("choices").path(0).path("message").path("content").asText("");

    } catch (Exception e) {
      throw new RuntimeException("LLM call failed: " + e.getMessage(), e);
    }
  }
}
```

------

## 8.8 Router（强 JSON + 工具列表注入 + Prompt 灰度）

```
package com.example.camai.ai.core;

import com.example.camai.ai.model.AiChatRequest;
import com.example.camai.ai.model.RouterPlan;
import com.example.camai.ai.persistence.PromptService;
import com.example.camai.ai.tools.ToolRegistry;
import com.example.camai.ai.tools.ToolSpec;
import com.example.camai.ai.util.JsonExtract;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class RouterService {

  private final LlmClient llm;
  private final ToolRegistry toolRegistry;
  private final PromptService promptService;
  private static final ObjectMapper M = new ObjectMapper();

  @Value("${ai.router.temperature:0.0}")
  private double temperature;

  public RouterPlan route(AiChatRequest req) {
    String system = promptService.getPromptContent("router", req.getUserId());
    String toolListJson = buildToolListJson(toolRegistry.list());

    List<Map<String,Object>> messages = new ArrayList<>();
    messages.add(msg("system", system + "\n\n可用工具列表(JSON):\n" + toolListJson));
    messages.add(msg("user", "用户问题：" + req.getQuery()));

    String raw = llm.chat(messages, temperature);
    String json = JsonExtract.firstJsonObject(raw);

    try {
      RouterPlan plan = M.readValue(json, RouterPlan.class);
      // 基础校验
      if ("tool_call".equals(plan.getAction())) {
        for (RouterPlan.ToolCall c : plan.getCalls()) {
          if (!toolRegistry.exists(c.getName())) {
            throw new IllegalArgumentException("Unknown tool chosen: " + c.getName());
          }
          if (c.getArgs() == null) c.setArgs(Collections.emptyMap());
        }
      }
      return plan;

    } catch (Exception e) {
      RouterPlan fallback = new RouterPlan();
      fallback.setAction("need_clarification");
      fallback.setClarify("无法解析为可执行计划，请使用更明确的描述，例如：查看相机状态统计 / 列出相机列表 / 查询离线相机。");
      return fallback;
    }
  }

  private String buildToolListJson(Collection<ToolSpec> specs) {
    try {
      List<Map<String,Object>> list = new ArrayList<>();
      for (ToolSpec s : specs) {
        Map<String,Object> one = new LinkedHashMap<>();
        one.put("name", s.getName());
        one.put("desc", s.getDesc());
        one.put("schema", M.readTree(s.getSchema()));
        list.add(one);
      }
      return M.writerWithDefaultPrettyPrinter().writeValueAsString(list);
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }

  private static Map<String,Object> msg(String role, String content) {
    Map<String,Object> m = new HashMap<>();
    m.put("role", role);
    m.put("content", content);
    return m;
  }
}
```

### JSON 抽取工具

```
package com.example.camai.ai.util;

public class JsonExtract {
  public static String firstJsonObject(String s) {
    if (s == null) return "{}";
    int start = s.indexOf('{');
    int end = s.lastIndexOf('}');
    if (start >= 0 && end > start) return s.substring(start, end + 1).trim();
    return "{}";
  }
}
```

------

## 8.9 Composer（模板 + 可选 LLM，Prompt 灰度）

```
package com.example.camai.ai.core;

import com.example.camai.ai.model.*;
import com.example.camai.ai.persistence.PromptService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class ComposerService {

  private final LlmClient llm;
  private final PromptService promptService;

  @Value("${ai.composer.enabled:true}")
  private boolean enabled;

  @Value("${ai.composer.temperature:0.2}")
  private double temperature;

  public AiChatResponse compose(String userId, String userQuery, List<ToolResult> results, List<ToolTrace> traces) {
    AiChatResponse resp = new AiChatResponse();
    resp.setTraces(traces);

    List<UiBlock> blocks = new ArrayList<>();
    for (ToolResult r : results) if (r != null && r.getBlocks() != null) blocks.addAll(r.getBlocks());
    resp.setBlocks(blocks);

    if (!enabled) {
      resp.setAnswer(templateSummary(userQuery, results));
      return resp;
    }

    // LLM 复述：仅基于工具结果（不允许编造）
    String system = promptService.getPromptContent("composer", userId);
    String payload = safePayload(userQuery, results);

    List<Map<String,Object>> messages = new ArrayList<>();
    messages.add(msg("system", system));
    messages.add(msg("user", payload));

    String answer = llm.chat(messages, temperature);
    resp.setAnswer(answer);
    return resp;
  }

  private String templateSummary(String q, List<ToolResult> rs) {
    StringBuilder sb = new StringBuilder();
    sb.append("已执行查询：").append(q).append("。\n");
    for (ToolResult r : rs) sb.append("- ").append(r.getTitle()).append("\n");
    return sb.toString();
  }

  private String safePayload(String userQuery, List<ToolResult> results) {
    // 只提供工具标题与 blocks 的简化信息，避免把过大 raw 全量喂给模型
    StringBuilder sb = new StringBuilder();
    sb.append("用户问题：").append(userQuery).append("\n");
    sb.append("工具结果（结构化块）：\n");
    for (ToolResult r : results) {
      sb.append("### ").append(r.getTitle()).append("\n");
      if (r.getBlocks() != null) {
        for (UiBlock b : r.getBlocks()) {
          sb.append("- type=").append(b.getType()).append(", title=").append(b.getTitle()).append("\n");
        }
      }
    }
    sb.append("\n要求：仅基于上述工具结果生成回答，不得推断数据库中不存在的信息。");
    return sb.toString();
  }

  private static Map<String,Object> msg(String role, String content) {
    Map<String,Object> m = new HashMap<>();
    m.put("role", role);
    m.put("content", content);
    return m;
  }
}
```

------

## 8.10 AI Chat Service（串联 + 落库日志）

### 日志 Entity + Mapper

```
package com.example.camai.ai.persistence.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("ai_chat_log")
public class AiChatLogEntity {
  private Long id;
  private String userId;
  private String query;
  private String routerPlan;
  private String toolTraces;
  private String answer;
  private String blocks;
  private Integer ok;
  private String errorMsg;
  private Long costMs;
  private LocalDateTime createdAt;
}
package com.example.camai.ai.persistence.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.camai.ai.persistence.entity.AiChatLogEntity;

public interface AiChatLogMapper extends BaseMapper<AiChatLogEntity> {}
```

### AiChatService

```
package com.example.camai.ai.core;

import com.example.camai.ai.model.*;
import com.example.camai.ai.persistence.mapper.AiChatLogMapper;
import com.example.camai.ai.persistence.entity.AiChatLogEntity;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AiChatService {

  private final RouterService routerService;
  private final ToolExecutor toolExecutor;
  private final ComposerService composerService;
  private final AiChatLogMapper logMapper;

  private static final ObjectMapper M = new ObjectMapper();

  public AiChatResponse chat(AiChatRequest req) {
    long st = System.currentTimeMillis();
    AiChatLogEntity log = new AiChatLogEntity();
    log.setUserId(req.getUserId());
    log.setQuery(req.getQuery());
    log.setCreatedAt(LocalDateTime.now());

    try {
      RouterPlan plan = routerService.route(req);
      log.setRouterPlan(M.writeValueAsString(plan));

      if ("need_clarification".equals(plan.getAction())) {
        AiChatResponse resp = new AiChatResponse();
        resp.setAnswer(plan.getClarify());
        resp.setBlocks(Collections.emptyList());
        resp.setTraces(Collections.emptyList());

        log.setOk(1);
        log.setAnswer(resp.getAnswer());
        log.setBlocks("[]");
        log.setCostMs(System.currentTimeMillis() - st);
        logMapper.insert(log);
        return resp;
      }

      if ("direct_answer".equals(plan.getAction())) {
        AiChatResponse resp = new AiChatResponse();
        resp.setAnswer(plan.getDirectAnswer() == null ? "" : plan.getDirectAnswer());
        resp.setBlocks(Collections.emptyList());
        resp.setTraces(Collections.emptyList());

        log.setOk(1);
        log.setAnswer(resp.getAnswer());
        log.setBlocks("[]");
        log.setCostMs(System.currentTimeMillis() - st);
        logMapper.insert(log);
        return resp;
      }

      List<ToolResult> results = new ArrayList<>();
      List<ToolTrace> traces = new ArrayList<>();

      for (RouterPlan.ToolCall c : plan.getCalls()) {
        ToolExecutor.ExecResult er = toolExecutor.execute(c.getName(), c.getArgs());
        traces.add(er.trace);
        if (er.result != null) results.add(er.result);
      }

      AiChatResponse resp = composerService.compose(req.getUserId(), req.getQuery(), results, traces);

      log.setToolTraces(M.writeValueAsString(traces));
      log.setAnswer(resp.getAnswer());
      log.setBlocks(M.writeValueAsString(resp.getBlocks()));
      log.setOk(1);
      log.setCostMs(System.currentTimeMillis() - st);
      logMapper.insert(log);

      return resp;

    } catch (Exception e) {
      log.setOk(0);
      log.setErrorMsg(e.getClass().getSimpleName() + ": " + e.getMessage());
      log.setCostMs(System.currentTimeMillis() - st);
      logMapper.insert(log);

      AiChatResponse resp = new AiChatResponse();
      resp.setAnswer("系统执行失败：" + e.getMessage());
      resp.setBlocks(Collections.emptyList());
      resp.setTraces(Collections.emptyList());
      return resp;
    }
  }
}
```

------

## 8.11 Controller

```
package com.example.camai.ai.controller;

import com.example.camai.ai.core.AiChatService;
import com.example.camai.ai.model.AiChatRequest;
import com.example.camai.ai.model.AiChatResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiChatController {

  private final AiChatService service;

  @PostMapping("/chat")
  public AiChatResponse chat(@RequestBody AiChatRequest req) {
    return service.chat(req);
  }
}
```

------

# 9. 工具实现（无参 + 有参 + 多表联查 + images block）

## 9.1 CameraMapper（补齐有参与联查）

```
package com.example.camai.camera.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.camai.camera.entity.CameraDeviceEntity;
import com.example.camai.camera.vo.CameraDeviceVo;
import com.example.camai.camera.vo.CameraStatusCountVO;
import com.example.camai.camera.vo.OfflineSnapshotVo;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface CameraMapper extends BaseMapper<CameraDeviceEntity> {

  @Select("select camera_status as cameraStatus,count(*) as count " +
          "from CamHub.hm_camera_device where is_deleted = 0 group by camera_status")
  List<CameraStatusCountVO> countByCameraStatusCountVos();

  @Select("select cd.id as id, cd.camera_name as cameraName,cd.ip,cd.camera_status as cameraStatus," +
          "cd.last_online_time as lastOnlineTime,cg.group_name as groupName " +
          "from CamHub.hm_camera_device cd " +
          "left join CamHub.hm_camera_group cg on cd.group_id = cg.id " +
          "where cd.is_deleted = 0 " +
          "order by cd.create_time desc")
  List<CameraDeviceVo> listCameraDeviceVo();

  // 有参：按条件查询（limit 需要拼接，建议在 Service 控制上限并用 MyBatisPlus 分页；这里提供简单版）
  @Select("<script>" +
          "select cd.id as id, cd.camera_name as cameraName, cd.ip, cd.camera_status as cameraStatus," +
          "cd.last_online_time as lastOnlineTime, cg.group_name as groupName " +
          "from CamHub.hm_camera_device cd " +
          "left join CamHub.hm_camera_group cg on cd.group_id = cg.id " +
          "where cd.is_deleted = 0 " +
          "<if test='status != null'> and cd.camera_status = #{status} </if>" +
          "<if test='groupName != null and groupName != \"\"'> and cg.group_name = #{groupName} </if>" +
          "<if test='nameLike != null and nameLike != \"\"'> and cd.camera_name like concat('%',#{nameLike},'%') </if>" +
          "order by cd.create_time desc " +
          "limit #{limit}" +
          "</script>")
  List<CameraDeviceVo> searchCameraDeviceVo(@Param("status") Integer status,
                                            @Param("groupName") String groupName,
                                            @Param("nameLike") String nameLike,
                                            @Param("limit") Integer limit);

  // 多表联查：离线相机 + 最新抓拍（每台相机取最新一张）
  @Select("<script>" +
          "select cd.id as cameraId, cd.camera_name as cameraName, cd.ip as ip, cg.group_name as groupName," +
          "cd.last_online_time as lastOnlineTime, s.image_url as imageUrl, s.capture_time as captureTime " +
          "from CamHub.hm_camera_device cd " +
          "left join CamHub.hm_camera_group cg on cd.group_id = cg.id " +
          "left join CamHub.hm_camera_snapshot s on s.id = (" +
          "  select ss.id from CamHub.hm_camera_snapshot ss " +
          "  where ss.camera_id = cd.id and ss.is_deleted = 0 " +
          "  order by ss.capture_time desc limit 1" +
          ") " +
          "where cd.is_deleted = 0 and cd.camera_status = 0 " +
          "<if test='groupName != null and groupName != \"\"'> and cg.group_name = #{groupName} </if>" +
          "order by cd.create_time desc " +
          "limit #{limit}" +
          "</script>")
  List<OfflineSnapshotVo> listOfflineLatestSnapshots(@Param("groupName") String groupName,
                                                     @Param("limit") Integer limit);
}
```

### OfflineSnapshotVo

```
package com.example.camai.camera.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class OfflineSnapshotVo {
  private Long cameraId;
  private String cameraName;
  private String ip;
  private String groupName;
  private LocalDateTime lastOnlineTime;
  private String imageUrl;
  private LocalDateTime captureTime;
}
```

------

## 9.2 CameraTools（工具化输出 blocks）

```
package com.example.camai.ai.tools.impl;

import com.example.camai.ai.model.ToolResult;
import com.example.camai.ai.model.UiBlock;
import com.example.camai.ai.tools.AiTool;
import com.example.camai.camera.mapper.CameraMapper;
import com.example.camai.camera.vo.CameraDeviceVo;
import com.example.camai.camera.vo.CameraStatusCountVO;
import com.example.camai.camera.vo.OfflineSnapshotVo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
@RequiredArgsConstructor
public class CameraTools {

  private final CameraMapper cameraMapper;

  @AiTool(
    name = "camera.status.count",
    desc = "统计相机在线/离线数量（无参）",
    schema = "{\"type\":\"object\",\"properties\":{},\"additionalProperties\":false}"
  )
  public ToolResult cameraStatusCount(Map<String,Object> args) {
    List<CameraStatusCountVO> list = cameraMapper.countByCameraStatusCountVos();

    Map<String,Object> meta = new HashMap<>();
    meta.put("columns", Arrays.asList(
      col("cameraStatus","状态"),
      col("count","数量")
    ));
    meta.put("valueMap", statusMap());
    return ToolResult.table("相机状态统计", list, meta);
  }

  @AiTool(
    name = "camera.device.list",
    desc = "列出相机列表（无参，按创建时间倒序）",
    schema = "{\"type\":\"object\",\"properties\":{},\"additionalProperties\":false}"
  )
  public ToolResult cameraDeviceList(Map<String,Object> args) {
    List<CameraDeviceVo> list = cameraMapper.listCameraDeviceVo();

    Map<String,Object> meta = new HashMap<>();
    meta.put("columns", Arrays.asList(
      col("cameraName","名称"),
      col("ip","IP"),
      col("cameraStatus","状态"),
      col("lastOnlineTime","最后在线"),
      col("groupName","分组")
    ));
    meta.put("valueMap", statusMap());
    return ToolResult.table("相机列表", list, meta);
  }

  @AiTool(
    name = "camera.device.search",
    desc = "按条件查询相机（支持状态、分组、名称模糊；limit默认50，上限200）",
    schema = "{"
      + "\"type\":\"object\","
      + "\"properties\":{"
      +   "\"status\":{\"type\":\"integer\"},"
      +   "\"groupName\":{\"type\":\"string\"},"
      +   "\"nameLike\":{\"type\":\"string\"},"
      +   "\"limit\":{\"type\":\"integer\"}"
      + "},"
      + "\"additionalProperties\":false"
      + "}"
  )
  public ToolResult cameraDeviceSearch(Map<String,Object> args) {
    Integer status = intOrNull(args.get("status"));
    String groupName = strOrNull(args.get("groupName"));
    String nameLike = strOrNull(args.get("nameLike"));
    Integer limit = intOrDefault(args.get("limit"), 50);
    if (limit > 200) limit = 200;
    if (limit < 1) limit = 1;

    List<CameraDeviceVo> list = cameraMapper.searchCameraDeviceVo(status, groupName, nameLike, limit);

    Map<String,Object> meta = new HashMap<>();
    meta.put("columns", Arrays.asList(
      col("cameraName","名称"),
      col("ip","IP"),
      col("cameraStatus","状态"),
      col("lastOnlineTime","最后在线"),
      col("groupName","分组")
    ));
    meta.put("valueMap", statusMap());
    meta.put("filters", args);
    return ToolResult.table("相机查询结果", list, meta);
  }

  @AiTool(
    name = "camera.offline.latestSnapshots",
    desc = "查询离线相机并返回每台相机最新抓拍图（可选groupName，limit默认20，上限100）",
    schema = "{"
      + "\"type\":\"object\","
      + "\"properties\":{"
      +   "\"groupName\":{\"type\":\"string\"},"
      +   "\"limit\":{\"type\":\"integer\"}"
      + "},"
      + "\"additionalProperties\":false"
      + "}"
  )
  public ToolResult offlineLatestSnapshots(Map<String,Object> args) {
    String groupName = strOrNull(args.get("groupName"));
    Integer limit = intOrDefault(args.get("limit"), 20);
    if (limit > 100) limit = 100;
    if (limit < 1) limit = 1;

    List<OfflineSnapshotVo> list = cameraMapper.listOfflineLatestSnapshots(groupName, limit);

    // table block
    Map<String,Object> tableMeta = new HashMap<>();
    tableMeta.put("columns", Arrays.asList(
      col("cameraName","名称"),
      col("ip","IP"),
      col("groupName","分组"),
      col("lastOnlineTime","最后在线"),
      col("captureTime","抓拍时间")
    ));
    List<UiBlock> blocks = new ArrayList<>();
    blocks.add(new UiBlock("table", "离线相机（含最新抓拍）", list, tableMeta));

    // images block
    List<Map<String,Object>> imgs = new ArrayList<>();
    for (OfflineSnapshotVo v : list) {
      if (v.getImageUrl() == null || v.getImageUrl().trim().isEmpty()) continue;
      Map<String,Object> img = new HashMap<>();
      img.put("url", v.getImageUrl());
      img.put("caption", buildCaption(v));
      img.put("cameraId", v.getCameraId());
      imgs.add(img);
    }
    Map<String,Object> imgMeta = new HashMap<>();
    imgMeta.put("layout", "grid");
    blocks.add(new UiBlock("images", "抓拍图片", imgs, imgMeta));

    return ToolResult.of("离线相机与抓拍", blocks);
  }

  private String buildCaption(OfflineSnapshotVo v) {
    return v.getCameraName() + " / " + (v.getGroupName() == null ? "-" : v.getGroupName()) +
           (v.getCaptureTime() == null ? "" : (" / " + v.getCaptureTime()));
  }

  private Map<String,String> statusMap() {
    Map<String,String> m = new HashMap<>();
    m.put("1","在线");
    m.put("0","离线");
    return m;
  }

  private Map<String,String> col(String key, String title) {
    Map<String,String> c = new LinkedHashMap<>();
    c.put("key", key);
    c.put("title", title);
    return c;
  }

  private Integer intOrNull(Object o) {
    if (o == null) return null;
    if (o instanceof Number) return ((Number)o).intValue();
    if (o instanceof String && ((String)o).matches("^-?\\d+$")) return Integer.parseInt((String)o);
    return null;
  }

  private Integer intOrDefault(Object o, int def) {
    Integer v = intOrNull(o);
    return v == null ? def : v;
  }

  private String strOrNull(Object o) {
    if (o == null) return null;
    String s = String.valueOf(o).trim();
    return s.isEmpty() ? null : s;
  }
}
```

------

# 10. Router/Composer Prompt 内容（入库示例）

## 10.1 Router Prompt（强约束 JSON）

将以下内容插入 `ai_prompt_release`（prompt_name=router）：

```
INSERT INTO ai_prompt_release(prompt_name, version, traffic_percent, enabled, content)
VALUES(
'router','v1',100,1,
'你是后端系统的“工具路由器”。你的输出必须是严格JSON对象，禁止输出任何解释性文字或Markdown。

任务：根据用户问题，从提供的工具列表中选择一个或多个工具，并生成调用计划。

输出JSON格式：
{
  "action": "tool_call|need_clarification|direct_answer",
  "calls": [{"name":"tool.name","args":{}}],
  "clarify": "",
  "directAnswer": ""
}

规则：
1) 若可通过工具获得答案：action=tool_call，calls 至少1项。
2) 若必须参数缺失导致无法调用工具：action=need_clarification，并在 clarify 写出需要补充的信息；calls 为空数组。
3) 若完全无需工具即可回答：action=direct_answer，并在 directAnswer 给出回答；calls 为空数组。
4) calls[i].args 必须严格符合工具schema；不得输出schema未定义字段。
5) 不得编造任何业务数据。'
);
```

## 10.2 Composer Prompt（只基于工具结果重述）

```
INSERT INTO ai_prompt_release(prompt_name, version, traffic_percent, enabled, content)
VALUES(
'composer','v1',100,1,
'你是后端系统的“结果表达器”。你将收到用户问题与工具结果摘要。
要求：
1) 只能基于工具结果进行总结，不得推断数据库中不存在的信息。
2) 如工具返回table/images等结构化块，回答中可提示用户“已返回表格/图片块供界面渲染”。
3) 输出为纯文本，不要输出JSON。'
);
```

------

# 11. 运行与验证

## 11.1 调用示例

- 无参：
  - “查看相机状态统计” → `camera.status.count`
  - “列出相机列表” → `camera.device.list`
- 有参：
  - “查询离线相机，分组是一号园区，最多20个” → `camera.device.search`（status=0, groupName=一号园区, limit=20）
  - “找名字包含门口的在线相机” → status=1, nameLike=门口
- 多表联查 + 图片：
  - “查看离线相机最新抓拍” → `camera.offline.latestSnapshots`，返回 table + images blocks

## 11.2 curl

```
curl -X POST http://localhost:8080/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"userId":"u1","query":"查看离线相机最新抓拍，limit 10"}'
```

------

# 12. 扩展指南（工程规范）

新增一个可被 AI 调用的能力，遵循固定流程：

1. **定义工具**：在任意 Spring Bean 方法上加 `@AiTool(name, desc, schema)`
2. **实现逻辑**：工具内部调用 Service/Mapper，返回 `ToolResult`（table/images/…）
3. **Schema 限制**：`additionalProperties=false`，只开放必要参数；工具内部设置默认值与上限
4. **上线策略**：新增工具不需要改 Router 代码；Prompt 若需调整通过发布表灰度上线
5. **回归测试**：
   - Router 输出 JSON 能反序列化
   - Schema 校验能拦截异常字段
   - ToolExecutor 对异常有 trace 并记录日志
