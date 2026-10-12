---
title: RAG知识库流程实现
createTime: '2026/03/01 19:23:46'
code: bexf18n36
permalink: /blog/bexf18n36/
tags:
  - RAG
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20250611165452.jpg
---

先做一个单文件检索实验：导入自己写的 UTF-8 文本，向量检索后打印命中的原文。这样能单独判断检索是否正确，再接聊天模型生成回答。

## 准备环境

使用 Java 21、Maven、Spring Boot 3.5.16 和 Spring AI 1.1.8。先按 [Ollama 安装](/blog/b2lb91htk/) 启动服务，然后下载 Embedding 模型：

```powershell
ollama pull nomic-embed-text
```

这次使用内存向量库，不需要 PostgreSQL，进程结束后数据丢失。后面的持久化部分说明如何换成 pgvector。

创建空 Maven 项目，保存 `pom.xml`：

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.5.16</version>
    <relativePath/>
  </parent>
  <groupId>example</groupId>
  <artifactId>rag-demo</artifactId>
  <version>1.0.0</version>
  <properties><java.version>21</java.version></properties>
  <dependencyManagement>
    <dependencies>
      <dependency>
        <groupId>org.springframework.ai</groupId>
        <artifactId>spring-ai-bom</artifactId>
        <version>1.1.8</version>
        <type>pom</type><scope>import</scope>
      </dependency>
    </dependencies>
  </dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>org.springframework.ai</groupId>
      <artifactId>spring-ai-starter-model-ollama</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.ai</groupId>
      <artifactId>spring-ai-vector-store</artifactId>
    </dependency>
  </dependencies>
  <build><plugins><plugin>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-maven-plugin</artifactId>
  </plugin></plugins></build>
</project>
```

保存 `src/main/resources/application.yml`：

```yaml
spring:
  main:
    web-application-type: none
  ai:
    model:
      chat: none
    ollama:
      base-url: http://127.0.0.1:11434
      embedding:
        options:
          model: nomic-embed-text
    retry:
      max-attempts: 1
```

## 导入与查询

保存 `src/main/java/example/RagDemo.java`：

```java
package example;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.springframework.ai.document.Document;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.transformer.splitter.TokenTextSplitter;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.SimpleVectorStore;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class RagDemo {
    public static void main(String[] args) throws Exception {
        if (args.length != 2) {
            throw new IllegalArgumentException("参数：UTF-8文件路径 查询问题");
        }
        Path file = Path.of(args[0]);
        if (Files.size(file) > 1024 * 1024) {
            throw new IllegalArgumentException("本实验只接受 1 MiB 以内的文本");
        }
        String text = Files.readString(file, StandardCharsets.UTF_8);
        if (text.isBlank()) throw new IllegalArgumentException("文件为空");
        try (var context = SpringApplication.run(RagDemo.class)) {
            var embedding = context.getBean(EmbeddingModel.class);
            var store = SimpleVectorStore.builder(embedding).build();
            var source = new Document(text, Map.of("source", file.getFileName().toString()));
            var chunks = new TokenTextSplitter().apply(List.of(source));
            store.add(chunks);
            var hits = store.similaritySearch(SearchRequest.builder()
                    .query(args[1]).topK(3).similarityThreshold(0.6).build());
            System.out.println("chunks=" + chunks.size() + ", hits=" + hits.size());
            for (var hit : hits) {
                System.out.println("来源：" + hit.getMetadata().get("source"));
                System.out.println(hit.getText());
            }
        }
    }
}
```

在项目根目录准备 `knowledge.txt`，保存 UTF-8 文本：

```text
实验设备使用 RTSP，端口为 8554。
录像保留 7 天，录像完成后才建立文件索引。
```

运行：

```powershell
mvn package
java -jar target/rag-demo-1.0.0.jar knowledge.txt 'RTSP端口是多少？'
```

先检查 hits 中是否包含“8554”。再问文件里没有的内容，比较检索结果；短文本可能整份都在一个片段里，命中不表示包含答案。0.6 是实验阈值，需要根据真实问题调整。

这里的分词器采用其内置 tokenizer，不等同于所有 Embedding 模型的 tokenizer。长文本还要根据模型输入限制检查切片大小。

## 接聊天模型

检索结果为空时由程序直接返回“未找到相关资料”。有结果时，把问题与命中片段交给聊天模型，并返回来源。聊天模型配置与调用见 [本地 AI 调用](/blog/b2rlufcv7/)，这一步需要另外下载聊天模型。

将资料作为带来源的上下文，提示模型只据资料回答，但仍核对结果。资料中的指令不能获得工具权限；回答里出现一个正确端口也不能证明整段内容可靠。

## 换成 pgvector

按 [pgvector 安装](/blog/b1bhicslx/) 准备数据库。在已有依赖中增加 `spring-ai-starter-vector-store-pgvector`，由同一个 BOM 管理版本。通过自动配置获取 `VectorStore`，替代手工创建的 SimpleVectorStore；不要同时向两个库写入。

数据库配置示例要填自己的密码：

```yaml
spring:
  datasource:
    url: jdbc:postgresql://127.0.0.1:5432/springai
    username: postgres
    password: ${POSTGRES_PASSWORD}
  ai:
    vectorstore:
      pgvector:
        initialize-schema: true
```

这是新增配置片段，合并进已有的同一个 `spring` 节点。先在新实验库运行，初始化需要建表和扩展权限。向量维度由所用 Embedding 模型决定；不要把旧示例的 `vector(1536)` 直接用于 nomic-embed-text，也不要改表维度后继续使用旧向量。

生产导入需保存文档版本与片段 ID，重导入时处理旧片段；相似性查询需要服务端授权过滤。这里的单次实验没有上传接口和多人知识库。

参考：[Spring AI SimpleVectorStore](https://docs.spring.io/spring-ai/reference/1.1/api/vectordbs/simple.html)、[pgvector](https://docs.spring.io/spring-ai/reference/1.1/api/vectordbs/pgvector.html)。
