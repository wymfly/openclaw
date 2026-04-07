---
title: "OC-18 Logging 日志系统"
created: 2026-04-06
updated: 2026-04-06
tags:
  - openclaw
  - logging
  - diagnostics
  - redaction
parent: "[[OpenClaw Gateway MOC]]"
---

# OC-18 Logging 日志系统

## 概述

OpenClaw 的日志系统是一个多层架构，从底层的 `tslog` 文件日志到控制台输出、PII 脱敏、诊断追踪均有完整实现。日志路径默认为 `~/.openclaw/tmp/openclaw.log`，支持按日滚动、大小限制、子系统过滤和多种输出格式。

```
src/logging/
  logger.ts              ── 核心 Logger（tslog 包装、文件写入、rotation）
  subsystem.ts           ── SubsystemLogger（子系统级别日志器）
  levels.ts              ── 日志级别定义
  config.ts              ── 日志配置读取
  console.ts             ── 控制台设置与 Console Capture
  timestamps.ts          ── 时间戳格式化
  redact.ts              ── PII 脱敏核心
  redact-bounded.ts      ── 分块安全正则替换
  redact-identifier.ts   ── 标识符 SHA256 脱敏
  diagnostic.ts          ── 诊断日志（webhook 统计、卡住检测）
  diagnostic-session-state.ts ── 会话诊断状态管理
  parse-log-line.ts      ── 日志行解析
  log-tail.ts            ── 日志尾读取（游标支持）
  env-log-level.ts       ── 环境变量日志级别覆盖
  state.ts               ── 全局日志状态
```

## Logger 架构

### 核心 Logger (`src/logging/logger.ts`)

基于 `tslog` (TypeScript Logger) 构建，提供文件日志写入：

```mermaid
graph TD
    App[应用代码] --> Sub[SubsystemLogger]
    Sub --> |console| Console[控制台输出]
    Sub --> |file| FileLogger[tslog FileLogger]

    FileLogger --> LogFile[openclaw-YYYY-MM-DD.log]

    Console --> Raw[rawConsole<br>原始 console.*]
    Console --> Stderr[stderr<br>JSON 模式]

    subgraph 外部传输
        FileLogger --> |transport| External[外部日志传输]
    end
```

### 关键常量

| 常量                         | 值                 | 说明                 |
| ---------------------------- | ------------------ | -------------------- |
| `DEFAULT_LOG_DIR`            | `~/.openclaw/tmp/` | 默认日志目录         |
| `DEFAULT_LOG_FILE`           | `openclaw.log`     | 兼容旧版单文件路径   |
| `MAX_LOG_AGE_MS`             | 24h                | 日志文件最大保留时间 |
| `DEFAULT_MAX_LOG_FILE_BYTES` | 500 MB             | 单文件最大字节数     |

### LoggerSettings

```typescript
type LoggerSettings = {
  level?: LogLevel; // 文件日志级别
  file?: string; // 日志文件路径
  maxFileBytes?: number; // 单文件最大字节数
  consoleLevel?: LogLevel; // 控制台日志级别
  consoleStyle?: ConsoleStyle; // 控制台输出格式
};
```

### 外部传输 (Transport)

支持注册外部日志传输器，每条日志记录同时发送到文件和所有注册的传输器。

## 日志级别与子系统

### 日志级别 (`src/logging/levels.ts`)

```typescript
const ALLOWED_LOG_LEVELS = [
  "silent", // Infinity (完全禁止)
  "fatal", // 0
  "error", // 1
  "warn", // 2
  "info", // 3
  "debug", // 4
  "trace", // 5
] as const;
```

级别顺序遵循 tslog 约定：数字越小越严重。`levelToMinLevel()` 将级别名映射为数字用于比较。

### SubsystemLogger (`src/logging/subsystem.ts`)

每个子系统创建独立的 `SubsystemLogger`，提供结构化的日志接口：

```typescript
type SubsystemLogger = {
  subsystem: string;
  isEnabled: (level: LogLevel, target?: "any" | "console" | "file") => boolean;
  trace / debug / info / warn / error / fatal: (message, meta?) => void;
  raw: (message) => void;     // 直接输出，无格式化
  child: (name) => SubsystemLogger;  // 子层级
};
```

#### 子系统命名规范

子系统使用 `/` 分隔的层级路径：

- `gateway/channels/telegram`
- `agent/embedded`
- `model-fallback`

控制台显示时自动精简：

- 移除冗余前缀（`gateway`、`channels`、`providers`）
- 渠道子系统只显示渠道名（`telegram`、`discord`）
- 最多保留 2 层

#### 子系统颜色

6 种基础颜色（cyan, green, yellow, blue, magenta, red）通过 hash 分配，特定子系统有颜色覆盖（如 `gmail-watcher` -> blue）。

