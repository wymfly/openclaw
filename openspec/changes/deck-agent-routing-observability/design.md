## Context

OpenClaw Gateway 通过 7 层优先级绑定规则将渠道消息路由到 Agent，通过 Subagent 机制支持多智能体协作，通过 per-agent skill 白名单控制能力分配。这些机制的配置和状态完全封闭在 `config.yaml` 和运行时内存中，无 UI 可视化。

现有 openclaw-deck Dashboard（Next.js 16 + React 19 + Zustand 5 + shadcn/ui）已有 19 个面板，但 Agent 面板仅提供基础 CRUD，无路由/subagent/skill 管理能力。

完整设计 spec 位于 `docs/superpowers/specs/2026-03-19-deck-agent-routing-observability-design.md`。

## Goals / Non-Goals

**Goals:**

- 让运维和管理员通过 Web UI 理解、配置和监控 Agent 路由、Subagent 协作和 Skill 分配
- 新增 `deck.*` RPC 命名空间，与上游 API 完全解耦
- 路由模拟器让用户可验证"消息从哪来，到哪去"
- Subagent 实时监控让运维可观测多智能体运行状态

**Non-Goals:**

- 不修改上游路由引擎（`resolveAgentRoute`）的匹配逻辑
- 不实现 Subagent 历史的长期持久化（当前仅内存+磁盘，受 sweep 周期限制）
- 不引入新的外部依赖（图表库/可视化库）
- 不覆盖 Agent 创建/删除流程（继续使用上游 `agents.create/delete`）
- 视觉设计不在此阶段确定，实施时使用 UI skill

## Decisions

### D1: API 命名空间 — `deck.*` 前缀

**选择：** 所有新增 RPC 使用 `deck.` 前缀（如 `deck.routing.list`）

**备选方案：**

- `x-` 前缀（HTTP 扩展头惯例）→ 语义较弱，与产品无关联
- 按领域独立命名（`routing.*`, `runbook.*`）→ 可能与上游未来添加的同名方法冲突
- 扩展现有 `agents.update` 入参 → rebase 冲突风险高

**理由：** `deck` 是 Dashboard 产品名，上游不会使用此前缀。后端文件统一放在 `src/gateway/server-methods/deck/` 目录下，rebase 时整个目录零冲突。

### D2: Binding ID — 内容哈希合成

**选择：** 使用 `sha256(JSON.stringify(normalizedMatch)).slice(0, 12)` 作为 binding 的合成 ID

**理由：** 上游 `AgentBinding` 类型无 `id` 字段（config.bindings 是无 ID 数组）。数组索引在并发修改下不稳定。内容哈希是确定性的，相同 match 产生相同 ID，且不修改上游类型定义。

**归一化保证：** 哈希输入必须经过归一化（sorted keys, trimmed, lowercased）后再 `JSON.stringify`，确保即使 config 文件序列化顺序变化，相同语义的 match 始终产生相同 ID。归一化函数复用现有 `normalizeBindingMatch()` 逻辑。

### D3: Optimistic Locking — baseHash

**选择：** 所有写入 RPC 接受 `baseHash` 并返回 `configHash`

**理由：** 复用现有 `config.patch` 的乐观锁模式。当两个 Dashboard 标签页同时修改 bindings 时，第二个写入会收到 `CONFLICT` 错误，前端重新加载后重试。

### D4: Per-Agent Subagent 配置范围

**选择：** `deck.agents.subagents.set` 仅写入 `allowAgents` + `model`（与上游 `AgentConfig.subagents` 类型对齐）

**备选：** 允许 per-agent 覆盖 `maxSpawnDepth`/`maxChildrenPerAgent`/`thinking`

**理由：** 上游类型系统不支持 per-agent 覆盖这些字段（它们仅在 `agents.defaults.subagents` 全局级别）。扩展类型系统会增加 rebase 冲突面。全局限制在 Subagents 面板 Config Tab 中通过 `config.patch` 管理。

### D5: 页面组织 — 混合策略

**选择：** 2 个新面板（Routing + Subagents）+ 4 个面板增强（Agents/Sessions/Skills/Channels）

**备选：** 全部嵌入现有面板 / 全部新增独立面板

**理由：** 配置功能（绑定/skill/subagent 权限）是 agent-centric 的，嵌入 Agents 详情页自然。路由总览是跨 Agent 的全局视图，需要独立面板。Subagent 监控是运行时可观测性，属于 OBSERVE 组。

### D6: 谱系树渲染 — 纯 CSS

**选择：** `LineageTree` 组件使用 CSS flexbox + 伪元素画连线

**备选：** D3.js / vis.js / react-flow

**理由：** 典型 subagent 树深度 ≤3、节点 ≤10，不需要重型图表库。纯 CSS 方案零依赖，SSR 友好，与现有 shadcn/ui 风格一致。

### D7: Subagent 轮询 — Visibility-gated

**选择：** 活跃运行 5s 轮询，通过 `document.visibilitychange` 事件在页面不可见时暂停

**备选：** SSE/WebSocket 推送

**理由：** Gateway 现有架构以 RPC 为主，活跃 subagent 数量通常很少（≤5），5s 轮询开销可接受。SSE 升级作为未来迭代。

### D8: RPC 鉴权 Scope — 读写分离

**选择：** 读取类 RPC（list/get/detail/validate/simulate/lineage）注册为 VIEWER scope；写入类 RPC（add/remove/set/kill/link/unlink）注册为 ADMIN scope

**理由：** 面向"非技术运维"的可视化需求以只读为主，VIEWER scope 即可满足。配置变更需要更高权限。未在 `method-scopes.ts` 注册的方法默认走 ADMIN（参见 `src/gateway/method-scopes.ts`），但显式注册更安全可审计。

## Risks / Trade-offs

- **[Subagent 历史丢失]** → 运行记录在内存 sweep 后消失（默认 60 分钟），History tab 仅显示近期记录。缓解：UI 显示明确的时间范围提示；长期方案：追加写入日志文件（deferred）
- **[Binding ID 碰撞]** → SHA256 前 12 位（48bit）理论碰撞概率极低（百级绑定下可忽略）。缓解：`deck.routing.add` 返回生成的 ID，前端直接使用
- **[全局 subagent 限制无 per-agent 覆盖]** → 某些场景需要对特定 Agent 放宽限制。缓解：当前全局默认已足够；如需求明确，可在后续迭代扩展上游类型
- **[轮询在多 Tab 场景下的开销]** → 多个浏览器标签页同时打开 Subagents 面板时并发轮询。缓解：visibility-gating 确保只有前台 Tab 轮询
- **[Identity Links 格式转换]** → `deck.identity.*` API 需要拆分/拼接 `"channel:peerId"` 格式。缓解：实现中做好边界处理（peerId 本身含 `:` 的情况用 `channel:` 前缀精确匹配）

## Open Questions

- Subagent 长期历史持久化的具体方案（append-only JSONL / SQLite / 外部存储）留待后续迭代确定
- 是否需要为 `deck.*` API 添加独立的认证/授权层（当前复用 Gateway 现有的 device token 机制）
