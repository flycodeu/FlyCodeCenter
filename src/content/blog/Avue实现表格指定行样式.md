---
title: Avue实现表格指定行样式
createTime: '2026/03/01 19:23:46'
code: bu5uxcnkk
permalink: /blog/bu5uxcnkk/
tags:
  - 前端
---

下面使用 Vue 2 + Avue 2 的写法，要求项目已安装 Avue。Vue 3 / Avue 3 应核对对应版本的组件参数和深度选择器。

`row-class-name` 返回的是 CSS 类名，参数里使用 `row` 和 `rowIndex`。把状态为 `warning` 的行标红：

```vue
<template>
  <avue-crud :option="option" :data="rows" :row-class-name="rowClassName" />
</template>

<script>
export default {
  data() {
    return {
      rows: [{ name: '正常记录', status: 'ok' }, { name: '待处理记录', status: 'warning' }],
      option: {
        column: [{ label: '名称', prop: 'name' }, { label: '状态', prop: 'status' }]
      }
    }
  },
  methods: {
    rowClassName({ row }) {
      return row.status === 'warning' ? 'warning-row' : ''
    }
  }
}
</script>

<style>
.el-table .warning-row > td {
  background-color: #fff0f0;
}
</style>
```

第二行单元格背景应变为浅红。示例样式未加 `scoped`，便于作用到组件内部；使用 scoped 样式时要按项目的 Vue 编译版本配置深度选择器。原示例里的 `a098` 是业务字段，接入实际表格时换成自己的判断条件。

参考：[Avue 2 CRUD 属性](https://v2.avuejs.com/crud/crud-doc/)。
