# Deck Dynamic Commands System Design

## Problem

Deck 当前有 14 个硬编码 slash 命令（`SLASH_COMMANDS` 静态数组），官方 CLI/Web 有 70+ built-in + 动态 skill + 动态 plugin 命令。差距体现在：

1. **无动态注册**：新增命令必须修改源码，无运行时扩展能力
2. **无 Skill 命令**：Gateway 有 `skills.status` RPC，但 Deck 不消费
3. **无 Plugin 命令**：官方有 `registerCommand()` API，Deck 无对应接口
4. **无后端命令发现**：Deck 不知道 Gateway/Agent 侧有哪些可用命令
5. **执行模型单一**：所有命令都是前端处理，无法委托后端执行

## Goals

- **G1**：命令注册表从静态数组重构为支持多来源的动态 Registry
- **G2**：通过 Gateway RPC 发现后端可用命令（built-in + skill + plugin）
- **G3**：命令面板 UI 支持混合来源命令的分类展示、参数补全
- **G4**：统一本地执行和远程执行两种模式的抽象
- **G5**：为 Plugin 命令预留扩展点

## Architecture Overview

```
┌─────────────────── Deck Frontend ───────────────────┐
│                                                      │
│  SlashCommandPalette ◄── CommandRegistry (dynamic)   │
│       │                    ▲     ▲      ▲            │
│       ▼                    │     │      │            │
│  CommandExecutor ──────────┘     │      │            │
│       │                          │      │            │
│  ┌────┴────┐              ┌──────┴──┐   │            │
│  │ Local   │              │ Remote  │   │            │
│  │ Handler │              │ Handler │   │            │
│  └─────────┘              └────┬────┘   │            │
│                                │        │            │
└────────────────────────────────┼────────┼────────────┘
                                 │        │
                   ┌─────────────┼────────┼─────────┐
                   │   Gateway   │        │         │
                   │             ▼        │         │
                   │  chat.send ──► auto-reply      │
                   │                      │         │
                   │  deck.commands.discover ◄──────│
                   │    (new RPC)                   │
                   │    ├── built-in commands        │
                   │    ├── skill commands           │
                   │    └── plugin commands          │
                   │                                │
                   │  SSE: commands.changed ────────►│
                   └────────────────────────────────┘
```

## Key Design Decisions

### D1: Registry Architecture — Map + Source Tagging

```typescript
type CommandSource = "local" | "builtin" | "skill" | "plugin";

type CommandExecMode = "local" | "remote";

interface RegisteredCommand {
  name: string;
  source: CommandSource;
  execMode: CommandExecMode;
  descriptionKey?: string;       // i18n key (local commands)
  description?: string;          // raw text (remote commands)
  args?: string;
  argOptions?: string[];         // static choices
  argSchema?: ArgSchema;         // JSON Schema for dynamic args (Layer 2)
  icon?: string;                 // lucide icon name
  category: string;              // extensible string, not enum
  priority: number;              // lower = higher priority
  /** Local-only: handler function */
  execute?: (sessionKey: string, args: string) => Promise<SlashCommandResult>;
  /** Visibility predicate (Layer 2) */
  visibleIf?: (ctx: CommandVisibilityContext) => boolean;
}
```

**Why Map + Source**：
- Map 按 name 索引，O(1) 查找，O(n) 遍历
- Source tag 区分命令来源，UI 可按来源分组或显示 badge
- Priority 字段实现官方的 Plugin > Built-in > Skill 优先级

**迁移**：现有 14 个 `SlashCommandDef` → 14 个 `RegisteredCommand`（source=`local`），零功能变更。

### D2: Gateway RPC — `deck.commands.discover`

新增 Gateway RPC 方法，返回当前 agent 可用的所有命令：

