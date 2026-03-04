# 主题与字体配置

## 一、主题配置

- 文件：`src/site.config.ts`
- 路径：`theme.*`

常用字段：

- `theme.defaultTheme`：默认主题
- `theme.switchableThemes`：可切换主题列表
- `theme.toggle.*`：主题切换按钮样式与行为

## 二、字体预设配置

- 文件：`src/site.config.ts`
- 路径：`theme.typography`

示例：

```ts
theme: {
  typography: {
    fontPresetDefault: "pixel", // regular | pixel
    fontPresets: {
      regular: {
        sans: "...",
        serif: "...",
        display: "...",
        tech: "...",
        mono: "..."
      },
      pixel: {
        sans: "...",
        serif: "...",
        display: "...",
        tech: "...",
        mono: "..."
      }
    }
  }
}
```

## 三、如何切换字体

## 1) 通过配置切换（推荐）

在 `src/site.config.ts` 修改：

```ts
fontPresetDefault: "regular"
```

或：

```ts
fontPresetDefault: "pixel"
```

## 2) 浏览器临时切换（调试）

在控制台执行：

```js
document.documentElement.dataset.fontPreset = "regular";
// 或
document.documentElement.dataset.fontPreset = "pixel";
```

## 四、为什么 `"pixel" as "regular" | "regular"` 不是普通字体

这段写法的问题是“值”和“类型断言”混在一起：

- 实际值仍然是 `"pixel"`，所以运行时展示像素字体
- `"regular" | "regular"` 这个联合类型本身也写错了，应是 `"regular" | "pixel"`

正确写法请直接写值，不需要强制断言：

```ts
fontPresetDefault: "regular"
```

## 五、字体实现位置

- 根注入：`src/layouts/BaseLayout.astro`
  - 设置 `data-font-preset` 和 `data-font-preset-list`
- CSS 变量映射：`src/styles/global.css`
  - `:root[data-font-preset="regular"]`
  - `:root[data-font-preset="pixel"]`
- 像素字体资源：`public/fonts/pixel/zpix.ttf`
