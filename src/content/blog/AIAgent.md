---
title: AI Agent
createTime: '2026/03/01 19:23:46'
code: b2hovrxub
permalink: /blog/b2hovrxub/
tags:
  - AI
---


## 什么是 Agent

Agent 是一类把模型放进执行循环的软件系统：它接收目标，读取上下文，选择工具，观察结果，再决定下一步。它不等于一个会聊天的接口，也不必同时具备记忆、RAG、MCP 等组件。

大模型负责理解与生成，应用层负责工具权限、状态管理、重试和结果校验。是否使用多模态、记忆、RAG 或 MCP，应由具体任务决定，而不是为了堆组件。

Spring AI 提供了接入大语言模型、工具调用和结构化输出的基础。一个可用的 Agent 通常还需要明确的边界、可观测性和失败兜底。

## 从边界开始设计 Agent

![img](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/%7B7EEC67A9-45FE-44F7-AD14-4A8FCDBC39E9%7D)

![AIAgentFlow.drawio](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/AIAgentFlow.drawio.png)

![AIAgentTimeFlow.drawio](https://flycodeu-1314556962.cos.ap-nanjing.myqcloud.com/codeCenterImg/AIAgentTimeFlow.drawio.png)