```typescript
// Request
interface DeckCommandsDiscoverParams {
  agentId?: string;  // 可选，默认 main agent
}

// Response
interface DeckCommandsDiscoverResult {
  commands: DiscoverableCommand[];
  version: string;  // 命令列表 hash，用于变更检测
}

interface DiscoverableCommand {
  name: string;
  source: "builtin" | "skill" | "plugin";
  description: string;
  args?: string;
  argChoices?: string[];
  category: string;
  /** Skill-specific */
  skillName?: string;
  /** Plugin-specific */
  pluginId?: string;
}
```

**实现逻辑**（Gateway 侧）：
1. 读取 `getChatCommands()` → built-in 命令列表（70+）
2. 调用 `listSkillCommandsForAgents()` → skill 命令
3. 读取 `listPluginInvocationKeys()` → plugin 命令
4. 合并去重、按优先级排序后返回
5. 计算 `version` hash 用于客户端缓存

**SSE 事件**：当 skill 加载/卸载或 plugin 注册/注销时，通过现有 SSE 通道推送 `commands.changed` 事件（仅含 version），客户端收到后重新 discover。

### D3: 执行模型 — Local vs Remote

```
命令执行分流：
├── source=local → 调用 command.execute() 直接执行
│   (现有 14 个命令保持原有逻辑)
│
└── source=builtin|skill|plugin → Remote 执行
    ├── chat.send("/{name} {args}") → auto-reply 处理
    ├── SSE 推送执行结果
    └── 结果展示为 assistant message
```

**Why chat.send**：
- 官方命令处理逻辑在 auto-reply 层，已有完整的 handler pipeline
- 不需要为每个命令实现前端 handler
- 后端已有权限校验、参数验证、错误处理
- 执行结果自然通过 SSE streaming 返回

**Local 命令保留**：
- `/new`, `/clear`, `/stop`, `/reset` 等纯 UI 操作继续在前端执行
- `/model`, `/think`, `/fast`, `/verbose` 继续用 `patchSession`（乐观更新 + SSE 校正）
- 不把已有的 local 命令改为 remote（避免延迟退化）

### D4: 命令面板 UI — 混合来源分组

```
┌─────────────────────────────────────┐
│ SESSION                             │
│  ⊕ /new       New session           │
│  ↻ /reset     Reset session         │
│  □ /stop      Stop generation       │
│ MODEL                               │
│  ⚙ /model     Set model             │
│  🧠 /think     Thinking level        │
│ SKILLS                        [new] │
│  ⚡ /github    GitHub integration    │
│  📝 /commit    Smart commit          │
│ PLUGINS                       [new] │
│  🔌 /myplug   Custom plugin cmd     │
│ MORE (70+ commands)           [new] │
│  ▶ Show all built-in commands...    │
└─────────────────────────────────────┘
```

**分组策略**：
- Local 命令按 category 分组（保持现有 4 类）
- Skill 命令单独 "SKILLS" 分组
- Plugin 命令单独 "PLUGINS" 分组
- Built-in 远程命令折叠在 "MORE" 中（70+ 太多不能全列）

**搜索**：
- 输入 `/` 显示全部（local + top skills + top plugins）
- 输入 `/gi` 过滤匹配（跨所有来源 prefix match）
- 未匹配任何注册命令 → 显示 "Send as message to agent"

### D5: 参数补全 — 静态 + 动态混合

**静态**（现有）：`argOptions: ["off", "low", "medium", "high"]` → 内联提示

**动态**（新增，Layer 2）：
```typescript
interface ArgSchema {
  type: "string" | "enum" | "model-id" | "agent-id" | "skill-name";
  /** For enum type: fetch choices from this endpoint */
  choicesEndpoint?: string;
  /** Placeholder hint text */
  placeholder?: string;
}
```

- `model-id` → 从 `/api/models` 拉取可选模型
- `agent-id` → 从 `/api/agents` 拉取可选 agent
- `skill-name` → 从 discover 结果中提取
- `choicesEndpoint` → 自定义端点（plugin 扩展用）

Ghost hint：用户输入 `/model ` 后，输入框显示灰色 `model_id` 提示。

### D6: 上下文过滤 — Visibility Predicates

