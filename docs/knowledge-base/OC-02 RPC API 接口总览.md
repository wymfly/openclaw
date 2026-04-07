---
title: OC-02 RPC API 接口总览
date: 2026-04-07
tags:
  - openclaw
  - rpc
  - api
  - gateway-methods
type: module-doc
---

# OC-02 RPC API 接口总览

> [!info] 归属
> 本文隶属于 [[OpenClaw Gateway MOC]]，覆盖 Gateway 所有 RPC 方法的签名、权限与分组。

## 1. 概述

OpenClaw Gateway 通过 **JSON-RPC over WebSocket** 提供所有控制面与数据面接口。客户端建立 WebSocket 连接后，以 `connect` 帧完成身份验证和 capability 协商，后续所有请求均为 `{method, params, id}` 格式的 JSON-RPC 调用，响应为 `{ok, result?, error?, id}` 帧。

### 1.1 认证与权限模型

Gateway 采用 **scope-based authorization**（基于角色的方法级鉴权）：

| Scope                | 含义                                | 典型持有者                 |
| -------------------- | ----------------------------------- | -------------------------- |
| `operator.read`      | 只读查询                            | 所有已认证客户端           |
| `operator.write`     | 写入操作（发送消息、调用 agent）    | CLI、Dashboard、Apps       |
| `operator.admin`     | 管理操作（配置、删除、安装）        | CLI owner、Dashboard admin |
| `operator.approvals` | 执行审批（approve/deny tool calls） | Apps、Dashboard            |
| `operator.pairing`   | 设备/节点配对管理                   | CLI、macOS App             |
| `node`               | 节点内部方法（pull/ack/drain）      | 已配对 Node 节点           |

> [!important] 权限继承
> `operator.admin` 隐式包含所有其他 operator scope 的权限。`operator.write` 隐式包含 `operator.read`。以 `exec.approvals.`、`config.`、`wizard.`、`update.` 为前缀的方法默认归入 `operator.admin`。

### 1.2 协议版本

- **Protocol Version**: 通过 `gateway.describe` 返回的 `protocol` 字段标识
- **Schema Version**: TypeBox 生成的 schema 版本字符串
- **Client Capabilities**: 连接时通过 `caps` 数组协商（见第 5 节）

---

## 2. 方法分类总览

Gateway 注册方法总数：**~130+**（含核心方法 + channel plugin 动态注册方法）。以下按功能域分组。

### 2.1 快速索引

