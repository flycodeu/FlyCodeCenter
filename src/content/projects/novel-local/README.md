---
title: Novel Local 小说 AI 生成器
createTime: "2026/03/02 10:00:00"
code: novel-local
permalink: /article/novel-local/
summary: 本地桌面端小说 AI 生成器，支持多小说管理、8 阶段分步生成与全量数据追溯。
tags:
  - Electron
  - React
  - SQLite
  - AI
cover: "https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/20260302202916561.png"
---

## 项目简介

Novel Local 是本地桌面端“小说 AI 生成器”，面向创作流程提供结构化生成与管理能力。

## 核心能力

- 多小说管理
- 模板系统（类型/背景/风格/人物/地图）
- 多模型 Provider（DeepSeek/OpenAI 兼容/Mock）
- 分步生成（8 阶段）
- 人物逐个生成与关系图
- 大纲、章节规划、章节正文多版本
- SQLite 全量落库与 AI 调用追溯
- JSON 导入导出与断点恢复

## 技术栈

- UI: React + TypeScript + Vite + Ant Design
- Desktop: Electron
- DB: SQLite（better-sqlite3）
- Graph: reactflow

## 链接

- GitHub：<https://github.com/flycodeu/novel-local>

## 项目截图

![Novel Local 主页](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/20260302202916561.png)
