---
title: Spring Boot接口重复提交与时间窗口去重
createTime: '2026/03/01 19:23:46'
code: b1f5ko1pm
permalink: /blog/b1f5ko1pm/
tags:
  - 防抖
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/4a15bc0b828d64f8b45299f80d4208d.jpg
---

接口重复提交可能来自连续点击，也可能来自网络重试。本文代码演示短时间窗口内拒绝相同请求，需与前端防抖、并发锁和业务幂等区分。

## 三种机制的区别

| 机制 | 处理什么 | 不能单独保证什么 |
| --- | --- | --- |
| 前端防抖 | 事件停止一段时间后再执行 | 无法阻止绕过页面的请求 |
| 时间窗口去重 | 同一个请求 Key 在 TTL 内只接受一次 | TTL 后重试仍可能重复执行业务 |
| 并发锁 | 同一时刻只有一个持有者进入 | 释放后再次调用仍可执行 |
| 业务幂等 | 同一业务操作重复请求仍得到一致的业务效果 | 需要业务唯一键、结果记录或状态约束 |

## 防抖应用场景

1. **用户输入类接口**
   - 示例：搜索框自动补全
   - 处理方式：用户停止输入一段时间后才发请求
2. **按钮点击类接口**
   - 示例：提交订单按钮
   - 处理方式：用户点击后立即锁定按钮，防止重复提交
3. **滚动加载类接口**
   - 示例：列表滚动到底自动加载更多
   - 处理方式：延迟处理滚动事件，防止接口频繁调用

## 如何判断重复请求

判断是否为重复请求可依据以下条件：

1. **时间间隔限制**：设置允许的最小请求间隔；
2. **请求参数对比**：对关键参数（如 `userId`、`orderNo`）进行比对；
3. **请求路径匹配**：同一 URL 与参数组合可以认为是同一请求。

## 防抖方案设计

### 方案一：基于共享缓存实现防抖

