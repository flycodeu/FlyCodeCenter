---
title: "Markdown 扩展语法完整演示"
createTime: "2026/03/03 21:20:00"
code: "extshow260303"
permalink: "/article/extshow260303/"
summary: "集中演示代码块窗口、视频、复选框、隐藏文本和警告块扩展能力。"
tags:
  - "markdown"
  - "extension"
  - "shortcode"
---

这篇文章用于验证扩展语法的实际渲染效果。

## 1. 代码块窗口（macOS 风格）

```ts
type Task = {
  id: string;
  done: boolean;
};

export const toggleTask = (task: Task): Task => ({
  ...task,
  done: !task.done
});
```

```bash
npm run dev
npm run build
```

```java
public class HelloWorld {
  public static void main(String[] args) {
    System.out.println("Hello FlyCodeCenter");
  }
}
```

## 2. 视频扩展（实际播放）

[video url="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"][/video]

[video url="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" height="240" width="320"][/video]

[video url="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" autoplay="true"][/video]

## 3. TODO 复选框扩展

[checkbox]默认复选框[/checkbox]

[checkbox checked="true"]已经完成的项目[/checkbox]

[checkbox checked="false"]还未完成的项目[/checkbox]

## 4. 隐藏文本扩展

[hidden]一段隐藏的文本[/hidden]

[hidden type="background"]黑条隐藏文本[/hidden]

[hidden type="blur"]模糊隐藏文本[/hidden]

[hidden tip="你知道的太多了"]鼠标停留会有提示[/hidden]

## 5. 警告块扩展（Admonition）

[admonition]默认警告[/admonition]

[admonition title="我是标题" color="indigo"]靛蓝警告[/admonition]

[admonition title="我是标题" color="green"]绿色警告[/admonition]

[admonition title="我是标题" color="red"]红色警告[/admonition]

[admonition title="我是标题" color="blue"]蓝色警告[/admonition]

[admonition title="我是标题" color="orange"]橙色警告[/admonition]

[admonition title="我是标题" color="black"]黑色警告[/admonition]

[admonition title="我是标题" color="grey"]灰色警告[/admonition]

[admonition title="我是标题" icon="flag" color="indigo"]带标题和图标的警告[/admonition]

[admonition color="indigo"]不带标题的警告[/admonition]

[admonition title="只有标题的警告" color="indigo"][/admonition]

[admonition title="只有标题和图标的警告" icon="flag" color="indigo"][/admonition]

## 6. 语法写法参考

```md
[video url="https://xxx.com/demo.mp4"][/video]
[checkbox checked="true"]完成项[/checkbox]
[hidden type="blur"]模糊隐藏[/hidden]
[admonition title="标题" color="blue"]内容[/admonition]
```