#### 控制台行格式

三种格式：

1. **pretty**（TTY 默认）：`12:34:56 [telegram] 消息内容`（带颜色）
2. **compact**（非 TTY）：`2026-04-06T12:34:56.789+08:00 [telegram] 消息`
3. **json**：`{"time":"...","level":"info","subsystem":"telegram","message":"..."}`

#### Probe 日志抑制

`agent/embedded` 和 `model-fallback` 子系统中，`runId` 以 `probe-` 开头的日志默认不输出到控制台（避免健康检查噪音），verbose 模式下仍输出。

### 环境变量级别覆盖 (`src/logging/env-log-level.ts`)

`OPENCLAW_LOG_LEVEL` 环境变量可覆盖所有配置来源的日志级别。无效值会输出警告到 stderr 但不中断运行。

### 控制台子系统过滤

`setConsoleSubsystemFilter(filters)` -- 仅输出指定前缀的子系统日志。支持前缀匹配（`telegram` 匹配 `telegram/webhook`）。

## 日志脱敏 (PII Redaction)

### 核心脱敏 (`src/logging/redact.ts`)

`redactSensitiveText(text, options?)` -- 对日志文本中的敏感信息进行脱敏：

#### 脱敏模式

| 模式           | 行为               |
| -------------- | ------------------ |
| `tools` (默认) | 对工具输出进行脱敏 |
| `off`          | 完全禁用脱敏       |

#### 内置脱敏模式

默认包含 15+ 种敏感信息检测模式：

| 类别               | 模式示例                                        |
| ------------------ | ----------------------------------------------- |
| 环境变量赋值       | `API_KEY=xxx`, `TOKEN: xxx`                     |
| JSON 字段          | `"apiKey": "xxx"`, `"token": "xxx"`             |
| CLI 标志           | `--api-key xxx`, `--token xxx`                  |
| Authorization      | `Bearer xxx`                                    |
| PEM 私钥           | `-----BEGIN PRIVATE KEY-----`                   |
| 特定 token 前缀    | `sk-*`, `ghp_*`, `github_pat_*`, `xox[baprs]-*` |
| Slack/Groq/Google  | `xapp-*`, `gsk_*`, `AIza*`                      |
| Telegram Bot Token | `bot123456:ABCDEF...`                           |
| npm token          | `npm_*`                                         |

#### 脱敏算法

```typescript
// 短于 18 字符 → 完全替换为 ***
// 18+ 字符 → 保留前 6 + 尾 4，中间用 ... 替代
function maskToken(token: string): string {
  if (token.length < 18) return "***";
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

// PEM 块 → 保留首尾行
function redactPemBlock(block: string): string {
  return `${lines[0]}\n...redacted...\n${lines[last]}`;
}
```

#### 自定义脱敏模式

通过配置文件 `logging.redactPatterns` 添加自定义正则表达式。

### 分块安全替换 (`src/logging/redact-bounded.ts`)

`replacePatternBounded()` -- 对超长文本（32KB+）进行分块正则替换，避免正则引擎的灾难性回溯：

- 阈值：32,768 字节
- 分块大小：16,384 字节
- 短于阈值时使用标准 `String.replace()`

### 标识符脱敏 (`src/logging/redact-identifier.ts`)

`redactIdentifier(value)` -- 将标识符替换为 SHA256 前缀哈希：

```typescript
// "user@example.com" → "sha256:a1b2c3d4e5f6"
sha256HexPrefix(value, 12);
```

用于日志中需要关联但不能泄露原文的标识符（如 senderId）。

## 日志文件管理

### 日志文件滚动

日志文件按日期滚动，格式为 `openclaw-YYYY-MM-DD.log`：

- 24 小时后自动清理旧文件
- 单文件最大 500 MB（可通过 `maxFileBytes` 配置）

### 日志尾读取 (`src/logging/log-tail.ts`)

`readConfiguredLogTail(params?)` -- 带游标的增量日志读取，用于 Gateway `logs.tail` RPC：

```typescript
type LogTailPayload = {
  file: string; // 日志文件路径
  cursor: number; // 文件偏移游标
  size: number; // 文件当前大小
  lines: string[]; // 日志行
  truncated: boolean; // 是否被截断
  reset: boolean; // 是否重置（文件被截断/rotation）
};
```

| 常量                | 值       | 说明             |
| ------------------- | -------- | ---------------- |
| `DEFAULT_LIMIT`     | 500 行   | 默认读取行数     |
| `DEFAULT_MAX_BYTES` | 250 KB   | 默认最大读取字节 |
| `MAX_LIMIT`         | 5,000 行 | 最大行数限制     |
| `MAX_BYTES`         | 1 MB     | 最大字节限制     |

