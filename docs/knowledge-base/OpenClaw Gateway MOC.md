---
title: OpenClaw Gateway 知识库 MOC
date: 2026-04-07
tags:
  - openclaw
  - MOC
  - gateway
  - architecture
aliases:
  - OpenClaw Knowledge Base
  - Gateway MOC
type: moc
---

# OpenClaw Gateway 知识库

> [!abstract] Map of Content
> OpenClaw Gateway 全模块知识图谱索引。共 300+ 模块，归类为 20 个主题文档。每个文档深度解析对应子系统的架构、数据流、核心类型和关键接口。

---

## 核心架构

- [[OpenClaw 渠道-路由-Agent-Session 架构全景图]] — 五大核心概念关系总览
- [[WeCom × OpenClaw Gateway 能力全景图]] — WeCom 渠道深度能力分析

## 模块文档

### 基础设施层

| #   | 文档                         | 模块数 | 涵盖范围                                                                        |
| :-- | :--------------------------- | :----: | :------------------------------------------------------------------------------ |
| 01  | [[OC-01 Gateway 核心与协议]] |   6    | WebSocket 服务、HTTP 服务、协议定义、方法注册、Session Store、Control UI        |
| 02  | [[OC-02 RPC API 接口总览]]   |   26   | 全部 Gateway RPC 方法分组：agent/chat/sessions/config/channels/models/tools/... |
| 03  | [[OC-03 配置系统]]           |   11   | Config 加载、Schema 校验、备份轮转、缓存、Channel Capabilities                  |

### 智能体层

| #   | 文档                         | 模块数 | 涵盖范围                                                         |
| :-- | :--------------------------- | :----: | :--------------------------------------------------------------- |
| 04  | [[OC-04 Agent 执行系统]]     |   18   | Agent 定义、Pi 内嵌运行器、Sandbox、工具、技能、超时、Compaction |
| 05  | [[OC-05 SubAgent 与编排]]    |   —    | SubAgent Registry、Spawn 流程、Announcement、深度限制            |
| 06  | [[OC-06 Session 与状态管理]] |   18   | Session Store、生命周期、Transcript、Compaction、Key 管理        |

### 消息管线

| #   | 文档                       | 模块数 | 涵盖范围                                                        |
| :-- | :------------------------- | :----: | :-------------------------------------------------------------- |
| 07  | [[OC-07 Channel 渠道框架]] |   23   | Channel 注册、配置、Pairing、DM Policy、Typing、Thread Bindings |
| 08  | [[OC-08 路由引擎]]         |   5    | 7 层路由评估、Session Key 生成、Binding 管理、Identity Links    |
| 09  | [[OC-09 Chat 消息调度]]    |   5    | Auto-Reply Dispatch、Reply Pipeline、消息模板、Token 管理       |

### 媒体与记忆

| #   | 文档                     | 模块数 | 涵盖范围                                                       |
| :-- | :----------------------- | :----: | :------------------------------------------------------------- |
| 10  | [[OC-10 Media 媒体管线]] |   18   | Media Store、MIME 检测、图片/音频/PDF 处理、Fetch/Download     |
| 11  | [[OC-11 Memory 与 RAG]]  |   17   | 向量数据库、Embedding、混合搜索、MMR、时间衰减、Context Engine |

### 安全与审计

| #   | 文档                     | 模块数 | 涵盖范围                                                       |
| :-- | :----------------------- | :----: | :------------------------------------------------------------- |
| 12  | [[OC-12 安全与审计系统]] |   19   | SSRF 防护、DM Policy、外部内容安全、Skill Scanner、Windows ACL |

### 扩展系统

| #   | 文档                  | 模块数 | 涵盖范围                                                             |
| :-- | :-------------------- | :----: | :------------------------------------------------------------------- |
| 13  | [[OC-13 Hook 系统]]   |   16   | Hook 注册、内部/外部 Hook、消息 Hook、Plugin Hook、Gmail Hook        |
| 14  | [[OC-14 Plugin 系统]] |   7    | Plugin 注册、运行时、类型、配置、Provider Auth                       |
| 15  | [[OC-15 Plugin SDK]]  |   40   | Channel Lifecycle、Config、Reply Pipeline、Agent/Gateway/CLI Runtime |

### 用户界面

| #   | 文档                      | 模块数 | 涵盖范围                                               |
| :-- | :------------------------ | :----: | :----------------------------------------------------- |
| 16  | [[OC-16 CLI 命令系统]]    |   16   | 参数解析、Config CLI、Channels CLI、Agent CLI、ACP CLI |
| 17  | [[OC-17 Terminal 与 TUI]] |   6    | Terminal 管理、TUI、Browser 集成、Canvas Host          |

### 专项系统

| #   | 文档                       | 模块数 | 涵盖范围                                                         |
| :-- | :------------------------- | :----: | :--------------------------------------------------------------- |
| 18  | [[OC-18 Logging 日志系统]] |   10   | Logger 核心、日志脱敏、日志解析、Console Capture                 |
| 19  | [[OC-19 基础设施工具集]]   |   24   | Device Pairing、mDNS、Archive、Delivery、Dedup、Error Handling   |
| 20  | [[OC-20 专项子系统]]       |   10   | Cron Job、Daemon、Markdown、Wizard、Media Understanding、Secrets |

### 渠道插件

| #   | 文档                         | 模块数 | 涵盖范围                                                              |
| :-- | :--------------------------- | :----: | :-------------------------------------------------------------------- |
| 21  | [[OC-21 Extension 插件总览]] |  40+   | 全部扩展插件清单：LLM Provider / Channel / Search / Media / Dev Tools |

---

## 快速导航

> [!tip] 按场景查找
>
> - "消息是怎么从用户到达 Agent 的？" → [[OC-07 Channel 渠道框架]] + [[OC-08 路由引擎]] + [[OC-09 Chat 消息调度]]
> - "如何添加新的 AI 模型？" → [[OC-02 RPC API 接口总览]] (models.\*) + [[OC-03 配置系统]]
> - "插件开发需要了解什么？" → [[OC-14 Plugin 系统]] + [[OC-15 Plugin SDK]]
> - "安全机制有哪些？" → [[OC-12 安全与审计系统]]
> - "记忆/RAG 如何工作？" → [[OC-11 Memory 与 RAG]]
> - "WeCom 完整能力？" → [[WeCom × OpenClaw Gateway 能力全景图]]

---

_知识库生成时间: 2026-04-07 | 基于 OpenClaw Gateway 源码深度分析 (300+ 模块)_
