## Why

Deck 当前有 14 个硬编码 slash 命令（静态数组），而官方 CLI/Web 有 70+ built-in + 动态 skill + 动态 plugin 命令。Deck 无法在运行时发现和展示 Gateway 侧的可用命令，也无法执行 skill 或 plugin 命令。这阻止了 Deck 从"对标补差"向"功能增值"演进——用户在 Deck 中无法使用 agent 工作区的 skill，也无法使用已注册的 plugin 命令。

## What Changes

- **命令注册表重构**：静态 `SLASH_COMMANDS` 数组 → 动态 `CommandRegistry` 类（Map + `register()`/`unregister()` API），支持多来源命令（local / builtin / skill / plugin）
- **Gateway 命令发现 RPC**：新增 `deck.commands.discover` 方法，返回当前 agent 可用的 built-in、skill、plugin 命令列表及元数据
- **SSE 命令变更通知**：通过现有 SSE 通道推送 `commands.changed` 事件，前端实时更新命令列表
- **统一执行引擎**：Local 命令直接执行 Zustand action，Remote 命令通过 `chat.send` 委托 auto-reply 处理
- **命令面板增强**：支持混合来源分组（Session / Model / Skills / Plugins / More）、ghost hint 参数提示、上下文过滤（`visibleIf`）
- **Plugin 命令扩展点预留**：Registry、Discover、UI 均包含 plugin 类型支持，未来实现无需架构变更

## Capabilities

### New Capabilities

- `command-registry`: 动态命令注册表——支持多来源、优先级排序、冲突检测的 Map-based registry
- `command-discovery`: Gateway 命令发现——`deck.commands.discover` RPC + SSE 实时通知
- `command-execution`: 统一执行引擎——Local handler 直接执行 + Remote handler 通过 chat.send 委托
- `command-palette-enhanced`: 增强命令面板——混合来源分组、动态参数补全、上下文过滤、ghost hint

### Modified Capabilities

（无现有 spec 需要修改——现有 14 个命令功能完全保留，仅内部实现从静态数组切换到 registry）

## Impact

- **Frontend**：`dashboard/src/components/panels/chat/` 下的 slash-commands.ts、slash-command-executor.ts、SlashCommandPalette.tsx、MessageInput.tsx 重构；新增 `dashboard/src/lib/command-registry.ts`、`command-types.ts`、`hooks/use-command-discovery.ts`
- **Gateway**：`src/gateway/server-methods/deck/commands.ts` 新增 RPC handler；`src/gateway/protocol/schema/deck.ts` 新增 TypeBox schema；server-methods-list.ts 注册新方法
- **Protocol SDK**：`pnpm protocol:gen:ts` 重新生成 typed client
- **Allowlist**：`dashboard/server/gateway-allowlist.ts` 加入新 RPC
- **i18n**：`zh.json` / `en.json` 新增命令分组标签（Skills / Plugins / More）
- **上游同步影响**：Gateway 新代码全部在 `deck/` 目录（fork 自有），零上游冲突