| 分组                          | 方法数          | Scope 范围 | 文件位置                    |
| ----------------------------- | --------------- | ---------- | --------------------------- | ------------------------------------------ |
| [[#3.1 Agent 运行             | Agent]]         | 3          | write / read                | `agent.ts`                                 |
| [[#3.2 Agents 管理            | Agents 管理]]   | 7          | read / admin                | `agents.ts`                                |
| [[#3.3 Chat (WebSocket)       | Chat]]          | 3          | read / write                | `chat.ts`                                  |
| [[#3.4 Sessions               | Sessions]]      | 18         | read / write / admin        | `sessions.ts`                              |
| [[#3.5 Config                 | Config]]        | 6          | read / admin                | `config.ts`                                |
| [[#3.6 Channels               | Channels]]      | 2          | read / admin                | `channels.ts`                              |
| [[#3.7 Models                 | Models]]        | 3          | read                        | `models.ts`, `models-catalog-providers.ts` |
| [[#3.8 Tools                  | Tools]]         | 2          | read / admin                | `tools-catalog.ts`, `tools-effective.ts`   |
| [[#3.9 Skills                 | Skills]]        | 4          | read / write / admin / node | `skills.ts`                                |
| [[#3.10 TTS                   | TTS]]           | 6          | read / write                | `tts.ts`                                   |
| [[#3.11 Talk                  | Talk]]          | 3          | read / write                | `talk.ts`                                  |
| [[#3.12 Exec Approval         | Exec Approval]] | 6          | approvals                   | `exec-approval.ts`, `exec-approvals.ts`    |
| [[#3.13 Nodes                 | Nodes]]         | 12         | pairing / write / node      | `nodes.ts`, `nodes-pending.ts`             |
| [[#3.14 Devices               | Devices]]       | 5          | pairing                     | `devices.ts`                               |
| [[#3.15 Cron                  | Cron]]          | 7          | read / admin / write        | `cron.ts`                                  |
| [[#3.16 System                | System]]        | 5          | read / write                | `system.ts`                                |
| [[#3.17 Usage                 | Usage]]         | 3          | read                        | `usage.ts`                                 |
| [[#3.18 Secrets               | Secrets]]       | 2          | admin                       | `secrets.ts`                               |
| [[#3.19 Send / Push           | Send / Push]]   | 3          | write                       | `send.ts`, `push.ts`                       |
| [[#3.20 Web / Browser         | Web / Browser]] | 3          | admin / write               | `web.ts`, `browser.ts`                     |
| [[#3.21 Wizard                | Wizard]]        | 4          | admin                       | `wizard.ts`                                |
| [[#3.22 Update                | Update]]        | 1          | admin                       | `update.ts`                                |
| [[#3.23 Logs / Doctor         | Logs / Doctor]] | 2          | read                        | `logs.ts`, `doctor.ts`                     |
| [[#3.24 VoiceWake             | VoiceWake]]     | 2          | read / write                | `voicewake.ts`                             |
| [[#3.25 Gateway Introspection | Introspection]] | 1          | read                        | `describe.ts`                              |
| [[#3.26 Deck 专用             | Deck 专用]]     | 21         | read / admin / write        | `deck/` 目录                               |

---

## 3. 分组详解

### 3.1 Agent 运行

核心 agent 调用入口——通过 Gateway 触发 AI agent 运行。

| Method               | Params 概要                                                                                                                                    | Result 概要                                           | Scope            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------- |
| `agent`              | `message`, `agentId?`, `provider?`, `model?`, `sessionKey?`, `idempotencyKey`, `deliver?`, `channel?`, `attachments?`, `thinking?`, `timeout?` | `{runId, status:"accepted", acceptedAt}` (异步双阶段) | `operator.write` |
| `agent.identity.get` | `agentId?`, `sessionKey?`                                                                                                                      | `{name, emoji, avatar, agentId}`                      | `operator.read`  |
| `agent.wait`         | `runId`, `timeoutMs?`                                                                                                                          | `{runId, status, startedAt?, endedAt?, error?}`       | `operator.read`  |

> [!note] 双阶段响应
> `agent` 方法先返回 `accepted` 帧（含 `runId`），agent 运行完成后再推送终态帧。客户端可用 `agent.wait` 轮询/等待终态。支持 idempotency key 去重。

### 3.2 Agents 管理

管理 agent 实体（创建、更新、删除）及其 workspace 文件。

| Method              | Params 概要                                           | Result 概要                                                                 | Scope            |
| ------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------- | ---------------- |
| `agents.list`       | `{}` (empty)                                          | `{agents: [{id, name, workspace, isDefault, ...}]}`                         | `operator.read`  |
| `agents.create`     | `name`, `workspace`, `emoji?`, `avatar?`              | `{ok, agentId, name, workspace}`                                            | `operator.admin` |
| `agents.update`     | `agentId`, `name?`, `workspace?`, `model?`, `avatar?` | `{ok, agentId}`                                                             | `operator.admin` |
| `agents.delete`     | `agentId`, `deleteFiles?`                             | `{ok, agentId, removedBindings}`                                            | `operator.admin` |
| `agents.files.list` | `agentId`                                             | `{agentId, workspace, files: [{name, path, missing, size?, updatedAtMs?}]}` | `operator.read`  |
| `agents.files.get`  | `agentId`, `name`                                     | `{agentId, workspace, file: {name, path, content?, missing}}`               | `operator.read`  |
| `agents.files.set`  | `agentId`, `name`, `content`                          | `{ok, agentId, workspace, file: {...}}`                                     | `operator.admin` |

> [!warning] 文件安全
> `agents.files.get/set` 限制文件名白名单（`SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `AGENTS.md`, `BOOTSTRAP.md`, `MEMORY.md`, `memory.md`），并做 symlink/hardlink/path-traversal 检查。

### 3.3 Chat (WebSocket)

WebChat UI 专用的即时消息方法——通过 WebSocket 原生通道收发消息。

| Method         | Params 概要                                                               | Result 概要                                | Scope            |
| -------------- | ------------------------------------------------------------------------- | ------------------------------------------ | ---------------- |
| `chat.history` | `sessionKey?`, `limit?`, `maxBytes?`                                      | `{messages: [...], sessionKey, sessionId}` | `operator.read`  |
| `chat.send`    | `message`, `sessionKey?`, `attachments?`, `thinking?`, `inputProvenance?` | `{runId, status}` + streaming events       | `operator.write` |
| `chat.abort`   | `runId?`, `sessionKey?`                                                   | `{aborted, runId?}`                        | `operator.write` |

> [!tip] chat.send 与 agent 的区别
> `chat.send` 面向 WebChat UI，会写入 transcript、产生 `session.message` 事件流；`agent` 面向 CLI/外部系统，采用 fire-and-forget 双阶段模式。两者最终都调用 Pi coding agent 内核。

### 3.4 Sessions

Session 生命周期管理——列表、创建、消息订阅、用量查询等。

| Method                          | Params 概要                                          | Result 概要                               | Scope            |
| ------------------------------- | ---------------------------------------------------- | ----------------------------------------- | ---------------- |
| `sessions.list`                 | `agentId?`, `limit?`, `offset?`, `query?`            | `{sessions: [...], total}`                | `operator.read`  |
| `sessions.subscribe`            | —                                                    | `{ok}` (开始接收 `sessions.changed` 事件) | `operator.read`  |
| `sessions.unsubscribe`          | —                                                    | `{ok}`                                    | `operator.read`  |
| `sessions.messages.subscribe`   | `sessionKey`                                         | `{ok}` (接收 `session.message` 事件)      | `operator.read`  |
| `sessions.messages.unsubscribe` | `sessionKey`                                         | `{ok}`                                    | `operator.read`  |
| `sessions.preview`              | `sessionKey`                                         | `{session, preview}`                      | `operator.read`  |
| `sessions.create`               | `agentId?`, `label?`                                 | `{sessionKey, sessionId, created}`        | `operator.write` |
| `sessions.send`                 | `sessionKey`, `message`, `attachments?`              | `{runId, status}`                         | `operator.write` |
| `sessions.steer`                | `sessionKey`, `message`                              | `{runId, status}`                         | `operator.write` |
| `sessions.abort`                | `sessionKey`                                         | `{aborted}`                               | `operator.write` |
| `sessions.patch`                | `sessionKey`, `patch: {label?, thinkingLevel?, ...}` | `{ok, sessionKey}`                        | `operator.admin` |
| `sessions.reset`                | `sessionKey`                                         | `{ok, sessionKey, sessionId}`             | `operator.admin` |
| `sessions.clear`                | `sessionKey`                                         | `{ok}`                                    | `operator.admin` |
| `sessions.delete`               | `sessionKey`                                         | `{ok}`                                    | `operator.admin` |
| `sessions.compact`              | `sessionKey`                                         | `{ok, stats}`                             | `operator.admin` |
| `sessions.usage`                | `sessionKey`, `range?`                               | `{usage: {tokens, cost, ...}}`            | `operator.read`  |
| `sessions.usage.timeseries`     | `sessionKey`, `range?`                               | `{timeseries: [...]}`                     | `operator.read`  |
| `sessions.usage.logs`           | `sessionKey`, `range?`                               | `{logs: [...]}`                           | `operator.read`  |

### 3.5 Config

Gateway 配置的读写、schema 查询、apply-with-restart。

| Method                 | Params 概要                                                             | Result 概要                                           | Scope            |
| ---------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------- | ---------------- |
| `config.get`           | `{}`                                                                    | `{path, exists, hash, raw, config, valid}` (redacted) | `operator.read`  |
| `config.schema`        | `{}`                                                                    | `{schema, uiHints, plugins, channels}`                | `operator.admin` |
| `config.schema.lookup` | `path` (dot-path)                                                       | `{schema, uiHint?, description?}`                     | `operator.read`  |
| `config.set`           | `raw` (JSON5 string), `baseHash`                                        | `{ok, path, config}`                                  | `operator.admin` |
| `config.patch`         | `raw` (JSON5 merge-patch), `baseHash`, `sessionKey?`, `restartDelayMs?` | `{ok, path, config, restart, sentinel}`               | `operator.admin` |
| `config.apply`         | `raw` (JSON5 string), `baseHash`, `sessionKey?`, `restartDelayMs?`      | `{ok, path, config, restart, sentinel}`               | `operator.admin` |

> [!important] Optimistic Concurrency
> `config.set`、`config.patch`、`config.apply` 均要求 `baseHash` 参数（从 `config.get` 获取），防止并发覆写。不匹配时返回 `INVALID_REQUEST` 错误。

### 3.6 Channels

渠道状态查询与登出。

| Method            | Params 概要             | Result 概要                                          | Scope            |
| ----------------- | ----------------------- | ---------------------------------------------------- | ---------------- |
| `channels.status` | `probe?`, `timeoutMs?`  | `{ts, channelOrder, channels, channelAccounts, ...}` | `operator.read`  |
| `channels.logout` | `channel`, `accountId?` | `{channel, accountId, cleared, loggedOut}`           | `operator.admin` |

### 3.7 Models

AI 模型目录与已配置模型查询。

| Method                     | Params 概要 | Result 概要                                                                           | Scope           |
| -------------------------- | ----------- | ------------------------------------------------------------------------------------- | --------------- |
| `models.list`              | `{}`        | `{models: [{provider, id, name, contextWindow, reasoning, input, cost?}]}`            | `operator.read` |
| `models.configured`        | `{}`        | `{models: [{...modelEntry, authStatus, source, scope, editable}]}`                    | `operator.read` |
| `models.catalog.providers` | `{}`        | `{providers: [{id, displayName, modelCount, defaultBaseUrl, authType, api, models}]}` | `operator.read` |

> [!note] models.configured 与 models.list
> `models.list` 返回 Pi SDK 完整目录（受 allowlist 过滤）。`models.configured` 返回用户实际配置的模型 + auth 状态 + provenance（来源是 config/env/auth-profile），用于 Dashboard 的 Models Hub。

### 3.8 Tools

工具目录与有效工具清单。

| Method            | Params 概要                   | Result 概要                                                 | Scope            |
| ----------------- | ----------------------------- | ----------------------------------------------------------- | ---------------- |
| `tools.catalog`   | `agentId?`, `includePlugins?` | `{agentId, profiles, groups: [{id, label, source, tools}]}` | `operator.read`  |
| `tools.effective` | `sessionKey`, `agentId?`      | `{tools: [...], policies: [...]}`                           | `operator.admin` |

### 3.9 Skills

Skill 安装、更新、状态查询。

| Method           | Params 概要                        | Result 概要                                         | Scope            |
| ---------------- | ---------------------------------- | --------------------------------------------------- | ---------------- |
| `skills.status`  | `agentId?`                         | `{skills: [{skillKey, name, status, ...}], remote}` | `operator.read`  |
| `skills.bins`    | `agentId?`                         | `{bins: string[]}`                                  | `node`           |
| `skills.install` | `url`, `agentId?`                  | `{ok, skillKey, ...}`                               | `operator.admin` |
| `skills.update`  | `skillKey?`, `agentId?`, `apiKey?` | `{ok, updated: [...]}`                              | `operator.admin` |

### 3.10 TTS

文本转语音引擎管理。

| Method            | Params 概要        | Result 概要                                                                                      | Scope            |
| ----------------- | ------------------ | ------------------------------------------------------------------------------------------------ | ---------------- |
| `tts.status`      | —                  | `{enabled, auto, provider, fallbackProviders, hasOpenAIKey, hasElevenLabsKey, microsoftEnabled}` | `operator.read`  |
| `tts.providers`   | —                  | `{providers: [{id, name, configured, models, voices}], active}`                                  | `operator.read`  |
| `tts.enable`      | —                  | `{enabled: true}`                                                                                | `operator.write` |
| `tts.disable`     | —                  | `{enabled: false}`                                                                               | `operator.write` |
| `tts.convert`     | `text`, `channel?` | `{audioPath, provider, outputFormat, voiceCompatible}`                                           | `operator.write` |
| `tts.setProvider` | `provider`         | `{provider}`                                                                                     | `operator.write` |

### 3.11 Talk

Talk 模式（实时语音对话）专用接口。

| Method        | Params 概要                                                            | Result 概要                                                      | Scope            |
| ------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------- |
| `talk.config` | `includeSecrets?`                                                      | `{config: {talk, session?, ui?}}`                                | `operator.read`  |
| `talk.speak`  | `text`, `voiceId?`, `modelId?`, `outputFormat?`, `speed?`, `language?` | `{audioBase64, provider, outputFormat, mimeType, fileExtension}` | `operator.write` |
| `talk.mode`   | `enabled`, `phase?`                                                    | `{enabled, phase, ts}` (+ broadcast)                             | `operator.write` |

> [!note] Talk secrets
> `talk.config` 的 `includeSecrets` 参数需要 `operator.admin` 或 `operator.talk.secrets` scope。

### 3.12 Exec Approval

工具执行审批流——agent 请求执行命令时的人工审批。

| Method                       | Params 概要                                                                              | Result 概要                                 | Scope                |
| ---------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------- |
| `exec.approval.request`      | `command`, `commandArgv?`, `env?`, `cwd?`, `nodeId?`, `host?`, `twoPhase?`, `timeoutMs?` | `{id, decision?, createdAtMs, expiresAtMs}` | `operator.approvals` |
| `exec.approval.waitDecision` | `id`                                                                                     | `{id, decision}`                            | `operator.approvals` |
| `exec.approval.resolve`      | `id`, `decision` ("allow-once"/"allow-always"/"deny")                                    | `{ok}`                                      | `operator.approvals` |
| `exec.approvals.get`         | `{}`                                                                                     | `{path, exists, hash, file}`                | `operator.approvals` |
| `exec.approvals.set`         | `file`, `baseHash`                                                                       | `{path, exists, hash, file}`                | `operator.approvals` |
| `exec.approvals.node.get`    | `nodeId`                                                                                 | `{...snapshot}`                             | `operator.approvals` |
| `exec.approvals.node.set`    | `nodeId`, `file`, `baseHash?`                                                            | `{...snapshot}`                             | `operator.approvals` |

### 3.13 Nodes

远程节点管理——配对、调用、pending work 队列。

| Method                           | Params 概要                                  | Result 概要                   | Scope              |
| -------------------------------- | -------------------------------------------- | ----------------------------- | ------------------ |
| `node.pair.request`              | `name?`, `caps?`                             | `{id, token, ...}`            | `operator.pairing` |
| `node.pair.list`                 | `{}`                                         | `{pending, paired}`           | `operator.pairing` |
| `node.pair.approve`              | `id`                                         | `{ok}`                        | `operator.pairing` |
| `node.pair.reject`               | `id`                                         | `{ok}`                        | `operator.pairing` |
| `node.pair.verify`               | `token`                                      | `{valid, nodeId}`             | `operator.pairing` |
| `node.rename`                    | `nodeId`, `name`                             | `{ok}`                        | `operator.pairing` |
| `node.list`                      | `{}`                                         | `{nodes: [...]}`              | `operator.read`    |
| `node.describe`                  | `nodeId`                                     | `{node: {...}}`               | `operator.read`    |
| `node.invoke`                    | `nodeId`, `command`, `params?`, `timeoutMs?` | `{payload}` (proxied to node) | `operator.write`   |
| `node.event`                     | `type`, `payload`                            | `{ok}`                        | `node`             |
| `node.invoke.result`             | `requestId`, `payload?`, `error?`            | —                             | `node`             |
| `node.canvas.capability.refresh` | `nodeId`                                     | `{token, hostUrl, expiresAt}` | `node`             |

#### Node Pending Work

| Method                 | Params 概要                              | Result 概要      | Scope            |
| ---------------------- | ---------------------------------------- | ---------------- | ---------------- |
| `node.pending.enqueue` | `nodeId`, `type`, `payload`, `priority?` | `{ok, id}`       | `operator.write` |
| `node.pending.drain`   | — (client device id)                     | `{items: [...]}` | `node`           |
| `node.pending.pull`    | `types?`, `limit?`                       | `{items: [...]}` | `node`           |
| `node.pending.ack`     | `ids`                                    | `{ok}`           | `node`           |

### 3.14 Devices

设备配对管理（macOS/iOS/Android app 远程配对）。

| Method                | Params 概要                  | Result 概要         | Scope              |
| --------------------- | ---------------------------- | ------------------- | ------------------ |
| `device.pair.list`    | `{}`                         | `{pending, paired}` | `operator.pairing` |
| `device.pair.approve` | `id`, `scopes?`              | `{ok, token}`       | `operator.pairing` |
| `device.pair.reject`  | `id`                         | `{ok}`              | `operator.pairing` |
| `device.pair.remove`  | `deviceId`                   | `{ok}`              | `operator.pairing` |
| `device.token.rotate` | `deviceId`, `role`, `scope?` | `{ok, token}`       | `operator.pairing` |
| `device.token.revoke` | `deviceId`, `role`           | `{ok}`              | `operator.pairing` |

### 3.15 Cron

定时任务管理。

| Method        | Params 概要                                                              | Result 概要             | Scope            |
| ------------- | ------------------------------------------------------------------------ | ----------------------- | ---------------- |
| `wake`        | `mode` ("now"/"next-heartbeat"), `text`                                  | `{...result}`           | `operator.write` |
| `cron.list`   | `includeDisabled?`, `limit?`, `offset?`, `query?`, `sortBy?`, `sortDir?` | `{items, total}`        | `operator.read`  |
| `cron.status` | `id`                                                                     | `{job, nextRunAt, ...}` | `operator.read`  |
| `cron.add`    | `name`, `schedule`, `command`, `agentId?`, ...                           | `{ok, id}`              | `operator.admin` |
| `cron.update` | `id`, `patch: {...}`                                                     | `{ok}`                  | `operator.admin` |
| `cron.remove` | `id`                                                                     | `{ok}`                  | `operator.admin` |
| `cron.run`    | `id`                                                                     | `{ok, runId}`           | `operator.admin` |
| `cron.runs`   | `id?`, `limit?`, `offset?`                                               | `{entries, total}`      | `operator.read`  |

### 3.16 System

系统级方法——身份、心跳、presence、事件。

| Method                 | Params 概要                                                                               | Result 概要                    | Scope            |
| ---------------------- | ----------------------------------------------------------------------------------------- | ------------------------------ | ---------------- |
| `gateway.identity.get` | —                                                                                         | `{deviceId, publicKey}`        | `operator.read`  |
| `last-heartbeat`       | —                                                                                         | `{...heartbeatEvent}`          | `operator.read`  |
| `set-heartbeats`       | `enabled`                                                                                 | `{ok, enabled}`                | `operator.admin` |
| `system-presence`      | —                                                                                         | `[{key, text, deviceId, ...}]` | `operator.read`  |
| `system-event`         | `text`, `deviceId?`, `instanceId?`, `host?`, `ip?`, `mode?`, `version?`, `platform?`, ... | `{ok}`                         | `operator.admin` |

### 3.17 Usage

全局用量聚合。

| Method         | Params 概要 | Result 概要                     | Scope           |
| -------------- | ----------- | ------------------------------- | --------------- |
| `usage.status` | `range?`    | `{sessions: [...], aggregates}` | `operator.read` |
| `usage.cost`   | `range?`    | `{cost, ...}`                   | `operator.read` |

> [!note] Sessions 级别用量
> 按 session 粒度的用量查询使用 `sessions.usage`、`sessions.usage.timeseries`、`sessions.usage.logs`（见 [[#3.4 Sessions]] 节）。

### 3.18 Secrets

密钥管理运行时接口。

| Method            | Params 概要                | Result 概要                                        | Scope            |
| ----------------- | -------------------------- | -------------------------------------------------- | ---------------- |
| `secrets.reload`  | —                          | `{ok, warningCount}`                               | `operator.admin` |
| `secrets.resolve` | `commandName`, `targetIds` | `{ok, assignments, diagnostics, inactiveRefPaths}` | `operator.admin` |

### 3.19 Send / Push

直接消息发送与推送通知。

| Method      | Params 概要                                               | Result 概要              | Scope            |
| ----------- | --------------------------------------------------------- | ------------------------ | ---------------- |
| `send`      | `message`, `channel?`, `to?`, `accountId?`, `sessionKey?` | `{ok, channel, to, ...}` | `operator.write` |
| `poll`      | `question`, `choices`, `channel?`, `to?`                  | `{ok, ...}`              | `operator.write` |
| `push.test` | `nodeId`, `title?`, `body?`                               | `{ok, ...}`              | `operator.write` |

### 3.20 Web / Browser

Web 登录与浏览器远程控制。

| Method            | Params 概要                                         | Result 概要        | Scope            |
| ----------------- | --------------------------------------------------- | ------------------ | ---------------- |
| `web.login.start` | `accountId?`                                        | `{url, sessionId}` | `operator.admin` |
| `web.login.wait`  | `sessionId`, `timeoutMs?`                           | `{ok, ...}`        | `operator.admin` |
| `browser.request` | `method?`, `path?`, `query?`, `body?`, `timeoutMs?` | `{result, files?}` | `operator.write` |

### 3.21 Wizard

引导式配置向导（onboarding）。

| Method          | Params 概要            | Result 概要                 | Scope            |
| --------------- | ---------------------- | --------------------------- | ---------------- |
| `wizard.start`  | `mode`, `workspace?`   | `{sessionId, step?, done?}` | `operator.admin` |
| `wizard.next`   | `sessionId`, `answer?` | `{step?, done?}`            | `operator.admin` |
| `wizard.cancel` | `sessionId`            | `{ok}`                      | `operator.admin` |
| `wizard.status` | `sessionId`            | `{status, error?}`          | `operator.admin` |

### 3.22 Update

Gateway 自更新。

| Method       | Params 概要                                             | Result 概要                                                     | Scope            |
| ------------ | ------------------------------------------------------- | --------------------------------------------------------------- | ---------------- |
| `update.run` | `timeoutMs?`, `sessionKey?`, `note?`, `restartDelayMs?` | `{status, mode, reason?, steps, durationMs, restart, sentinel}` | `operator.admin` |

### 3.23 Logs / Doctor

日志尾读与诊断。

| Method                 | Params 概要                      | Result 概要                                     | Scope           |
| ---------------------- | -------------------------------- | ----------------------------------------------- | --------------- |
| `logs.tail`            | `cursor?`, `limit?`, `maxBytes?` | `{entries, nextCursor}`                         | `operator.read` |
| `doctor.memory.status` | —                                | `{agentId, provider?, embedding: {ok, error?}}` | `operator.read` |

### 3.24 VoiceWake

语音唤醒词管理。

| Method          | Params 概要          | Result 概要  | Scope            |
| --------------- | -------------------- | ------------ | ---------------- |
| `voicewake.get` | —                    | `{triggers}` | `operator.read`  |
| `voicewake.set` | `triggers: string[]` | `{triggers}` | `operator.write` |

### 3.25 Gateway Introspection

Gateway 自描述接口——运行时 API 发现。

| Method             | Params 概要                                            | Result 概要                                           | Scope           |
| ------------------ | ------------------------------------------------------ | ----------------------------------------------------- | --------------- |
| `gateway.describe` | `filter?` ("all"/"typed"/"untyped"), `includeSchemas?` | `{protocol, schemaVersion, methods, events, untyped}` | `operator.read` |

> [!tip] 运行时 API 发现
> `gateway.describe` 返回所有已注册方法的 metadata（params/result schema、scope、since），是 Deck Dashboard typed client 代码生成的运行时数据源之一。

### 3.26 Deck 专用

Deck Dashboard 专有的 RPC 方法——仅 enhanced fork 中存在。

#### Deck Auth 诊断

| Method               | Params 概要                                          | Result 概要                                                                              | Scope            |
| -------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------- |
| `deck.auth.overview` | —                                                    | `{providers: [{provider, status, source, scope, configPresent, authPresent, editable}]}` | `operator.read`  |
| `deck.auth.probe`    | `provider`, `profileId?`, `timeoutMs?`, `maxTokens?` | `{ok, latencyMs, model?, error?}`                                                        | `operator.write` |

#### Deck Commands

| Method                   | Params 概要 | Result 概要                                                            | Scope           |
| ------------------------ | ----------- | ---------------------------------------------------------------------- | --------------- |
| `deck.commands.discover` | `agentId?`  | `{commands: [{name, source, description, args?, category?}], version}` | `operator.read` |

#### Deck Routing

| Method                  | Params 概要                                                         | Result 概要                                                      | Scope            |
| ----------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------- |
| `deck.routing.list`     | —                                                                   | `{bindings: [{id, agentId, tier, match, comment?}], configHash}` | `operator.read`  |
| `deck.routing.add`      | `agentId`, `match`, `comment?`, `baseHash`                          | `{ok, bindings, configHash}`                                     | `operator.admin` |
| `deck.routing.remove`   | `id`, `baseHash`                                                    | `{ok, bindings, configHash}`                                     | `operator.admin` |
| `deck.routing.validate` | `match`                                                             | `{valid, errors?}`                                               | `operator.read`  |
| `deck.routing.simulate` | `channel`, `peerId?`, `accountId?`, `guildId?`, `roles?`, `teamId?` | `{resolvedAgentId, matchedBy, tier, bindings}`                   | `operator.read`  |

#### Deck Agents

| Method                             | Params 概要                                 | Result 概要                                                                                            | Scope            |
| ---------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------- |
| `deck.agents.detail`               | `agentId`                                   | `{agentId, isDefault, model?, bindingCount, skillMode, effectiveSkills, sandbox, identityExists, ...}` | `operator.read`  |
| `deck.agents.skills.get`           | `agentId`                                   | `{agentId, skillMode, whitelist, allSkills, configHash}`                                               | `operator.read`  |
| `deck.agents.skills.set`           | `agentId`, `mode`, `whitelist?`, `baseHash` | `{ok, agentId, configHash}`                                                                            | `operator.admin` |
| `deck.agents.subagents.get`        | `agentId`                                   | `{agentId, allowed, configHash}`                                                                       | `operator.read`  |
| `deck.agents.subagents.set`        | `agentId`, `allowed`, `baseHash`            | `{ok, agentId, configHash}`                                                                            | `operator.admin` |
| `deck.agents.toolPolicy.preview`   | `agentId`, `context?`                       | `{tools: [{id, allowed, reason}], pipeline}`                                                           | `operator.read`  |
| `deck.agents.systemPrompt.preview` | `agentId`                                   | `{sections: [{name, content, source}]}`                                                                | `operator.read`  |
| `deck.agents.eventStreams.get`     | `agentId`                                   | `{agentId, eventStreams, configHash}`                                                                  | `operator.read`  |
| `deck.agents.eventStreams.set`     | `agentId`, `eventStreams`, `baseHash`       | `{ok, agentId, eventStreams, configHash}`                                                              | `operator.admin` |

#### Deck Subagents

| Method                   | Params 概要                                                     | Result 概要                                                                     | Scope            |
| ------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------- |
| `deck.subagents.list`    | `status?`, `agentId?`, `requesterAgentId?`, `limit?`, `offset?` | `{runs: [{runId, sessionKey, agentId, task, status, durationMs?, ...}], total}` | `operator.read`  |
| `deck.subagents.kill`    | `runId`                                                         | `{ok}`                                                                          | `operator.admin` |
| `deck.subagents.lineage` | `runId`                                                         | `{nodes: [{runId, agentId, depth, ...}]}`                                       | `operator.read`  |
| `deck.subagents.steer`   | `runId`, `instruction`                                          | `{success, dedupKey?, newRunId?}`                                               | `operator.admin` |

#### Deck Identity

| Method                 | Params 概要                                  | Result 概要                                 | Scope            |
| ---------------------- | -------------------------------------------- | ------------------------------------------- | ---------------- |
| `deck.identity.list`   | —                                            | `{links: [{canonical, peers}], configHash}` | `operator.read`  |
| `deck.identity.link`   | `canonical`, `channel`, `peerId`, `baseHash` | `{ok, links, configHash}`                   | `operator.admin` |
| `deck.identity.unlink` | `canonical`, `channel`, `peerId`, `baseHash` | `{ok, links, configHash}`                   | `operator.admin` |

#### Deck Threads

| Method              | Params 概要                       | Result 概要                                                          | Scope           |
| ------------------- | --------------------------------- | -------------------------------------------------------------------- | --------------- |
| `deck.threads.list` | `channel?`, `agentId?`, `status?` | `{threads: [{threadId, channelId, agentId, targetSessionKey, ...}]}` | `operator.read` |

---

## 4. 错误码速查

Gateway 使用统一的 `ErrorShape` 格式：`{code, message, details?}`。

| 错误码            | 含义                       | 典型触发场景                                            |
| ----------------- | -------------------------- | ------------------------------------------------------- |
| `INVALID_REQUEST` | 参数校验失败或业务逻辑拒绝 | schema 不匹配、未知 agent id、baseHash 不一致、权限不足 |
| `UNAVAILABLE`     | 服务暂不可用               | TTS 引擎未配置、node 离线、内部异常                     |
| `NOT_FOUND`       | 资源不存在                 | agent 不存在、session key 无效                          |
| `NOT_LINKED`      | 渠道未绑定                 | WhatsApp 未登录                                         |
| `NOT_PAIRED`      | 设备/节点未配对            | node invoke 目标未配对                                  |
| `AGENT_TIMEOUT`   | Agent 运行超时             | agent 请求超过 timeout                                  |

> [!warning] 错误码稳定性
> `INVALID_REQUEST` 和 `UNAVAILABLE` 是最常用的两个错误码，几乎所有方法都可能返回。其余错误码在特定业务场景下使用。错误码值为字符串常量，不是数字。

---

## 5. Client Capabilities 协商

客户端在 `connect` 帧中通过 `caps` 数组声明自身能力，Gateway 据此决定推送哪些事件。

### 5.1 已定义 Capabilities

| Cap           | 含义                                                   |
| ------------- | ------------------------------------------------------ |
| `tool-events` | 客户端希望接收 `session.tool` 事件（工具调用实时状态） |

### 5.2 Client IDs

| Client ID             | 说明                |
| --------------------- | ------------------- |
| `webchat-ui`          | WebChat 嵌入式 UI   |
| `openclaw-control-ui` | Dashboard 控制面板  |
| `webchat`             | WebChat 独立模式    |
| `cli`                 | 命令行客户端        |
| `gateway-client`      | 通用 Gateway 客户端 |
| `openclaw-macos`      | macOS 原生 App      |
| `openclaw-ios`        | iOS App             |
| `openclaw-android`    | Android App         |
| `node-host`           | Node 远程主机       |

### 5.3 Client Modes

| Mode      | 说明             |
| --------- | ---------------- |
| `webchat` | WebChat 会话模式 |
| `cli`     | CLI 模式         |
| `ui`      | 图形 UI 模式     |
| `backend` | 后台服务模式     |
| `node`    | 远程节点模式     |
| `probe`   | 健康探针模式     |
| `test`    | 测试模式         |

---

## 6. 事件流（Server-Push Events）

Gateway 通过 WebSocket 主动推送以下事件（客户端无需请求）：

| Event                     | 触发时机                | 典型订阅者                           |
| ------------------------- | ----------------------- | ------------------------------------ |
| `connect.challenge`       | 连接建立后的认证挑战    | 所有客户端                           |
| `agent`                   | Agent 运行状态变化      | CLI、Apps                            |
| `chat`                    | WebChat 消息/流式输出   | WebChat UI                           |
| `session.message`         | 订阅的 session 有新消息 | Dashboard                            |
| `session.tool`            | 工具调用实时事件        | 声明 `tool-events` cap 的客户端      |
| `sessions.changed`        | Session 列表变化        | 订阅了 `sessions.subscribe` 的客户端 |
| `presence`                | 系统 presence 更新      | Dashboard                            |
| `tick`                    | 定时心跳 tick           | 所有客户端                           |
| `talk.mode`               | Talk 模式切换           | Apps                                 |
| `shutdown`                | Gateway 即将关闭        | 所有客户端                           |
| `health`                  | 健康状态变化            | Dashboard                            |
| `heartbeat`               | Heartbeat 事件          | Apps                                 |
| `cron`                    | Cron 任务执行事件       | Dashboard                            |
| `node.pair.requested`     | 新的 node 配对请求      | macOS App                            |
| `node.pair.resolved`      | Node 配对结果           | macOS App                            |
| `node.invoke.request`     | Node invoke 请求到达    | Node 客户端                          |
| `device.pair.requested`   | 新的设备配对请求        | macOS App                            |
| `device.pair.resolved`    | 设备配对结果            | macOS App                            |
| `voicewake.changed`       | 语音唤醒词变化          | Apps                                 |
| `exec.approval.requested` | 新的执行审批请求        | Apps、Dashboard                      |
| `exec.approval.resolved`  | 执行审批结果            | Apps、Dashboard                      |
| `update.available`        | 有可用更新              | Apps                                 |

---

## 7. 关键文件索引

| 文件                                         | 角色                                                     |
| -------------------------------------------- | -------------------------------------------------------- |
| `src/gateway/server-methods-list.ts`         | 方法注册表（BASE_METHODS + channel plugin 方法）         |
| `src/gateway/method-scopes.ts`               | Scope 定义与方法-scope 映射                              |
| `src/gateway/method-registry.ts`             | MethodRegistry 核心（method → handler + schema + scope） |
| `src/gateway/protocol/schema/error-codes.ts` | ErrorCodes 定义                                          |
| `src/gateway/protocol/client-info.ts`        | Client ID / Mode / Caps 定义                             |
| `src/gateway/server-methods/types.ts`        | Handler 类型定义                                         |
| `src/gateway/server-methods/deck/index.ts`   | Deck 方法聚合入口                                        |

---

> [!quote] 相关文档
>
> - [[OpenClaw Gateway MOC]] — Gateway 模块总览
> - [[OpenClaw 渠道-路由-Agent-Session 架构全景图]] — 渠道与路由架构