```typescript
interface CommandVisibilityContext {
  isStreaming: boolean;
  hasMessages: boolean;
  sessionStatus: string;
  agentId?: string;
}

// 示例
{ name: "stop", visibleIf: (ctx) => ctx.isStreaming }
{ name: "compact", visibleIf: (ctx) => ctx.hasMessages }
{ name: "kill", visibleIf: (ctx) => ctx.isStreaming }
```

默认所有命令可见。`visibleIf` 仅用于减少面板噪声，不影响手动输入执行。

### D7: Plugin 扩展点预留

当前不实现 plugin 命令的完整链路，但预留以下扩展点：

1. **Registry**：`CommandSource` 包含 `"plugin"` 类型
2. **Discover**：`DiscoverableCommand` 包含 `pluginId` 字段
3. **UI**：面板支持 "PLUGINS" 分组
4. **Priority**：Plugin 优先级高于 Built-in（对齐官方）

未来实现时只需：
- Gateway 侧读取已注册 plugin 命令
- Deck 侧 discover 结果自然包含 plugin 命令
- 无需修改 Registry 或 UI 架构

## File Structure

### 新增文件

| 文件 | 职责 |
|------|------|
| `dashboard/src/lib/command-registry.ts` | `CommandRegistry` 类（Map + register/unregister/match/filter） |
| `dashboard/src/lib/command-types.ts` | 所有命令相关类型定义 |
| `dashboard/src/hooks/use-command-discovery.ts` | React hook：调用 discover RPC + SSE 监听 |
| `src/gateway/server-methods/deck/commands.ts` | Gateway RPC handler：`deck.commands.discover` |
| `src/gateway/protocol/schema/deck-commands.ts` | TypeBox schema for discover params/result |

### 修改文件

| 文件 | 改动 |
|------|------|
| `dashboard/src/components/panels/chat/slash-commands.ts` | 改为导出 local command definitions（供 registry 消费） |
| `dashboard/src/components/panels/chat/slash-command-executor.ts` | 重构为统一 executor（local dispatch + remote chat.send） |
| `dashboard/src/components/panels/chat/SlashCommandPalette.tsx` | 从 Registry 读取命令、支持多分组、ghost hint |
| `dashboard/src/components/panels/chat/MessageInput.tsx` | 接入 registry 的 parse/match 替代现有 parseSlashCommand |
| `src/gateway/server-methods-list.ts` | 注册 `deck.commands.discover` |
| `src/gateway/server-methods/deck/index.ts` | 导出 commands handlers |
| `dashboard/server/gateway-allowlist.ts` | 加入新 RPC |

## Migration Strategy

**Phase 1（零功能变更）**：
1. 提取 `command-types.ts`
2. 创建 `CommandRegistry` 类
3. 将 14 个静态命令注册到 Registry
4. Palette / Executor / MessageInput 切换到 Registry API
5. 所有行为不变，纯重构

**Phase 2（Gateway 发现）**：
1. 实现 `deck.commands.discover` RPC
2. 实现 `use-command-discovery` hook
3. Discover 结果注册到 Registry（source=builtin/skill/plugin）
4. Palette 显示新分组
5. Remote 命令通过 `chat.send` 执行

**Phase 3（Rich UX）**：
1. Ghost hint 参数提示
2. 上下文过滤（visibleIf）
3. 动态参数补全（argSchema）
4. "MORE" 折叠展开

## Risks & Mitigations

| 风险 | 缓解 |
|------|------|
| Discover RPC 延迟影响面板首次展示 | Phase 1 的 local 命令始终立即可用，discover 结果异步追加 |
| 70+ 远程命令淹没面板 | "MORE" 折叠 + 搜索过滤 |
| Skill/Plugin 命令名与 local 冲突 | Priority 排序 + 冲突时显示 `source:name` 限定名 |
| Gateway 侧改动影响上游同步 | 新代码全部在 `deck/` 目录（fork 自有代码，零冲突） |
| chat.send 执行远程命令无即时反馈 | toast "Command sent" + SSE streaming 结果 |
