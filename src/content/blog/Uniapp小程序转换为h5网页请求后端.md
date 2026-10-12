---
title: Uniapp小程序转换为h5网页请求后端
createTime: '2026/03/01 19:23:46'
code: b2k501gg8
permalink: /blog/b2k501gg8/
tags:
  - 前端
---

uni-app 的小程序请求可以直接访问已配置的服务域名，H5 则受浏览器同源策略约束。开发代理解决本地联调，部署后需要由 Web 服务器或后端提供实际跨域配置。

## Vue 3 / Vite 项目

在已有 `vite.config.js` 合并 server 配置，不删除项目原来的 uni 插件：

```javascript
import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig({
  plugins: [uni()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:9000',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, ''),
      },
    },
  },
})
```

请求示例：

```javascript
uni.request({
  url: '/api/health',
  success: response => console.log(response.statusCode, response.data),
  fail: error => console.error(error.errMsg),
})
```

这个例子要求后端有 `http://127.0.0.1:9000/health`。浏览器先请求当前 H5 开发服务器的 `/api/health`，开发代理去掉 `/api` 后转发给后端。后端本身已有 `/api` 前缀时，删除 rewrite，不能再次去掉前缀。

## Vue 2 / webpack 项目

旧 Vue 2 项目使用 manifest.json 的 `h5.devServer.proxy` 配置，重写字段是 pathRewrite；不要把它直接移植到 Vite 项目，也不需要设置 `disableHostCheck: true`。确认项目构建器后按对应文档配置。

## 部署后核对

Vite 开发代理不会写入静态产物。生产使用同源反向代理 `/api`，或实际 API 域名加后端可信来源 CORS 配置。history 路由还需要 Web 服务器回退到入口页，与 API 代理是两个配置。

先从浏览器网络面板检查请求 URL、HTTP 状态和响应；HTTP 请求成功但业务返回失败时，不应仅凭 success 回调显示“操作成功”。小程序端还需使用合法域名与自己的环境地址，不能照抄 H5 的相对路径。

参考：[uni-app H5 配置](https://uniapp.dcloud.net.cn/collocation/manifest.html#h5)、[Vite server.proxy](https://vite.dev/config/server-options.html#server-proxy)。
