# 从旧结构迁移到插件化结构

## 迁移动机

旧结构里，配置与实现分散在：

- `astro.config.mjs`
- `src/layouts/PostLayout.astro`（大段 inline script）
- `src/config/*`
- `src/utils/markdown/*`

问题是新增功能时很难快速定位修改点，维护成本持续上升。

## 本次迁移内容

1. 新增 Build 插件体系
  - `src/plugins/build/*.plugin.mjs`
  - `src/plugins/core/build-pipeline.mjs`
2. `astro.config.mjs` 改为插件聚合输出
3. 文章页运行时代码从 `PostLayout.astro` 抽离到
  - `src/plugins/runtime/article/index.js`
4. Markdown 扩展构建逻辑抽离到
  - `src/plugins/markdown/build/*`
5. 代码高亮 provider 解析抽离到
  - `src/plugins/code-highlight/resolve-config.ts`
6. 建立文档体系，统一描述配置与扩展路径

## 对业务行为的影响

- 页面功能行为：保持不变
- 代码组织方式：集中到插件目录，便于扩展与管理

## 后续可选优化

1. 继续拆分 `src/plugins/runtime/article/index.js` 为多个 runtime 子模块
2. 将 `site.config.ts` 里插件相关字段做更强类型分组（例如 `plugins.*`）
