---
title: Jenkins常见构建方式
createTime: '2026/03/01 19:23:46'
code: b1mkjd1cj
permalink: /blog/b1mkjd1cj/
tags:
  - Jenkins
cover: 'https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/logo.png'
coverStyle:
  layout: right
---

## 构建方式

![image-20250305090918858](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/image-20250305090918858.png)

## 定时构建

这个定时和其他不一样，不支持秒

https://crontab.guru/

![image-20250305091646627](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/image-20250305091646627.png)

![image-20250305091706539](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/image-20250305091706539.png)

```
H(1-30) * * * *
```

`H(1-30)` 根据任务名称的哈希，在 1～30 分钟范围内选择一个相对稳定的分钟值，不是每小时重新随机。它用于分散任务触发时间，但不能保证所有任务都不重叠。参见 [Jenkins cron 语法](https://www.jenkins.io/doc/book/pipeline/syntax/#cron-syntax)。

![image-20250305092437429](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/image-20250305092437429.png)
