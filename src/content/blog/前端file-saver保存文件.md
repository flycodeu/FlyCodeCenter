---
title: 前端file-saver保存文件
createTime: '2026/03/01 19:23:46'
code: b28rg4wna
permalink: /blog/b28rg4wna/
tags:
  - 前端
---

FileSaver.js 在浏览器中触发文件保存，适合下载已经取得的 Blob，或处理可访问的文件 URL。

## 安装与调用

```bash
npm install file-saver
```

```ts
import { saveAs } from 'file-saver'

export function downloadFile(url: string, fileName: string) {
  saveAs(url, fileName)
}
```

同源 URL 可以直接使用。跨域 URL 是否能以指定名称下载，取决于文件服务的 CORS 响应；FileSaver.js 无法绕过服务端的跨域限制。

## 保存前端生成的文本

```ts
import { saveAs } from 'file-saver'

const file = new Blob(['演示内容'], { type: 'text/plain;charset=utf-8' })
saveAs(file, 'example.txt')
```

文件已经由后端生成时，也可以由后端通过 `Content-Disposition: attachment` 指定下载行为。接口鉴权、响应类型和错误处理仍需要按项目配置。

具体支持情况见 [FileSaver.js 文档](https://github.com/eligrey/FileSaver.js)。
