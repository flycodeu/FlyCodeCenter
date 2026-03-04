# FlyCodeCenter 文档中心

这套文档用于说明两件事：

1. 如何配置 `src/site.config.ts`
2. 功能在插件目录中的具体位置，后续应修改哪里

## 1. 系统配置

- [系统配置总览](./config/system-config.md)
- [主题与字体配置](./config/theme-and-font.md)

## 2. Markdown 扩展

- [扩展语法说明](./markdown/extended-syntax.md)
- [完整演示模板](./markdown/showcase.md)

## 3. 插件架构

- [插件功能地图](./plugins/plugin-map.md)
- [插件开发指南](./plugins/plugin-dev-guide.md)

## 4. 迁移说明

- [从旧结构迁移到插件化结构](./migration/v1-to-plugin-architecture.md)

## 5. 博客总文档

- [系统功能与语法完整使用手册](/article/system-user-guide/)
- [系统扩展开发手册（插件与语法扩展）](/article/system-extension-guide/)

## 快速定位

- 改系统配置项：`src/site.config.ts`
- 改 Astro 构建入口：`astro.config.mjs`
- 改 Markdown 构建解析：`src/plugins/markdown/build/*`
- 改代码块高亮 provider：`src/plugins/code-highlight/resolve-config.ts`
- 改文章页运行时功能（代码块复制、图表、反爬、阅读统计等）：`src/plugins/runtime/article/index.js`
- 改构建插件装配顺序：`src/plugins/build/index.mjs`
