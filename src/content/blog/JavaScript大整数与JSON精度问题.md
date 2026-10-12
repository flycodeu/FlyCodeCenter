---
title: JavaScript大整数与JSON精度问题
createTime: '2026/03/01 19:23:46'
code: b2puex53r
permalink: /blog/b2puex53r/
tags:
  - Java
cover: https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/7e598d39ffe7f2e174751f73207be9a5.jpg
---

JavaScript 的 `Number` 只能保证 `-(2^53-1)` 到 `2^53-1` 范围内的整数精确。数据库 Long ID 超过这个范围时，应在 JSON 中作为字符串传输。

## 在浏览器控制台验证

```js
const wrong = JSON.parse('{"id":9007199254740993}')
console.log(wrong.id) // 9007199254740992，已经丢失精度

const correct = JSON.parse('{"id":"9007199254740993"}')
console.log(correct.id) // "9007199254740993"
console.log(BigInt(correct.id) + 1n) // 9007199254740994n
```

不要把已解析的 `wrong.id` 转字符串或 BigInt，希望恢复原始值；精度已经在解析时丢失。ID 只用于比较、传输和查找时，保持字符串即可。

## JSON 与 BigInt

普通 `JSON.stringify` 不能直接序列化 BigInt。明确把该字段转成字符串：

```js
const payload = { id: 9007199254740993n }
const json = JSON.stringify({ id: payload.id.toString() })
console.log(json) // {"id":"9007199254740993"}
```

后端 Jackson 配置见 [Long 序列化为字符串](/blog/b1ckhf6gb/)。前后端应约定同一个字段类型，避免一会儿是数字、一会儿是字符串。

参考：[MDN 安全整数](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER)、[MDN BigInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt)。
