---
title: MCP实现CSDN自动发帖
createTime: '2026/03/01 19:23:46'
code: b1c38p4k4
permalink: /article/b1c38p4k4/
tags:
  - MCP
  - AI
cover: 'https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/bg05.jpg'
---

# CSDN 自动发帖功能完整实现指南

随着 AI 与自动化工具的发展，实现自动发布文章到 CSDN 的能力可以大大提升内容创作者的工作效率。本文将围绕以下三部分展开：

1. **服务端：构建 CSDN 发帖 API 接口服务**
2. **客户端：集成 MCP 工具调用发帖服务**
3. **测试端：联动 AI 流程实现自动生成并发帖**

------

## 🚀 一、服务端：构建 CSDN 发帖 API 接口服务

### 1. 引入依赖

首先在 Spring Boot 项目中引入所需依赖，主要包含 MCP Server、Hutool HTTP 工具包、Flexmark 富文本转换器等。

```xml
<dependencies>
    <!--MCP服务端-->
    <dependency>
        <groupId>org.springframework.ai</groupId>
        <artifactId>spring-ai-mcp-server-spring-boot-starter</artifactId>
    </dependency>
    <dependency>
        <groupId>cn.hutool</groupId>
        <artifactId>hutool-all</artifactId>
        <version>5.8.38</version>
    </dependency>
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <version>1.18.30</version>
        <scope>provided</scope>
    </dependency>
    <dependency>
        <groupId>com.vladsch.flexmark</groupId>
        <artifactId>flexmark-all</artifactId>
        <version>0.64.8</version>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter</artifactId>
    </dependency>
</dependencies>
```

### 2. 抓取 CSDN 提交文章请求信息

我们通过浏览器抓包获取 CSDN 提交文章所需的请求地址和结构，打开发布文章页面：

