---
code: projects-page
title: 项目控制台
description: 以优先级和状态管理项目，突出关键战场与可交付成果。
projects:
  sectionOrder:
    - completed
    - in-progress
    - planned
  coverFallback:
    completed: /covers/project-completed.svg
    in-progress: /covers/project-in-progress.svg
    planned: /covers/project-planned.svg
  highlights:
    title: 当前主线
    subtitle: ""
    topPriorityLabel: 最高优先级
  sections:
    completed:
      title: 已完成
      description: ""
    in-progress:
      title: 进行中
      description: ""
    planned:
      title: 规划中
      description: ""
  stats:
    total: 项目总数
    completed: 已完成
    planned: 规划中
  labels:
    sectionCountSuffix: 项
    empty: 暂无项目，后续补充。
    featured: 重点
    priorityPrefix: P
    publishDate: 发布时间
    tags: 标签
    unsetTags: 未设置
    noDescription: 暂无描述
    detail: 查看详情
    repo: 仓库
    doc: 文档
    demo: 演示
---

项目内容来自 `src/content/projects/**/README.md`。本页的分组、文案、优先级标识和默认封面都由该配置驱动。
