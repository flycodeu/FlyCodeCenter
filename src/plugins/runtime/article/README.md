# Article Runtime Plugin

Entry: `src/plugins/runtime/article/index.js`

This plugin owns all post-page runtime enhancements that used to live in
`src/layouts/PostLayout.astro` inline script.

Main responsibilities:

- Anti-crawl lock
- Mermaid / Draw.io / ECharts runtime rendering
- Chart.js card rendering
- Code block toolbar and copy interactions
- KaTeX copy interaction
- Tabs interaction
- Inline icon runtime loading
- View stats sync
- Reading history persistence
- Interactive video coding lessons (loaded only when an article contains `video-coding-demo`)

If you need to change article runtime behavior, start here.

## 在 Markdown 中嵌入编码动画

普通 `.md` 文章可以直接使用下面的 HTML，无需改成 MDX：

```html
<video-coding-demo lesson="prediction" mode="P">
  <p>未启用 JavaScript 时显示的文字说明。</p>
</video-coding-demo>

<video-coding-demo lesson="frame-order">
  <p>解码顺序 I0、P2、B1；显示顺序 I0、B1、P2。</p>
</video-coding-demo>
```

- `prediction` 展示 I/P/B 的预测与残差；`mode` 可选 `I`、`P`、`B`，默认 `P`。
- `frame-order` 展示三帧的参考依赖与解码、显示顺序。
- 每个实例都有独立的播放、暂停、逐步、重置、拖动进度和速度控制。可放大到对话框，按 Esc 或关闭按钮返回。默认静止；离开视口、隐藏页面或路由离开时暂停。
- 支持键盘操作和 `prefers-reduced-motion`，关闭连续搬动效果后仍可逐步阅读。Shadow DOM 隔离文章样式，并继承站点主题变量。
- 使用本地 Canvas 绘图和像素运算，不加载外部动画库或执行文章中的 JavaScript。新教学内容应在模块中实现、注册明确的 lesson，并提供静态文字说明。

实现分为 `video-coding-model.js`（教学计算）、`video-coding-demo.js`（交互与生命周期）、`video-coding-demo.css`（演示样式）。模型没有变换、量化或真实码流打包，不得当成标准编码器或压缩率测量。
