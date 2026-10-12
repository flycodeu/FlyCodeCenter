---
title: Vant实现搜索框动态展示数据列表
createTime: '2026/03/01 19:23:46'
code: bdfkmydvm
permalink: /blog/bdfkmydvm/
tags:
  - 前端
---

这个例子使用 Vue 3 + Vant 4，在弹窗里过滤本地单位列表。它不会请求后端；接接口时，再把示例数组替换成经过校验的返回结果。

```bash
npm install vant@4
```

保存为 Vue 单文件组件：

```vue
<template>
  <Field :model-value="chosen.text" label="单位" readonly
    placeholder="选择单位" @click="show = true" />
  <Popup v-model:show="show" position="bottom">
    <Search v-model="keyword" placeholder="搜索单位名称" />
    <Picker :columns="columns" @confirm="confirm" @cancel="show = false" />
  </Popup>
  <pre>{{ chosen }}</pre>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Field, Popup, Search, Picker } from 'vant'
import 'vant/lib/index.css'

const show = ref(false)
const keyword = ref('')
const chosen = ref({ text: '', value: '' })
const units = [
  { text: '示例研发单位', value: 'dev' },
  { text: '示例运维单位', value: 'ops' },
]
const columns = computed(() => {
  const query = keyword.value.trim().toLocaleLowerCase()
  return units.filter(item => item.text.toLocaleLowerCase().includes(query))
})
function confirm({ selectedOptions }) {
  const option = selectedOptions[0]
  if (!option) return
  chosen.value = { text: option.text, value: option.value }
  show.value = false
}
</script>
```

Vant 4 的 Popup 用 `v-model:show`，Picker confirm 的参数是含 selectedOptions 的对象；旧 Vant 2 的参数与 Vue 2 绑定方式不能混用。

输入“研发”时应只剩研发单位，清空恢复全部，搜索无结果时不要覆盖原选择。这里只做本地 computed 过滤，不需要防抖网络请求。后端搜索才需要控制频率，并处理旧请求晚于新请求返回的情况。

参考：[Vant 4 Picker](https://vant-ui.github.io/vant/#/zh-CN/picker)。
