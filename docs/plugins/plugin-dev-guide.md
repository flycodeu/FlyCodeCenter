# 插件开发指南

目标：新增功能时优先进入插件目录，避免逻辑再次散落到页面和配置文件中。

## 一、Build 插件开发

1. 在 `src/plugins/build/` 新建 `xxx.plugin.mjs`
2. 导出对象：

```js
export const xxxBuildPlugin = {
  id: "xxx",
  setup(siteConfig) {
    return {
      integrations: [],
      remarkPlugins: [],
      rehypePlugins: [],
      markdown: {}
    };
  }
};
```

3. 在 `src/plugins/build/index.mjs` 注册
4. 不要把散落逻辑直接写回 `astro.config.mjs`，统一通过 `src/plugins/core/build-pipeline.mjs` 聚合

## 二、文章页运行时功能开发

1. 先判断是否属于文章页运行时能力
2. 修改 `src/plugins/runtime/article/index.js` 对应模块
3. 如果需要新配置项：
  - 先加到 `src/site.config.ts`
  - 再在 `src/layouts/PostLayout.astro` 的 `define:vars` 注入到 runtime

## 三、Markdown 语法功能开发

1. 语法解析修改：`src/plugins/markdown/build/remark-extended-build.ts`
2. 构建装配修改：`src/plugins/build/markdown.plugin.mjs`
3. 运行时行为修改（如图表渲染）：`src/plugins/runtime/article/index.js`
4. 样式修改：`src/styles/global.css`

## 四、提交流程建议

1. 先完成功能代码
2. 更新文档（至少两处）
  - `docs/plugins/plugin-map.md`
  - `docs/markdown/extended-syntax.md`（若语法有变化）
3. 运行验证：
  - `npm run build`

## 五、禁止事项

- 不要把新逻辑重新塞回 `PostLayout.astro` 的大段 inline script
- 不要在多个页面复制相同运行时代码
- 不要新增没有文档说明的配置项
