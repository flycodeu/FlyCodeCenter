---
title: GitHub + Vercel 部署全流程：把评论配置一起带上线
createTime: '2026/03/05 12:58:50'
code: t25e9rug5
permalink: /article/t25e9rug5/
summary: 围绕当前 Astro 内容站的真实部署方式，完成从仓库到 Vercel 上线的完整流程，并把 giscus 评论配置、环境变量和验收步骤一起打通。
series: system-guide
order: 20
tags:
  - tutorial
  - system-guide
  - deploy
  - vercel
cover: https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80
---

## 这篇文章重点解决什么问题
很多人能把网站部署上去，但评论到了线上就开始出问题：

- 本地有评论，线上没有
- 线上评论框显示了，但无法创建 discussion
- Preview 和 Production 命中不同 discussion
- 改了环境变量，却发现页面没变化

这篇文章不再只讲“怎么部署”，而是讲 **怎么把 giscus 评论配置一起稳定带上线**。

## 当前项目的部署前提
默认场景：

- 代码托管在 GitHub
- 网站部署到 Vercel
- 站点由 Astro 构建
- 评论使用 `giscus`

这意味着评论相关配置有两类来源：

### 第一类：站点构建期配置
来源于 [site.config.ts](/D:/FlyLabs/FlyCodeCenter/src/site.config.ts) 及其读取的 `PUBLIC_GISCUS_*` 环境变量。

这类配置包括：

- 仓库名
- 仓库 ID
- category
- category ID
- mapping
- strict
- loading
- 主题映射

### 第二类：GitHub 仓库侧配置
这类配置不在 Vercel 上，而在 GitHub 仓库里：

- Discussions 是否开启
- giscus app 是否安装
- discussion category 是否存在
- 是否启用了 `giscus.json` 的来源限制

## 第一步：确认本地构建没问题
上线前先在本地做一次完整构建：

```bash
npm run build
```

如果本地构建都没过，不要急着看 Vercel。

## 第二步：把仓库导入 Vercel
标准流程：

1. 登录 Vercel
2. `Add New Project`
3. 选择你的 GitHub 仓库
4. 构建命令保持为：

```bash
npm run build
```

5. 点击部署

如果你没有自定义构建目录，当前项目通常不需要额外改输出路径。

## 第三步：配置 giscus 相关环境变量
如果你想把评论配置从代码中分离出来，推荐在 Vercel 设置这些变量：

```env
PUBLIC_GISCUS_REPO=owner/repo
PUBLIC_GISCUS_REPO_ID=R_kgDO...
PUBLIC_GISCUS_CATEGORY=General
PUBLIC_GISCUS_CATEGORY_ID=DIC_kwDO...
PUBLIC_GISCUS_MAPPING=pathname
PUBLIC_GISCUS_TERM=
PUBLIC_GISCUS_STRICT=1
PUBLIC_GISCUS_REACTIONS_ENABLED=1
PUBLIC_GISCUS_EMIT_METADATA=0
PUBLIC_GISCUS_INPUT_POSITION=top
PUBLIC_GISCUS_LANG=zh-CN
PUBLIC_GISCUS_LOADING=lazy
PUBLIC_GISCUS_THEME_LIGHT=light
PUBLIC_GISCUS_THEME_DARK=dark
```

## 第四步：理解“改环境变量为什么要重新部署”
这是 Astro 内容站一个很容易被忽略的点。

当前项目里，`site.config.ts` 会在构建时读取 `PUBLIC_GISCUS_*`。  
所以：

- 你改了 Vercel 环境变量
- 旧构建产物不会自动更新
- 必须重新部署，页面才会拿到新值

结论：**评论相关环境变量变更后，一定要重新部署。**

## 第五步：为什么线上推荐 `pathname` 映射
对于 GitHub + Vercel 场景，这一点非常关键。

### 推荐：`mapping = pathname`
原因：

- 同一路径在本地、Preview、Production 下都稳定
- 不依赖域名
- 不会因为预览地址变化而分裂 discussion

### 不推荐：`mapping = url`
因为 Vercel 存在：

- `Production` 域名
- `Preview` 域名
- 可能还有自定义域名

如果你用 `url`，同一篇文章会因为域名不同被当成不同页面，最终变成多个 discussion。

## 第六步：上线前必须做的评论验收
不要只点开首页看没报错就结束。  
评论系统要按“真正用户操作”来验收。

### 必做检查
1. 打开任意文章页
2. 滚动到底部，确认评论区显示
3. 打开浏览器开发者工具，确认 `giscus.app/client.js` 成功加载
4. 用 GitHub 账号登录评论
5. 发表一条测试评论
6. 回 GitHub Discussions 检查是否命中已有 discussion，或首次创建成功
7. 切换站点主题，确认评论 iframe 主题同步
8. 刷新页面，确认评论仍能正常加载

### 推荐再多做一步
用另一篇文章再测试一次，确认不会出现：

- 两篇文章共用一个 discussion
- 一篇文章重复创建两个 discussion

## 第七步：Preview 与 Production 的验证方式
对于 giscus，建议这样验证：

### Preview 环境
主要验证：

- 评论框能否加载
- 配置字段是否生效
- 主题同步是否正常

### Production 环境
必须验证：

- 真实评论是否能发出
- discussion 是否正确创建
- 最终映射是否稳定

不要只在 Preview 验证一次就认为评论系统已经上线成功。

## 第八步：启用了 `giscus.json` 时要注意什么
如果你后来使用了高级用法里的 `giscus.json`，尤其是：

- `origins`
- `originsRegex`
- `defaultCommentOrder`

上线时要特别注意：

### 如果用了 `origins`
你必须把正式域名加入允许列表。  
否则页面可能能加载主体，但评论 iframe 不工作。

### 如果用了 `originsRegex`
如果你想让 Preview 也能测试评论，就要把 Vercel 预览域名规则考虑进去。

例如：

```json
{
  "originsRegex": [
    "https://.*\\.vercel\\.app"
  ]
}
```

### 如果不想 Preview 真正参与评论
那就只允许正式域名，把 Preview 仅用于页面结构和样式检查，不做真实评论验证。

## 第九步：当前项目里，哪些评论配置更适合放环境变量
推荐你优先把这些字段放到环境变量里：

- `repo`
- `repoId`
- `category`
- `categoryId`
- `mapping`
- `strict`
- `loading`
- `themeLight`
- `themeDark`

这些字段和部署环境、仓库配置关系最强，放环境变量后更利于不同环境管理。

## 第十步：上线后如果评论不正常，先按这个顺序查
1. 页面 `provider` 是否还是 `giscus`
2. 当前部署是否重新构建过
3. Vercel 环境变量是否配置在正确环境
4. GitHub 仓库是否仍然公开
5. Discussions 是否开启
6. giscus app 是否安装在正确仓库
7. category/categoryId 是否匹配
8. 是否错误使用了 `url` 映射
9. 是否被 `giscus.json` 的 `origins` 限制拦住

## 本篇结论
在当前项目里，评论上线成功不只是“前端挂了 giscus 脚本”，而是三件事同时成立：

1. `site.config.ts` 或 `PUBLIC_GISCUS_*` 配置正确
2. GitHub 仓库侧前置条件正确
3. 上线后按真实评论流程完成了验收

只要这三件事缺一项，评论系统都可能表现为“看起来像配置好了，但实际上不能用”。

## 下一篇预告
最后一篇把评论系统、环境变量、部署差异和常见故障放到一个统一清单里，方便你以后发布前逐项核对。
