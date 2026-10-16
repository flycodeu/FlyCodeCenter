# 浏览器 Web Crypto 与 Java 登录加密示例

这是一个独立的协议互通样例：浏览器加密虚构登录数据，Java 解密并检查固定值。使用 Java 21、Spring Boot 3.5.16；运行依赖只有 Spring Web starter（其中包含 Jackson），不需要数据库、Redis或前端构建工具。

**示例不是完整认证系统。** 固定演示账号、密码和验证码写在源代码中，全部是公开虚构值。页面不接受真实凭据，也不会建立真实登录身份。它没有用户库、密码哈希、验证码签发、Redis防重放、多节点协调、权限、锁定、限流或生产运维配置。

## 下载后运行

安装 JDK 21 和 Maven 3.9。解压后在包含 `pom.xml` 的目录打开 PowerShell：

```powershell
java -version
mvn -version
mvn spring-boot:run
```

前两条应显示 Java 21 或更高版本，尤其检查 Maven 使用的 JDK。随后打开 **http://127.0.0.1:8080/**，不要使用 `file://` 或博客网站上的静态HTML地址。后端、页面和请求必须来自同一个示例服务。

正常请求应显示 `200 / DEMO_MATCH`；篡改密文应显示 `400 / ENVELOPE_REJECTED`；重放演示的第一次200、第二次400。120秒到期边界通过下方的独立时钟程序验证，无需等待。

如果8080被占用，端口与允许Origin需一起改：

```powershell
mvn spring-boot:run "-Dspring-boot.run.arguments=--server.port=18080 --demo.origin=http://127.0.0.1:18080"
```

地址也改为 `http://127.0.0.1:18080/`。按 Ctrl+C 停止。服务只绑定本机127.0.0.1，不应直接暴露公网。

## 阅读顺序

| 文件 | 作用 |
|---|---|
| `src/main/resources/static/crypto-protocol.mjs` | 浏览器端P-256密钥协商、HKDF派生、AES-GCM加密；Node验证复用同一实现 |
| `src/main/java/dev/flycode/example/LoginCipher.java` | Java临时密钥、期限检查、派生和解密 |
| `src/main/java/dev/flycode/example/LoginController.java` | 两个HTTP端点、Session消费、最小来源及CSRF校验 |
| `src/main/resources/static/demo.mjs` | 页面发送正常、篡改及重放请求 |
| `scripts/verify-http.mjs` | 使用Node内置WebCrypto/fetch进行真实HTTP互通验证 |
| `src/test/java/dev/flycode/example/CipherBoundaryChecks.java` | 注入固定时钟，无等待验证120秒到期边界 |

## 两个接口

`GET /auth/login/challenge` 创建或更新当前HttpSession的挑战，响应JSON只有 `challengeId` 和 `serverPublicKey`。响应头 `X-CSRF-Token` 返回当前会话的同步Token，并设置HttpOnly、SameSite=Lax的 `DEMO_SESSION` Cookie。

`POST /auth/login/secure` 带同一Cookie、`Origin`、`X-CSRF-Token`，Content-Type为application/json。浏览器会自动发送Cookie与Origin；JavaScript只设置CSRF和内容类型。JSON只有四个字段。以下尖括号内是结构占位符，不能直接提交；实际值由运行中的浏览器生成：

```json
{
  "challengeId": "<32-lowercase-hex-characters>",
  "clientPublicKey": "<base64url-spki-public-key>",
  "iv": "<base64url-12-byte-iv>",
  "ciphertext": "<base64url-ciphertext-and-tag>"
}
```

| 字段 | 实际内容 |
|---|---|
| `challengeId` | 32位小写十六进制挑战ID |
| `clientPublicKey` | 客户端SPKI公钥，无填充Base64URL编码 |
| `iv` | 12字节随机IV，无填充Base64URL编码 |
| `ciphertext` | 密文与16字节GCM标签拼接后，无填充Base64URL编码 |

密文内部是 `{username, password, captchaId, captchaAnswer}`。演示为了集中展示协议，省略业务系统统一响应包装，也把独立CSRF准备接口合并为挑战响应头；这不是业务系统接口的直接替代品。

## 算法与会话边界

- 双方使用P-256（Java名称secp256r1）的临时ECDH密钥对，公钥采用SPKI格式。
- HKDF-SHA256的salt是challengeId十六进制解码后的16字节，info固定为 `streamfusion-login-v1`，派生32字节AES密钥。
- AES-256-GCM使用随机12字节IV、128位认证标签；AAD是challengeId的ASCII/UTF-8字节（对这个十六进制ID两者相同）。Base64URL只是编码。
- 挑战签发120秒后拒绝，恰好第120秒也拒绝；新挑战替换旧挑战。单进程内通过Session同步块，先移除挑战再解密，避免并发重放。错密文或错ID也会消费当前挑战。
- 挑战绑定Session。两个普通标签通常共享Cookie，因此共享一个挑战槽；需要独立浏览器会话才能模拟不同Session。Node脚本分别维护Cookie模拟这一情况。
- 示例Session仅在当前Java进程内存中；私钥属性没有独立120秒物理删除定时器。消费、覆盖或Session失效会释放属性；Java垃圾回收不保证即时擦除。生产的Redis/多节点原子消费需另外实现。

CSRF与加密解决不同问题：示例写请求要求配置的精确Origin以及Session绑定的随机CSRF Token，不启用跨域放行；挑战接口拒绝明确的跨站来源。这个最小校验不能替代生产框架的完整安全配置。Origin与CSRF都不是用户身份，非浏览器客户端也能创建自己的演示会话。

生产仍必须HTTPS：它保护页面脚本、公钥真实性、Cookie和全部接口。附加ECDH/AES加密不能独自抵御公钥被中间人替换，也不能防止同源恶意脚本读取用户输入。本机HTTP示例的Secure Cookie为false，不应照搬为生产配置。

## 验证

服务启动后，在第二个终端使用Node 20或更高版本（不安装npm依赖）：

```powershell
node scripts/verify-http.mjs
# 自定义端口时：node scripts/verify-http.mjs http://127.0.0.1:18080
```

脚本真实请求Java服务，验证正常WebCrypto互通、GCM篡改、一次性消费、并发重放、跨Session、替换旧挑战、CSRF、Origin、IV/公钥/密文长度及2048字节明文边界。只打印用例结果，不打印密码或密钥。

到期检查独立运行，不需要服务，也不用等待120秒；没有引入JUnit。下面的 `test-compile` 只编译，最后一行才实际执行4项检查：

```powershell
mvn test-compile dependency:build-classpath "-Dmdep.outputFile=target/runtime-classpath.txt"
$demoDependencies = (Get-Content -Raw target/runtime-classpath.txt).Trim()
java -cp "target/test-classes;target/classes;$demoDependencies" dev.flycode.example.CipherBoundaryChecks
```

期望输出 `PASS: 4 clock/challenge checks`，包括119秒通过、120秒及121秒拒绝、缺失挑战拒绝。非预期结果抛出错误并以非零状态退出。不要把单独的 `mvn test` 当成已执行这些独立检查。

本示例验证的是协议互通和列出的边界，未覆盖真实账户认证、生产TLS部署、多节点、负载或安全审计。