自动解析滚动日志文件：当指定文件不存在时，查找目录中最新的 `openclaw-YYYY-MM-DD.log`。

### 日志行解析 (`src/logging/parse-log-line.ts`)

`parseLogLine(raw)` -- 解析 JSON 格式的日志行为结构化对象：

```typescript
type ParsedLogLine = {
  time?: string; // 时间戳
  level?: string; // 日志级别
  subsystem?: string; // 子系统
  module?: string; // 模块
  message: string; // 消息内容
  raw: string; // 原始行
};
```

## Console Capture (`src/logging/console.ts`)

### `enableConsoleCapture()`

拦截所有 `console.*` 调用，同时写入文件日志和原始控制台：

```mermaid
graph LR
    Code[应用代码] --> |console.log| Patched[Patched console]
    Patched --> |file| Logger[tslog Logger]
    Patched --> |console| Original[原始 console.*]

    Code --> |--json| StderrMode[stderr 模式]
    StderrMode --> |所有 console.* → stderr| Stderr[process.stderr]
```

#### 核心行为

1. **保存原始 console**：`loggingState.rawConsole` 保存未修改的原始方法
2. **双写**：每条 console 输出同时写入文件日志
3. **stderr 路由**：`routeLogsToStderr()` 将所有 console 输出重定向到 stderr（`--json` 模式）
4. **时间戳前缀**：可选启用，自动检测已有时间戳避免重复
5. **EPIPE 安全**：stdout/stderr 上注册错误监听器，管道断开时静默处理
6. **噪音过滤**：特定重复消息（如 "Closing session"、Discord EventQueue 慢监听器）被自动抑制

### Console 设置解析

优先级链：

1. `OPENCLAW_LOG_LEVEL` 环境变量
2. 测试环境自动静默（`VITEST=true` 且 `OPENCLAW_TEST_CONSOLE !== "1"`）
3. `loggingState.overrideSettings`
4. 配置文件 `logging.consoleLevel`
5. verbose 模式 -> `debug`
6. 默认 `info`

样式自动选择：TTY -> `pretty`，非 TTY -> `compact`

## 诊断日志 (`src/logging/diagnostic.ts`)

### Webhook 统计

全局追踪 webhook 接收/处理/错误计数：

```typescript
const webhookStats = {
  received: 0,
  processed: 0,
  errors: 0,
  lastReceived: 0,
};
```

### 卡住会话检测

`resolveStuckSessionWarnMs(config?)` -- 配置会话卡住告警阈值：

- 默认：120 秒
- 最小：1 秒
- 最大：24 小时

### 会话诊断状态 (`src/logging/diagnostic-session-state.ts`)

维护每个会话的运行时状态，用于诊断和调试：

```typescript
type SessionState = {
  sessionId?: string;
  sessionKey?: string;
  lastActivity: number;
  state: "idle" | "processing" | "waiting";
  queueDepth: number;
  toolCallHistory?: ToolCallRecord[];
  toolLoopWarningBuckets?: Map<string, number>;
  commandPollCounts?: Map<string, { count: number; lastPollAt: number }>;
};
```

- 最大 2,000 个会话条目
- 30 分钟 TTL 自动清理
- 每分钟检查一次过期条目

## 配置项

### 配置文件 (`openclaw.json` -> `logging` 段)

通过 `src/logging/config.ts` 读取：

```json5
{
  logging: {
    level: "info", // 文件日志级别
    consoleLevel: "info", // 控制台日志级别
    consoleStyle: "pretty", // pretty | compact | json
    redactSensitive: "tools", // tools | off
    redactPatterns: [], // 自定义脱敏正则
  },
}
```

### 全局日志状态 (`src/logging/state.ts`)

```typescript
const loggingState = {
  cachedLogger: null,
  cachedSettings: null,
  cachedConsoleSettings: null,
  overrideSettings: null,
  invalidEnvLogLevelValue: null,
  consolePatched: false,
  forceConsoleToStderr: false,
  consoleTimestampPrefix: false,
  consoleSubsystemFilter: null,
  resolvingConsoleSettings: false,
  streamErrorHandlersInstalled: false,
  rawConsole: null,
};
```

### 时间戳格式化 (`src/logging/timestamps.ts`)

`formatLocalIsoWithOffset(now, timeZone?)` -- 生成带时区偏移的 ISO 时间戳：

- 格式：`2026-04-06T12:34:56.789+08:00`
- 尊重 `TZ` 环境变量
- 验证时区有效性 (`isValidTimeZone()`)
- Fallback 到 `Intl.DateTimeFormat().resolvedOptions().timeZone`

---

**相关文档**：[[OpenClaw Gateway MOC]] | [[OC-17 Terminal 与 TUI]] | [[OC-19 基础设施工具集]]