📌 打开 [CSDN 编辑器](https://editor.csdn.net/md/)

点击“发布”按钮时抓取请求（注意要**立刻停止**录制，避免页面跳转）：

![点击提交时抓包](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/image-20250627155925989.png)

请求地址为：https://bizapi.csdn.net/blog-console-api/v3/mdeditor/saveArticle

![请求结构](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/image-20250627150555168.png)

我们可以复制请求体用于本地调试。

![请求体复制至测试工具](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/image-20250627150927025.png)

```curl
curl 'https://bizapi.csdn.net/blog-console-api/v1/postedit/saveArticle' \
  -H 'authority: bizapi.csdn.net' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'accept-language: zh-CN,zh;q=0.9' \
  -H 'content-type: application/json;' \
  -H 'cookie: xxxxx\
  -H 'origin: https://mpbeta.csdn.net' \
  -H 'referer: https://mpbeta.csdn.net/' \
  -H 'sec-ch-ua: "Chromium";v="9", "Not?A_Brand";v="8"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-site' \
  -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36 SLBrowser/9.0.3.5211 SLBChan/111' \
  -H 'x-ca-key: xxxx' \
  -H 'x-ca-nonce: xxxxx' \
  -H 'x-ca-signature: xxxxx' \
  -H 'x-ca-signature-headers: x-ca-key,x-ca-nonce' \
  --data-raw '{"title":"我是测试标题","description":"测试内容。","content":"<p>测试内容</p>\n","tags":"java","categories":"","type":"original","status":0,"read_type":"private","reason":"","original_link":"","authorized_status":false,"check_original":false,"source":"pc_postedit","not_auto_saved":1,"creator_activity_id":"","cover_images":[],"cover_type":1,"vote_id":0,"resource_id":"","scheduled_time":0,"markdowncontent":"","resource_url":"","editor_type":0,"plan":[],"level":"0","is_new":1,"sync_git_code":0}' \
  --compressed
```

我们可以借助AI生成如下代码

```java
现在我有这些依赖，我现在想要实现往CSDN实现本地发帖传送到CSDN服务器上，curl格式请求如下curl 'https://bizapi.csdn.net/blog-console-api/v3/mdeditor/saveArticle' \
  -H 'authority: bizapi.csdn.net' \
  -H 'accept: */*' \
  -H 'accept-language: zh-CN,zh;q=0.9' \
  -H 'content-type: application/json' \
  -H 'cookie: xxxxx' \
  -H 'origin: https://editor.csdn.net' \
  -H 'referer: https://editor.csdn.net/' \
  -H 'sec-ch-ua: "Chromium";v="9", "Not?A_Brand";v="8"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-site' \
  -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36 SLBrowser/9.0.3.5211 SLBChan/111' \
  -H 'x-ca-key: xxxx' \
  -H 'x-ca-nonce: xxxxx' \
  -H 'x-ca-signature: xxxxxxx' \
  -H 'x-ca-signature-headers: x-ca-key,x-ca-nonce' \
  --data-raw '{"title":"我是测试标题","markdowncontent":"测试内容\n","content":"<p>测试内容</p>\n\n","readType":"private","level":0,"tags":"java","status":0,"categories":"","type":"original","original_link":"","authorized_status":false,"Description":"","not_auto_saved":"1","source":"pc_mdeditor","cover_images":[],"cover_type":1,"is_new":1,"vote_id":0,"resource_id":"","pubStatus":"publish"}' \
  --compressed
  我的需求如下 
  1. 请按照标准项目格式，所有的包都在com.flycode内，生成Domain包，里面是对应实体类，为CSDNArticle，生成service包里面提供服务，有接口ICsdnService和CSDNServiceImpl服务实现类 ，里面有接口，需要传入文章内容实体类以及当前的Cookie，并且文章内容需要使用flexmark-all将普通文本转换为富文本
  2. 发送网络请求，使用Hutool工具类发送请求 ,将所有的请求头都
  3. 适当加入log日志
  4. 添加主启动类Application.java
  5. 生成ICsdnService的测试类到test文件夹内和ICsdnService同一个软件包位置
  6. 响应格式如下{
 "code": 200,
 "traceId": "xxx",
 "data": {
  "url": "xxxx",
  "id": xxxx,
  "qrcode": "xxxx",
  "title": "xxx",
  "description": "xxx。"
 },
 "msg": "success"
}  
```

![项目结构生成建议](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/image-20250627153314930.png)

### 3. 文章实体类定义

```java
@Data
public class CSDNArticle {
    private String title;
    private String markdowncontent;
    private String content;
    private String readType;
    private int level;
    private String tags;
    private int status;
    private String categories;
    private String type;
    private String original_link;
    private boolean authorized_status;
    private String Description;
    private String not_auto_saved;
    private String source;
    private List<String> cover_images;
    private int cover_type;
    private int is_new;
    private int vote_id;
    private String resource_id;
    private String pubStatus;
} 
```

### 4. 响应结构体

```java
@Data
public class CSDNResponse {
    private int code;
    private String traceId;
    private Data data;
    private String msg;

    @Data
    public static class Data {
        private String url;
        private long id;
        private String qrcode;
        private String title;
        private String description;
    }
}
```

### 5. 服务接口与实现

**接口定义：**

```java
public interface ICsdnService {
    CSDNResponse postArticle(CSDNArticle article, String cookie);
}
```

**实现类：**

```java
@Service
public class CSDNServiceImpl implements ICsdnService {
    private static final Logger log = LoggerFactory.getLogger(CSDNServiceImpl.class);
    private static final String URL = "https://bizapi.csdn.net/blog-console-api/v3/mdeditor/saveArticle";
    private final ObjectMapper objectMapper = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    @Override
    public CSDNResponse postArticle(CSDNArticle article, String cookie) {
        try {
            // markdown 转 html
            Parser parser = Parser.builder().build();
            HtmlRenderer renderer = HtmlRenderer.builder().build();
            Node document = parser.parse(article.getMarkdowncontent());
            String html = renderer.render(document);
            article.setContent(html);

            String body = objectMapper.writeValueAsString(article);
            log.info("请求体: {}", body);

            HttpRequest request = HttpRequest.post(URL)
                    .header("Accept", "*/*")
                    .header("Accept-Language", "zh-CN,zh;q=0.9")
                    .header("Content-Type", "application/json")
                    .header("Dnt", "1")
                    .header("Origin", "https://editor.csdn.net")
                    .header("Priority", " u=1, i")
                    .header("Referer", "https://editor.csdn.net/")
                    .header("Sec-Ch-Ua", "\"Chromium\";v=\"9\", \"Not?A_Brand\";v=\"8\"")
                    .header("Sec-Ch-Ua-Mobile", "?0")
                    .header("Sec-Ch-Ua-Platform", "\"Windows\"")
                    .header("Sec-Fetch-Dest", "empty")
                    .header("Sec-Fetch-Mode", "cors")
                    .header("Sec-Fetch-Site", "same-site")
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36 SLBrowser/9.0.3.5211 SLBChan/111")
                    .header("x-ca-key", "xxxx")
                    .header("x-ca-nonce", "xxxxx")
                    .header("x-ca-signature", "xxxxxxx")
                    .header("x-ca-signature-headers", "x-ca-key,x-ca-nonce")

                    .header("cookie", cookie)

                    .body(body)
                    .timeout(10000);

            HttpResponse response = request.execute();
            log.info("完整请求对象: {}", request.toString());
            String respStr = response.body();
            log.info("CSDN响应: {}", respStr);
            return objectMapper.readValue(respStr, CSDNResponse.class);
        } catch (Exception e) {
            log.error("发帖失败", e);
            CSDNResponse error = new CSDNResponse();
            error.setCode(500);
            error.setMsg("发帖异常: " + e.getMessage());
            return error;
        }
    }
} 
```

### 6. 测试类

```java
    @Test
    public void testPostArticle() {
        CSDNArticle article = new CSDNArticle();
        article.setTitle("我是测试标题");
        article.setMarkdowncontent("测试内容1111\n");
        article.setContent("<p>测试内容</p><p>helloworld</p>\\n\\n");
        article.setReadType("private");
        article.setLevel(0);
        article.setTags("java");
        article.setStatus(0);
        article.setCategories("");
        article.setType("original");
        article.setOriginal_link("");
        article.setAuthorized_status(false);
        article.setDescription("");
        article.setNot_auto_saved("1");
        article.setSource("pc_mdeditor");
        article.setCover_images(Collections.emptyList());
        article.setCover_type(1);
        article.setIs_new(1);
        article.setVote_id(0);
        article.setResource_id("");
        article.setPubStatus("publish");
        String cookie = "xxxxx";

        CSDNResponse response = csdnService.postArticle(article, cookie);
        assertNotNull(response);
        assertTrue(response.getCode() == 200 || response.getCode() == 500);
    }
```

![发帖测试响应](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/image-20250630093244368.png)

### 7. 简化和抽象代码

将cookie抽象出来，便于修改

```java
@Data
@Component
@ConfigurationProperties(prefix = "csdn.api")
public class CSDNProperties {
    private String cookie;
}
```

编写实体类Dto、简化参数

```java
@Data
public class CSDNArticleDto {

    @ToolParam(required = true,description = "CSDN文章标题，不得小于5个字符")
    private String title;

    @ToolParam(required = true,description = "CSDN文章内容Markdown格式")
    private String markdowncontent;

    @ToolParam(required = true,description = "文章标签，多个标签用逗号分隔")
    private String tags;

    @ToolParam(required = true,description = "文章描述")
    private String description;
} 
```

重载CSDN发帖方法，我们只需要重新调用下之前的发帖方法即可，不需要重写方法

```java
    @Override
    @Tool(description = "CSDN发帖")
    public CSDNResponse postArticle(CSDNArticleDto csdnArticleDto) {
        CSDNArticle csdnArticle = new CSDNArticle();
        csdnArticle.setReadType("private");
        csdnArticle.setLevel(0);
        csdnArticle.setTags("java");
        csdnArticle.setStatus(0);
        csdnArticle.setCategories("");
        csdnArticle.setType("original");
        csdnArticle.setOriginal_link("");
        csdnArticle.setAuthorized_status(false);
        csdnArticle.setNot_auto_saved("1");
        csdnArticle.setSource("pc_mdeditor");
        csdnArticle.setCover_images(Collections.emptyList());
        csdnArticle.setCover_type(1);
        csdnArticle.setIs_new(1);
        csdnArticle.setVote_id(0);
        csdnArticle.setResource_id("");
        csdnArticle.setPubStatus("public");

        String cookie = csdnProperties.getCookie();
        BeanUtils.copyProperties(csdnArticleDto, csdnArticle);
        return this.postArticle(csdnArticle, cookie);
    }
```

测试

```java
    @Test
    void postArticle() {
        CSDNArticleDto csdnArticleDto = new CSDNArticleDto();
        csdnArticleDto.setTitle("我是测试文章");
        csdnArticleDto.setDescription("这是一个测试文章");
        csdnArticleDto.setMarkdowncontent("### 这是一个测试文章");
        csdnArticleDto.setTags("java");
        CSDNResponse csdnResponse = csdnService.postArticle(csdnArticleDto);
    }
```

### 8. 编写yml配置

主要作用是定义当前工具服务名、关闭日志输出、设置cookie

```yml
spring:
  application:
    name: ai-mcp-server-csdn

  ai:
    mcp:
      server:
        name: ${spring.application.name}
        version: 1.0.0

  main:
    banner-mode: off
    web-application-type: none

logging:
  pattern:
    console:
  file:
    name: ${spring.application.name}.log

server:
  servlet:
    encoding:
      charset: UTF-8
      force: true
      enabled: true
csdn:
  api:
    cookie: xxxx
```

### 9. 启动类定义

使用ToolCallbackProvider将当前服务提供出去给其他系统使用

```java
@SpringBootApplication
@Slf4j
public class Application implements CommandLineRunner {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
    @Bean
    public ToolCallbackProvider csdnTool(CSDNServiceImpl csdnService) {
        return MethodToolCallbackProvider.builder().toolObjects(csdnService).build();
    }

    @Override
    public void run(String... args) throws Exception {
        log.info("csdn begin");
    }
}
```

### 10. 打包工具

我们需要将当前项目打包，记住当前打包文件的位置，我们需要在客户端配置相应的信息

需要在pom里面加入build代码

```xml
    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <version>3.3.1</version>
                <configuration>
                    <mainClass>com.flycode.Application</mainClass>
                    <executable>true</executable>
                </configuration>
                <executions>
                    <execution>
                        <goals>
                            <goal>repackage</goal>
                        </goals>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </build>
```

![打包路径](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/image-20250627093509252.png)

------

## 🖥 二、客户端：集成 MCP 客户端自动调用发帖服务

### 1. 配置 MCP 启动 JSON

```json
{
  "mcpServers": {
    "ai-mcp-server-csdn": {
      "command": "D:\\Developer Tools\\JDK21\\bin\\java.exe",
      "args": [
        "-Dspring.ao.mcp.server.stdio=true",
        "-jar",
        "D:\\xxxx\\ai-mcp-server-csdn-1.0-SNAPSHOT.jar"
      ]
    }
  }
}
```

### 2. 客户端配置 yml

详细配置客户端信息可以浏览[MCP新版实现](MCP新版实现.md)

```yml
spring:
  application:
    name: fly-dev-app
  ai:
    ollama:
      base-url: http://172.26.37.0:11434
      embedding:
        enabled: true
        options:
          num-batch: 512
        model: nomic-embed-text
    zhipuai:
      api-key: a9445ac34f0841a899b13699b19c7fb3.NCGDN8fQmcWmMoTd
      chat:
        options:
          model: glm-4-plus
      base-url: https://open.bigmodel.cn/api/paas/
    mcp:
      client:
        stdio:
          servers-configuration: classpath:config/mcp-servers.json
server:
  port: 8090
```

------

## 🧪 三、测试端：AI 联动自动生成并发布 CSDN 文章

### 1. 测试工具注册是否成功

详细配置客户端信息可以浏览[MCP新版实现](MCP新版实现.md)

```java
@Configuration
public class ZhipuConfig {

    @Bean
    public ZhiPuAiApi zhiPuAiApi(@Value("${spring.ai.zhipuai.base-url}") String baseUrl, @Value("${spring.ai.zhipuai.api-key}") String apiKey) {
        return new ZhiPuAiApi(baseUrl, apiKey);
    }


    @Bean
    public ChatClient.Builder zhipuChatClientBuilder(ZhiPuAiChatModel zhipuChatModel) {
        return new DefaultChatClientBuilder(zhipuChatModel, ObservationRegistry.NOOP, (ChatClientObservationConvention) null);
    }
}
```

测试当前有哪些工具可以调用

```java
@Resource
private ToolCallbackProvider toolCallback;
@Resource
private ChatClient.Builder zhipuChatClientBuilder;
@Test
public void testTools() {
    String res = zhipuChatClientBuilder.defaultTools(toolCallback).build().prompt("当前有哪些工具可用").call().chatResponse().getResult().getOutput().getText();
    log.info(res);
}
```

![输出当前工具列表](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/image-20250630133439982.png)

### 2. 自动生成发帖内容并发布

```java
    @Test
    public void testCsdnTool() {
        String prompt = "帮我生成一个Java的快速排序代码,帮我将这些代码以及代码讲解使用Markdown格式,标题为快速排序算法,内容是之前的Markdown格式,标签是Java,描述就简要描述下快速排序算法是什么,然后在CSDN发帖";
        String text = zhipuChatClientBuilder
                .defaultTools(toolCallback)
                .build()
                .prompt(new Prompt(prompt))
                .call()
                .chatResponse()
                .getResult()
                .getOutput()
                .getText();
        log.info(text);
    }
```

📸 自动发帖全过程截图：

![AI 发帖内容生成](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/image-20250630134706731.png)

![生成结果展示](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/image-20250630134728699.png)

📌 注意：CSDN 对频繁发帖行为有限制，避免频繁触发。

------

## ✅ 总结

我们已经完整实现：

- 服务端处理 Markdown 转 HTML 及发帖请求
- 客户端配置 MCP 启动方式
- 测试端集成 AI 工具实现一键发帖

⚠️ 温馨提示：请确保 Cookie 合法有效，发帖频率合理，以免触发平台风控。

欢迎关注我获取更多自动化开发干货！
