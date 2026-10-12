---
title: Vue3点击按钮添加文本框
createTime: '2026/03/01 19:23:46'
code: b2rmlvhtu
permalink: /blog/b2rmlvhtu/
tags:
  - 前端
---

在已有 Vue 3 + Element Plus 项目中，把下面保存为 `SpotEditor.vue`。先完成添加、删除和 JSON 预览，再接入自己的保存接口。

```vue
<script setup>
import { ref } from 'vue'

let nextId = 1
const spots = ref([{ id: nextId++, name: '' }])
const preview = ref('')

function addSpot() {
  spots.value.push({ id: nextId++, name: '' })
}

function removeSpot(id) {
  spots.value = spots.value.filter(spot => spot.id !== id)
}

function previewData() {
  const payload = { nameList: spots.value.map(spot => spot.name.trim()) }
  preview.value = JSON.stringify(payload, null, 2)
}
</script>

<template>
  <el-form>
    <el-form-item v-for="(spot, index) in spots" :key="spot.id" :label="`景点 ${index + 1}`">
      <el-input v-model="spot.name" />
      <el-button type="danger" @click="removeSpot(spot.id)">删除</el-button>
    </el-form-item>
    <el-button @click="addSpot">添加景点</el-button>
    <el-button type="primary" @click="previewData">预览数据</el-button>
    <pre v-if="preview">{{ preview }}</pre>
  </el-form>
</template>
```

每行有稳定的 `id` 作为 key；删除中间一行后，其他输入框仍对应原来的数据。不要用数组下标标识需要保留状态的行。

预览结果如下：

```json
{"nameList":["景点1","景点2"]}
```

本例只在页面预览，不发送请求。接入后端时将这个对象作为 JSON 请求体，在请求成功后显示保存成功；请求失败要保留输入并展示错误。

参考：[Vue 列表渲染与 key](https://vuejs.org/guide/essentials/list.html#maintaining-state-with-key)。