使用带过期时间的 `SET key value NX EX/PX` 原子占位，在时间窗口内拒绝相同 Key。设置值与过期时间必须在同一个命令里完成；它不等于完整的业务幂等。参见 [Redis SET](https://redis.io/docs/latest/commands/set/)。

![缓存方案](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/image-20250729102026108.png)

### 方案二：基于分布式锁实现防抖

使用 Redisson 的分布式锁机制，实现多实例部署场景下的防重复请求控制。

![分布式锁方案](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/image-20250729102230621.png)

## 具体实现

### 控制层代码示例

```java
@PostMapping("/add")
@RequiresPermissions("add")
@Log(methodDesc = "添加用户")
public ResponseEntity<String> add(@RequestBody AddReq addReq) {
    return userService.add(addReq);
}
```

### 请求参数类：`AddReq`

```java
@Data
public class AddReq {
    private String userName;
    private String userPhone;
    private List<Long> roleIdList;
}
```

## 注解与 Key 生成

### 注解定义

```java
@Target({ElementType.METHOD, ElementType.PARAMETER, ElementType.FIELD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
public @interface RequestKeyParam {}
```

### Key 生成逻辑

比如文章提交的时候，是不可能将所有的文章内容也传递拼接到key中，我们只需要部分参数，通过解析参数或字段上的 `@RequestKeyParam` 注解，拼接生成唯一请求 Key：

```java
public class RequestKeyGenerator {
    public static String getLockKey(ProceedingJoinPoint joinPoint) {
        Method method = ((MethodSignature) joinPoint.getSignature()).getMethod();
        RequestLock requestLock = method.getAnnotation(RequestLock.class);
        Object[] args = joinPoint.getArgs();
        Parameter[] parameters = method.getParameters();

        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < parameters.length; i++) {
            RequestKeyParam keyParam = parameters[i].getAnnotation(RequestKeyParam.class);
            if (keyParam != null) {
                sb.append(requestLock.delimiter()).append(args[i]);
            }
        }

        if (StringUtils.isEmpty(sb.toString())) {
            Annotation[][] paramAnns = method.getParameterAnnotations();
            for (int i = 0; i < paramAnns.length; i++) {
                Object arg = args[i];
                for (Field field : arg.getClass().getDeclaredFields()) {
                    if (field.isAnnotationPresent(RequestKeyParam.class)) {
                        field.setAccessible(true);
                        sb.append(requestLock.delimiter()).append(ReflectionUtils.getField(field, arg));
                    }
                }
            }
        }

        return requestLock.prefix() + sb;
    }
}
```

## Redis 实现防抖

### 切面拦截器：`RedisRequestLockAspect`

```java
@Aspect
@Configuration
@Order(2)
public class RedisRequestLockAspect {

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Around("@annotation(com.summo.demo.config.requestlock.RequestLock)")
    public Object interceptor(ProceedingJoinPoint joinPoint) {
        Method method = ((MethodSignature) joinPoint.getSignature()).getMethod();
        RequestLock requestLock = method.getAnnotation(RequestLock.class);
        String lockKey = RequestKeyGenerator.getLockKey(joinPoint);

        Boolean success = redisTemplate.execute((RedisCallback<Boolean>) connection ->
            connection.set(lockKey.getBytes(), new byte[0],
                Expiration.from(requestLock.expire(), requestLock.timeUnit()),
                RedisStringCommands.SetOption.SET_IF_ABSENT)
        );

        if (!Boolean.TRUE.equals(success)) {
            throw new BizException(ResponseCodeEnum.BIZ_CHECK_FAIL, "您的操作太快了，请稍后重试");
        }

        try {
            return joinPoint.proceed();
        } catch (Throwable t) {
            throw new BizException(ResponseCodeEnum.BIZ_CHECK_FAIL, "系统异常");
        }
    }
}
```

`SET_IF_ABSENT` 对应 NX：仅当 Key 不存在时设置。请求 Key 还应包含用户或租户作用域，避免不同用户相互阻塞。

## Redisson 分布式锁实现

### Maven 依赖

```xml
<dependency>
    <groupId>org.redisson</groupId>
    <artifactId>redisson-spring-boot-starter</artifactId>
    <version>3.10.6</version>
</dependency>
```

### 配置类：`RedissonConfig`

```java
@Configuration
public class RedissonConfig {

    @Bean
    public RedissonClient redissonClient() {
        Config config = new Config();
        config.useSingleServer()
              .setAddress("redis://127.0.0.1:6379")
              .setPassword("xxxx")
              .setDatabase(0)
              .setConnectionPoolSize(10)
              .setConnectionMinimumIdleSize(2);
        return Redisson.create(config);
    }
}
```

### 切面类：`RedissonRequestLockAspect`

```java
@Aspect
@Configuration
@Order(2)
public class RedissonRequestLockAspect {

    @Autowired
    private RedissonClient redissonClient;

    @Around("@annotation(com.summo.demo.config.requestlock.RequestLock)")
    public Object interceptor(ProceedingJoinPoint joinPoint) {
        Method method = ((MethodSignature) joinPoint.getSignature()).getMethod();
        RequestLock requestLock = method.getAnnotation(RequestLock.class);
        String lockKey = RequestKeyGenerator.getLockKey(joinPoint);

        RLock lock = redissonClient.getLock(lockKey);
        boolean isLocked = false;

        try {
            isLocked = lock.tryLock(0, requestLock.expire(), requestLock.timeUnit());
            if (!isLocked) {
                throw new BizException(ResponseCodeEnum.BIZ_CHECK_FAIL, "您的操作太快了，请稍后重试");
            }

            // 已取得一次锁，不要再次 lock() 增加重入计数。
            return joinPoint.proceed();
        } catch (Throwable t) {
            throw new BizException(ResponseCodeEnum.BIZ_CHECK_FAIL, "系统异常");
        } finally {
            if (isLocked && lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }
}
```

这里的 Redisson 示例提供并发互斥，`finally` 解锁后下一次请求即可进入；不是整个 TTL 内都拒绝请求。显式租约到期后锁会释放，业务耗时超过租约时需要另行处理。

## 两种实现的适用范围

| 项目       | Redis 实现         | Redisson 实现      |
| ---------- | ------------------ | ------------------ |
| 并发支持 | 单次 SET 操作是原子的 | 提供锁持有者与重入语义 |
| 实现复杂度 | 中等               | 稍高               |
| 依赖组件   | `RedisTemplate`    | `RedissonClient`   |
| 场景建议 | 多实例共享时间窗口去重 | 多实例共享并发互斥 |
