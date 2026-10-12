---
title: Vercel部署ChatGpt
createTime: '2026/03/01 19:23:46'
code: bos2d0vsi
permalink: /blog/bos2d0vsi/
tags:
  - AI
---

这篇文章记录早期 ChatGPT-Next-Web 的部署界面。项目现名为 NextChat，当前配置请核对 [项目 README](https://github.com/ChatGPTNextWeb/NextChat/blob/main/README_CN.md)。

## ChatGPT-Next-Web
开源项目，跨平台无需服务器就可部署自己的gpt网页端口
地址[https://github.com/Yidadaa/ChatGPT-Next-Web](https://github.com/Yidadaa/ChatGPT-Next-Web)

## 优点
1. 一键部署
2. 兼容各个系统
3. 数据存储本地
4. 支持markdown
5. 支持自定义

## 使用条件
1. 拥有vercel账号
 注册地址  https://vercel.com/dashboard，绑定github账号
2. 准备模型服务的 API Key，并确认 API 项目有可用额度
3. 将ChatGPT-Next-Web  fork到自己的github仓库

## 开始使用
1. gpt的key获取
官网地址https://platform.openai.com/account/api-keys
![gptv-1](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com//codeCenterImg/gptv-1.png)
点击创建新的key
![gptv-2](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com//codeCenterImg/gptv-2.png)
保存好这个key
2. vercel部署
主界面![gptv-3](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com//codeCenterImg/gptv-3.png)
点击Add new Project创建新项目
找到自己之前的fork项目,点击import
![gptv-4](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com//codeCenterImg/gptv-4.png)

下拉找到Environment Variables
![gptv-5](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com//codeCenterImg/gptv-5.png)
第一个填入OPENAI_API_KEY
第二个填入自己的gpt的key

当前 NextChat 使用 `HIDE_USER_API_KEY=1` 隐藏用户填写 API Key 的入口。服务端配置共享密钥时，还应设置 `CODE` 作为页面访问密码；修改环境变量后重新部署。

点击部署，等待
![gptv-6](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com//codeCenterImg/gptv-6.png)

3. 部署成功
![gptv-7](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com//codeCenterImg/gptv-7.png)

4. 去往自己的gpt
点击continue
![gptv-8](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com//codeCenterImg/gptv-8.png)
里面的domain就是自己的域名地址，点击就能进入
![gptv-9](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com//codeCenterImg/gptv-9.png)

5. 配置域名
点击右上角的domain可以配置自己的域名
![gptv-10](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com//codeCenterImg/gptv-10.png)

## API 提示额度不足

检查 API 平台的账单与项目额度。ChatGPT 订阅和 API 分开计费，不能根据 ChatGPT 免费或付费状态判断 API 是否可用。[OpenAI 计费说明](https://help.openai.com/en/articles/9039756-managing-billing-settings-on-chatgpt-web-and-platform)
![gptv-11](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com//codeCenterImg/gptv-11.png)
