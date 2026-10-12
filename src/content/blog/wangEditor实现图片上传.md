---
title: wangEditor实现图片上传
createTime: '2026/03/01 19:23:46'
code: bhehiqz9b
permalink: /blog/bhehiqz9b/
tags:
  - 前端
---

这里使用 Vue 3、wangEditor 5 和它的 Vue 3 适配包。编辑器只负责提交图片和插入返回的 URL，实际保存由后端完成。

```bash
npm install @wangeditor/editor@5 @wangeditor/editor-for-vue@5
```

在已有 Vue 3 项目保存组件：

```vue
<template>
  <Toolbar :editor="editor" :defaultConfig="toolbarConfig" mode="default" />
  <Editor v-model="html" :defaultConfig="editorConfig"
    mode="default" @onCreated="created" style="height:400px" />
</template>

<script setup>
import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import '@wangeditor/editor/dist/css/style.css'

const editor = shallowRef()
const html = ref('')
const toolbarConfig = {}
const editorConfig = {
  placeholder: '请输入正文',
  MENU_CONF: {
    uploadImage: {
      server: '/api/images',
      fieldName: 'file',
      maxFileSize: 5 * 1024 * 1024,
      maxNumberOfFiles: 1,
      allowedFileTypes: ['image/png', 'image/jpeg'],
      timeout: 20000,
    },
  },
}
function created(instance) { editor.value = instance }
onBeforeUnmount(() => editor.value?.destroy())
</script>
```

`/api/images` 使用同源地址。Vite 开发时可配置 `/api` 代理到后端，部署时配置反向代理；开发代理不会自动进入生产。认证请求头和 CSRF 参数按实际项目添加，不引用不存在的 store 或假设所有项目使用 token。

## 返回格式

成功响应必须是合法 JSON，errno 为数字 0：

```json
{"errno":0,"data":{"url":"https://example.com/images/demo.png","alt":"示例图片"}}
```

失败使用该编辑器支持的失败响应或 HTTP 错误，不返回 errno=0 加空 URL。后端参考 [七牛图片上传](/blog/bzjza4ilr/)；其中临时签名 URL 适合即时预览，正式文章需要持久访问策略或展示时重新生成地址，不能直接保存五分钟后失效的外链。

检查上传请求的 multipart 字段是否为 file、响应是否匹配、URL 能否访问。还要确认卸载组件后编辑器销毁，前端限制之外的超大和伪造文件能被后端拒绝。

编辑器 HTML 不直接视为可信内容；最终展示按自己的允许标签与属性规则处理。

参考：[Vue 3 接入](https://www.wangeditor.com/v5/for-frame.html#vue3)、[图片上传配置](https://www.wangeditor.com/v5/menu-config.html#上传图片)。
