# Project Context — openclaw / deck-go

> Living glossary of core domain terms and their relationships. Updated
> in-place during grill sessions — **do not batch updates**, capture as
> decisions crystallize.
>
> Established 2026-05-12 during Phase 1 of `REALIGNMENT.md`. Status:
> in progress.

---

## Core entities

### OpenClaw

**Definition**: 整个仓库 `src/` 下的 Node/TypeScript core，包含 CLI、commands、
infra、media、Gateway、agents、channels、plugin runtime、sessions 等所有
子模块。

**Position**: 仓库根 `src/`。

**与本 fork 的关系**: 本仓库（`wymfly/openclaw`）是 `openclaw/openclaw` 的
增强 fork，`enhanced` 分支跟踪上游。

**Aliases to avoid**: 不要用 "openclaw" 单独指 Gateway——它指**整个 TS core**。

---

### Gateway

**Definition**: OpenClaw 内的**对外控制接口层**——把 OpenClaw 内核能力
通过 RPC（WebSocket / SSE / HTTP）暴露给外部消费者。

**Position**: `src/gateway/`。子目录：

- `protocol/` — typed wire protocol（schema authority）
- `server-methods/` — 各 RPC 方法 handler（按域分文件，如 `chat.ts`、
  `agents.ts`、`config.ts`、`sessions.ts`、`skills.ts` 等 50+ 模块）
- `server-methods/deck/` — **专门给 deck 用的 RPC 命名空间**
- `server/`、`services/` — 服务支撑

**与 OpenClaw 的关系**: Gateway **是 OpenClaw 的子模块**，不是平行实体。

**扩展机制**: `src/gateway/server-methods/_method-defs.generated.ts` 和
`_modules.generated.ts` 是**自动生成**的索引文件——意味着加一个新 RPC
模块（如 `deck.module.ts`）只需写新文件、跑 generator，dispatcher 自动注册，
**不需要手工修改核心 dispatcher 源代码**。这让 deck 扩展可以零冲突合入
OpenClaw 主线。

---

### deck-go

**Definition**: 控制端（"control 端"）。通过 Gateway 的 RPC API 控制 OpenClaw
runtime。是企业管理 / 运维平台的实现。

**Position**: 仓库根 `deck-go/`：

- `backend/` — Go BFF
- `frontend-new/` — React frontend（active workspace）
- `contracts/` — 契约源 + 生成产物

**与 OpenClaw 的关系**: 通过 Gateway 间接交互。**Browser 代码不直接调 Gateway**
——只调 deck-go BFF，BFF 再调 Gateway。

**Runtime modes**（由 `.env` 决定，运行时不切换）:

- `bundled`: deck-go 本机 spawn OpenClaw Gateway
- `remote`: deck-go 连接远程已运行的 Gateway

---

### runtime（"runtime 端"）

**Definition**: 与 control 端（deck-go）相对的 **被控制方** 概念。本项目里
有**狭义 / 广义** 两层用法，必须按上下文区分:

| 层               | 范围                                                                                                                                                         | 用在哪里                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| **狭义 runtime** | OpenClaw 内核里**真正执行** agent / session / channel / plugin 的部分（`src/agents/`、`src/channels/`、`src/plugins/`、`src/sessions/`、`src/commands/` 等） | 讨论"内核稳定性"、"Gateway 调内核能力"时 |
| **广义 runtime** | OpenClaw 整体（含 Gateway 接口层）—— deck-go control 视角下的**真实控制对象**                                                                                | 用户口语"runtime 端"主要指这一层         |

**deck-go control 的精确对象** = **一个 Gateway 对象**：

- `bundled`: deck-go 自己 spawn 的子进程 Gateway
- `remote`: 远程已运行的 Gateway
- 这两种 control 视角下统一为"一个 Gateway 对象"

**Aliases / 写代码时的精确化**:

- "Gateway runtime" → 广义 runtime
- "internal runtime" / "kernel runtime" → 狭义 runtime
- 不要单独说 "runtime"，必须带前缀

---

## Relationships

```
┌──────────────────────────────────┐
│ Browser (React / frontend-new)   │
└──────────────┬───────────────────┘
               │ HTTP / SSE
┌──────────────▼───────────────────┐
│ deck-go BFF (Go, backend/)       │  ← "control 端"
└──────────────┬───────────────────┘
               │ Gateway RPC (WS / HTTP / SSE)
┌──────────────▼───────────────────┐
│ Gateway (src/gateway/)           │  ← OpenClaw 的对外接口层
│   含通用方法 + deck-* 命名空间   │
└──────────────┬───────────────────┘
               │ in-process
┌──────────────▼───────────────────┐
│ OpenClaw 内核                    │  ← "runtime 端"
│   src/agents/                    │
│   src/channels/                  │
│   src/plugins/                   │
│   src/commands/                  │
│   src/sessions/                  │
│   ...                            │
└──────────────────────────────────┘
```

---

## Flagged ambiguities

### A1. "避免大幅改动 OpenClaw" 的边界 — ✅ Resolved 2026-05-12

**用户表达**: "为了避免大幅改动 openclaw，所以通过这种接口层来做控制端"

**代码事实**: `src/gateway/server-methods/deck/` 已存在专门的 deck-\* RPC
命名空间（`deck.module.ts` / `deck-auth.module.ts` / `deck-post-agents.module.ts`

- deck/ 子目录）。

**用户澄清的动机（A + C + D 三层叠加）**:

- **A. Rebase 痛** — OpenClaw 是 fork，需要经常 fetch upstream 修缺陷和拉
  新功能。控制端代码冲突要尽可能少
- **C. 内核稳定** — 不希望 deck-go 这个新需求反向逼 OpenClaw 内核改设计
- **D. 实施可控** — 增量都尽量做在 deck-go 一侧，避免在 OpenClaw 这边引入
  bug
- 但前提是：deck-go 要做产品化设计，原生 Gateway RPC 不一定全部满足，所以
  允许在 Gateway 层的 deck.\* 命名空间内增量

**实际允许的扩展边界（4 层规则）**:

| 层                                                                                                 | 是否允许改                    | 理由                                              |
| -------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------- |
| 1. OpenClaw 核心模块（agents / channels / plugin runtime / sessions / commands 等）                | ❌ 不动                       | C + D — 内核稳定，不感知 deck                     |
| 2. Gateway 通用 RPC handler（chat.ts / agents.ts / config.ts / sessions.ts 等既有文件）            | ❌ 不修改既有方法签名和行为   | A + C — 上游可能改这些文件                        |
| 3. Gateway 的 deck._ 命名空间（src/gateway/server-methods/deck/ 子目录 + 散在的 deck-_.module.ts） | ✅ **允许写新文件、加新方法** | 纯增量文件，上游不会有，rebase 零冲突             |
| 4. 核心 dispatcher 文件（如 server-methods.ts）                                                    | ❌ 不手工改                   | 靠 `_modules.generated.ts` 生成机制自动注册新模块 |

> ⚠️ **次级 ambiguity（待 Q3 解决）**:
> deck.\* 命名空间内允许写**什么类型**的方法还没说清——纯包装通用 RPC？
> 暴露内核未公开的能力？纯 deck-go 产品逻辑？三类风险不同，需要 Q3 划线。

---

### A3. bundled 模式存废 — ✅ Resolved 2026-05-13 (二次 reframe)

**决策**: **保留 mode 二元概念, 改造 bundled 的实现机制**。

> ⚠️ **本节经历过一次 reframe**: 初次 resolution 误读为"砍掉整个 bundled
> 概念走 remote-only"。用户二次澄清后修正为"砍 BFF spawn 子进程的实现机制,
> 但保留'本地 vs 远程'的产品语义二元"。

**用户原话两段（2026-05-13）**:

> "应该算是一个历史包袱。因为从整个开发历程来看，OpenClaw 的 Gateway 用
> 官方的命令行单独启动就可以了。无论是独立的 App，还是 Web 端，需要的
> 其实是运维 Gateway，而不是把它包含进去。"

> "但是要做到收敛，你必须设置前后端，本地运维 gateway 和之前子进程的方式
> 虽然有本质区别，但是有一个语意是相同的，就是它是启动在本地，如果用远程
> 模式，它可以通过 ip 去连接远程的 gateway，就不负责运维了。"

**核心概念修正**:

deck-go 不是"Gateway 容器"，是 **Gateway 的客户端 + 可选的本地运维 launcher**。
跟 OpenClaw 官方 CLI、未来桌面 app 同级。

**新 mode 二元定义**:

> ⚠️ **mode 是运行时可切换状态, 不是 boot-time 冻结配置**. 表中各列描述
> 的是"当前连接对象的派生属性", 不是启动时的固定身份. 详见下方
> "运行时切换语义"子节.

| 维度                        | **local mode** (新, 替代旧 bundled)                                                                      | **remote mode** (语义不变)                          |
| --------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Gateway 物理位置            | 本机                                                                                                     | 网络远端                                            |
| Gateway 进程谁起?           | deck-go 触发**官方运维路径** (`openclaw gateway install + start`, 系统服务 launchd / systemd / schtasks) | 不归 deck-go 管, 用户/运维预先起好                  |
| Gateway 进程归属            | 独立运维实体 (OS service manager 拥有)                                                                   | 完全独立                                            |
| deck-go 与 Gateway 进程关系 | **解耦** — 重启 / 崩溃 deck-go 不影响 Gateway                                                            | 解耦                                                |
| Endpoint 来源               | **约定固定** — `localhost:18789` + isolated `openclaw.json`, 不需要用户输入                              | **用户输入** — 切换时填 endpoint URL + token        |
| Token 获取                  | deck-go 自动读 `gateway.auth.token` (本地 `openclaw.json`)                                               | 用户切换时输入                                      |
| 用户在 deck-go UI 里看到的  | 当前连接 = `localhost:18789` ● Running; 完整运维 controls `[Start] [Stop] [Restart] [Reinstall]`         | 当前连接 = `<endpoint>` ● Connected; `[Disconnect]` |
| 默认 dev 体验               | 启动 deck-go → 自动 probe 本地 Gateway → 没在跑提示 install/start → 连接                                 | 用户主动切换才进入 remote                           |

#### 运行时切换语义 (2026-05-13 三次澄清, 用户原话)

> "1. 本地模式 — 后端采用 OpenClaw 官方的运维方案. 前端能够看到本地运维
> 的状态和运维指令, 相当于一个图形化运维, 而不是官方原本那种终端指令式
> 的运维. 只要你启动本地 Gateway, 理论上就会默认连接到这个本地 Gateway."
>
> "2. 远程模式 — 因为我们有远程模式, 所以前端其实可以切换到远程模式,
> 直接通过远程连接信息去连接远程. 当然你也可以断开远程连接, 切回连接
> 到本地. 连接到本地时不需要输入 IP 等信息, 默认使用本地版本的连接信息."

**核心架构假设 (跟当前实现冲突)**:

- ❌ **`RUNTIME_MODE` env 启动时冻结** — 这个旧假设作废
- ✅ **mode 是当前连接对象的派生属性** — 连 `localhost:18789` 就是 local, 连远端 URL 就是 remote
- ✅ **默认状态 = local** — 启动 deck-go 时没有 saved remote 配置, 自动尝试连本地
- ✅ **remote 是临时叠加** — 用户主动切, 切回本地不需要任何输入
- ✅ **mode 切换持久化** — deck-go 记住"上次连的是什么", 下次启动按上次的连; 连不上时 fallback 到本地
- ✅ **切到 remote 期间, 本地 Gateway 进程保持运行** — 不 stop, 不询问. 用户可能马上切回, 而且 Gateway daemon 不该跟 UI client 生命周期耦合

**类比**: deck-go 像 IDE 的"本地工作区 vs 远程 SSH 工作区"切换. 默认本地,
切到远程要输信息, 切回本地零摩擦.

**`RUNTIME_MODE` env 的新角色 (如果保留)**:

- 不再是"唯一 source of truth"
- 最多是"首次启动时默认值" — 如果设了 `RUNTIME_MODE=remote` + endpoint/token, deck-go 首次启动直接走 remote
- 用户在 UI 里切换后, 持久化优先级 > env

#### 对 `runtime-mode-decoupling` 提案的冲击

该提案的核心假设是 "mode 启动时冻结, facade 内部静态绑定一种 mode 的实现".
新需求让这个假设崩塌:

- facade 必须支持**运行时 swap Gateway client** (或 BFF 重启切换 endpoint)
- envconf 不能在启动时 lock mode, 必须可重新解析当前连接配置
- frontend 必须有 mode toggle UI + endpoint 输入 form + 持久化存储
- contract 需要新增 "切换 mode" 的 deck-go BFF endpoint (e.g. `POST /api/runtime/connect`)

→ 现有 `runtime-mode-decoupling` 提案 task 标 `[x]` 完成, 但只达成"启动时
解耦", 未达成"运行时切换". 处理方式:

- 选项 a: **reopen** 该 change, 追加运行时切换 task
- 选项 b: **不动旧 change** (它的"解耦" 目标在 facade 层确实达成了), **开新 change** `gateway-launcher-rewrite` 把砍 spawn + 运行时切换 + 命名重命名一起做
- 选项 c: 拆两个 change — `gateway-launcher-rewrite` (砍 spawn + 重命名 + R2 violation) + `runtime-mode-switching` (运行时切换)

**Q6 Resolution (2026-05-13)**: 选 **c** (β 二分) — 不动旧 `runtime-mode-decoupling`
change, 串行开两个新 change. 详见下方"收敛节奏" 子节.

**与旧 bundled 的关键区别**:

| 维度       | 旧 bundled (要砍)                                             | 新 local (要建)                                                     |
| ---------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| 启动机制   | BFF 进程 spawn Gateway 作为子进程                             | BFF 调 `openclaw gateway install + start`, OS service manager 接管  |
| 生命周期   | 与 BFF 耦合, BFF 崩溃 Gateway 也死                            | 独立, BFF 退出后 Gateway 继续                                       |
| 关键决策点 | `RUNTIME_BUNDLED_COMMAND` / `RUNTIME_BUNDLED_ARGS` 在 BFF env | 全部由官方 CLI flag + `openclaw.json` 接管                          |
| 重启行为   | BFF 自己处理 (`supervisor` 包)                                | `openclaw gateway restart` 走 launchctl/systemctl                   |
| Token 来源 | BFF 生成或注入                                                | 走官方 token 模型 (`gateway.auth.token` / `OPENCLAW_GATEWAY_TOKEN`) |

**与旧 bundled 共享的语义** (用户原话: "有一个语意是相同的, 就是它是启动在本地"):

- Gateway 跑在本机
- deck-go 承担"启动 Gateway"的触发动作 (虽然不是 spawn child)
- 用户安装 deck-go 后, 期望"开箱即用", 不需要先去别的 terminal 起 Gateway

#### "本地 Gateway" 的精确身份 (2026-05-13 四次澄清)

> 用户原话: "我说的本地启动 gateway, 其实是我提供本地二次开发的版本, 不是
> 从官方下载安装, 也就是说我们的运维是运维自己本地的版本（在同一个根目录）"

**重要澄清**: "本地 Gateway" ≠ 用户机器上独立装的 OpenClaw, **=** 本仓库
build 出来的 `dist/entry.js`. deck-go + OpenClaw 是**同一个二次开发产物
的两部分**, 共用本仓库根目录:

```
<repo-root>/
├── src/                        ← OpenClaw 内核 + Gateway 源码
├── dist/                       ← build 产物 (entry.js / gateway 等)
├── deck-go/                    ← deck-go 控制端 (backend + frontend)
│   ├── backend/
│   └── frontend-new/
└── (other workspace dirs)
```

**用户分发形态**: 用户 clone / 下载本仓库 → build 一次 → deck-go 启动时
跑的 Gateway 就是本仓库 build 出来的, 跟 deck-go 同 source.

**"官方运维路径" 在此 context 下的具体形态**:

- 仍然走 launchd / systemd / Windows schtasks (audit Q3 确认的官方机制)
- 但 plist / unit / task 的 **entrypoint 指向本仓库的 `<repo-root>/dist/entry.js`**, 不是 `~/.local/bin/openclaw` 或 `/usr/local/bin/openclaw`
- 当前实现里 `RUNTIME_BUNDLED_COMMAND=node` + `RUNTIME_BUNDLED_ARGS="dist/entry.js gateway run ..."` 已经是这个模式 — 改造时延续 entrypoint 路径策略, 只是换"spawn child" → "let launchd 跑同样的 entrypoint"
- isolated state: `deck-go/.local/.../managed-gateway-state/openclaw.json` 持续使用

**带来的简化** (Q7.3 状态 E 消失):

- ❌ 不需要担心"用户没装 OpenClaw" — 本仓库 build 就包含
- ❌ 不需要 onboarding 引导 `npm install -g openclaw`
- ❌ 不需要 deck-go 跨界做"全局 npm package 管理"
- ✅ deck-go BFF 通过**相对仓库 root** 找到 `dist/entry.js` (BFF 知道自己住在 `<repo-root>/deck-go/backend/`)

**新增的 sub-question** (Q7.6 — entrypoint 路径定位策略):

- (a) 相对路径解析: BFF 启动时 `path.resolve(__bff_dir, "../../../dist/entry.js")` (默认)
- (b) 显式 env: `OPENCLAW_REPO_ROOT` 覆盖默认 (用户在不同盘符 / symlink 场景)
- (c) install 时 absolute path 写入 plist / unit (一次性 lock 住路径; repo 移动后失效)

**风险点 (留 OpenSpec design 阶段细化)**:

- 同一台机器有多个 deck-go fork (e.g. `wymfly/openclaw` + `acme/openclaw`) 都想装本地 Gateway → launchd service 名冲突. 需要 install 时按 repo 路径 hash 生成 service 名 (类似 audit 提到的 PID lock file `$HASH` 策略)
- repo 目录移动后 plist 失效 → 启动时检测 + 自动 reinstall, 或显示错误引导 user 手动 reinstall

#### 设计哲学 — "Ensure 可用 + 生命周期可控, 不做其他" (2026-05-13 用户原话锚定)

> "由于运维的是本地的二次开发的 gateway, 其实主要目的就是为了能够保证
> 本地有一个可用的 gateway, 不需要花哨, 主要目的是可以让 gateway 的运行
> 生命周期可控."

**两个唯一的设计目标**:

1. **Ensure 可用**: 用户启动 deck-go, 默认能跟一个本地 Gateway 通话; 没有则一键准备好
2. **生命周期可控**: 用户能看到本地 Gateway 状态, 能 start / stop / restart, 能在 deck-go UI 内做完所有日常运维

**不做** (锚定 scope, 防止 scope creep):

- ❌ 监控 dashboard / metric 历史曲线 / 性能分析
- ❌ Gateway 升级管理 / 版本切换 / rollback (留给本仓库 build 流程)
- ❌ Token rotation / secrets management UI
- ❌ Log aggregation / log search (轻量错误日志摘要够了)
- ❌ Multi-Gateway 管理 (deck-go 只跟"一个 Gateway" 通话, 不是 admin console)
- ❌ Onboarding wizard / tutorial / 引导动画
- ❌ 任何"看着挺酷但跟生命周期可控无关"的 feature

**判定门槛**: 任何 PR / 子任务声称要做某件事, 必须能回答:
"这个动作直接服务于 ensure-available 还是 lifecycle-controllable?" 不能, 就是 scope creep, 拒绝。

**前后端都要感知 mode** (修正 R2):

> 用户明示: "要做到收敛, 你必须设置前后端"

业务功能 (chat / agents / sessions / channels / plugins / models / memory / skills)
**仍然 mode-agnostic**, 但 **Gateway 运维 surface 必须 mode-aware**。详见
修正后的 Rule R2。

**OpenClaw 官方 Gateway 运维 surface 事实 (2026-05-13 调研)**:

CLI 完整命令集合 (`src/cli/gateway-cli/` + `src/cli/daemon-cli/`):

- `gateway run` — 前台运行 (`--dev` 自动创建 dev config / workspace, `--allow-unconfigured` 跳过 local mode 检查)
- `gateway install / uninstall` — 注册为 launchd plist / systemd unit / Windows schtasks
- `gateway start / stop / restart / status` — 系统服务生命周期控制
- `gateway probe / health / discover` — 可达性 + 健康度 + Bonjour/DNS 发现
- `gateway call <method>` — 直接调 RPC
- `gateway usage-cost` — 会话成本汇总

生命周期机制:

- **不自实现 daemon** — 委托给 launchd / systemd / schtasks
- PID lock file: `$STATE_DIR/.locks/gateway.$HASH.lock` (单例), stale (>30s) 自动回收
- 跨平台 PID 活跃检测: Linux `/proc/*/stat`, macOS `ps`, Win32 `wmic`

Token / endpoint 模型:

- `gateway.auth.token` 写在 `openclaw.json` (全局 `~/.openclaw/config.json` 或项目级 `./openclaw.json`)
- env 覆盖: `OPENCLAW_GATEWAY_TOKEN` / `OPENCLAW_GATEWAY_PASSWORD`
- 客户端发现 endpoint: 通过 config / env / `openclaw gateway discover` (没有通用 IPC)

dev 推荐入口:

- `node dist/entry.js gateway run --dev --allow-unconfigured` — 不要用 `pnpm openclaw gateway run` (会触发 dirty-tree rebuild + runtime-postbuild staging)

**收敛动作清单（待后续 OpenSpec change 锁死, 暂名 `gateway-launcher-rewrite`）**:

⚠️ 注意: 这是**改造**清单不是**删除**清单。三个核心动作:
**(I) 砍 spawn 实现机制 → 调官方 CLI**
**(II) 实现运行时 mode 切换**
**(III) 重命名 + 收敛 mode-aware 到运维 surface**

| 区域                                                        | 旧 (BFF spawn 子进程, boot-time mode)  | 新 (官方运维路径 + 运行时切换)                                                                                |
| ----------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `backend/internal/runtime/bundled/` 包                      | spawn child + supervisor + lock 自实现 | 改为调 `openclaw gateway install/start/stop/status` (shell exec 或 SDK), 重命名 `local/`                      |
| `backend/internal/runtime/facade/` interface                | 启动时静态绑定一种实现                 | 新增 **运行时 swap 接口** — 切到 remote / 切回 local 触发 client reconnect                                    |
| `RUNTIME_BUNDLED_COMMAND` / `RUNTIME_BUNDLED_ARGS` env      | 控制 spawn 行为                        | 删除, 由 `openclaw gateway` CLI 自身参数接管                                                                  |
| `RUNTIME_MODE` env                                          | 唯一 source of truth, 启动时冻结       | 仅作"首次启动默认值", 持久化 store > env > 默认 local                                                         |
| `assets.go:269` / `legacy_admin_assets.go:249` 的 mode 分支 | 仅 bundled 加载 canvas A2UI            | functional leak 必须先暴露并迁移 — 由 Gateway 提供资源 or BFF 静态资源                                        |
| `Capabilities.mode` 字段                                    | `"bundled" \| "remote"`                | 重命名 `"local" \| "remote"`; 含义改为"**当前**连接对象类型" 而非启动 mode                                    |
| `frontend-new/src/api.ts` 的 mode 类型守卫                  | `isBundledRuntimeStatus()` 等          | 重命名 `isLocalRuntimeStatus()`, **逻辑保留**, 限定运维 surface 使用                                          |
| **新增 deck-go BFF endpoint**                               | 不存在                                 | `GET /api/runtime/connection` 查询当前连接; `POST /api/runtime/connect` 切换 (含 disconnect → fallback local) |
| **新增 frontend mode toggle UI**                            | 不存在                                 | "Gateway 设置" 面板 + 可能的 HeaderBar 指示器; remote 切换时输入 endpoint+token form                          |
| **新增持久化 store**                                        | 不存在                                 | deck-go 记住"上次连什么"; 推荐写到现有 `deck-state.json` (remote 模式已用此持久化 endpoint)                   |
| `HeaderBar.tsx` 的 mode-aware 渲染                          | mode 字符串硬编码                      | 通过 capability 抽象, 限定在"Gateway 运维面板"区域 (或 HeaderBar 显示当前连接 status)                         |
| `.env.bundled.example` / `scripts/dev/run-bundled.sh`       | 设 bundled-only env                    | 改名为 `.env.local.example` / `run-local.sh`, 内容大幅变化                                                    |
| E2E `test/e2e/bundled.spec.ts`                              | 验 spawn 子进程行为                    | 改为验"官方运维路径触发本地 Gateway + connect"; 改名 `local.spec.ts`; 新增运行时切换 spec                     |
| `run-stack-real.sh`                                         | BFF spawn Gateway                      | 改为先 `openclaw gateway install + start`, 再启 BFF                                                           |
| **切到 remote 时本地 Gateway**                              | 不适用                                 | **保持运行不停**; 用户切回时直接重连, 零 cold start                                                           |

**收敛节奏 (Q2 选 A, Q6 选 β 二分)**: 拆成两个串行 OpenSpec change.

**Change 1 — `gateway-launcher-rewrite` (清理)**:

Scope: 砍 spawn 实现机制 + 命名 `bundled → local` + R2 violation 修复 + assets.go functional leak 迁移 + E2E 体系适配.
完成后 deck-go **能力表面跟现在一样** (mode 仍然启动时决定), 但底层从 spawn 变成调官方 CLI, 命名干净, E2E 体系兼容新机制.

- Stage 1 (≤ 2 周): 修 6 处 R2 violation; 暴露并迁移 assets.go canvas A2UI 资产
- Stage 2 (1 release): backend `bundled/` 包改造为调官方 CLI; 重命名 mode; 改 contract / env / scripts
- Stage 3 (E2E 适配): 处理下方 E2E Gap 1-5
- 验收: 等价行为 — `RUNTIME_MODE=local` 启动应能跟旧 `RUNTIME_MODE=bundled` 等价工作; E2E (mock + real) 全部跑通; Rule R3 (Real E2E ≡ release + .env) 不违反

**Change 1 E2E Gap 清单 (来自 Q9, 必须 explicit 处理)**:

| Gap | 内容                                                                                                                               | 决策方向                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | Mock E2E 启动方式 — BFF 不 spawn 后, `mock-gateway.mjs` 必须由 test fixture 独立启动, BFF 通过 endpoint connect                    | 重写 mock E2E setup, fixture 起 mock + 占 port, BFF 用 endpoint config 连                                       |
| 2   | Mock spec 合并 — 旧 `bundled.spec.ts` + `remote.spec.ts` 不再有 spawn 路径差异                                                     | 合并为 `mock.spec.ts` (single); `*-visual.spec.ts` 视情况合并; design.md 锁定                                   |
| 3   | CI matrix 简化 — `make e2e-mock-runtime` / `make e2e-mock-module` 不再跑两套 mode                                                  | 重新设计 make targets, 单跑或保留参数化但去掉 spawn 区分                                                        |
| 4   | Real E2E install 隔离 — `openclaw gateway install` 写 launchd plist 到 `~/Library/LaunchAgents/`, 测试场景不能污染用户系统         | 用 **per-repo-hash service 名** + `gateway uninstall` cleanup 兜底; 或走 `--dev` 临时 service. design.md 必须解 |
| 5   | `.env.remote.example` 在 change 2 时 revisit — change 1 mode 仍 boot-time, remote 保留; change 2 后 "remote 启动模式" 语义微妙变化 | change 1 保留不动, change 2 时 revisit                                                                          |

**Rule R3 在 change 1 的具体落地**: Stage 2/3 期间, 任何"E2E-only 路径"提议必须被 reject. 例如:

- ❌ "E2E 时让 BFF 直接 spawn 一个 mock Gateway, 比 launchd install 快"
- ❌ "E2E 用一个 stripped-down BFF entry, 跳过 install 检查"
- ✅ "E2E .env 设 `OPENCLAW_STATE_DIR=<isolated>` + `RUNTIME_DEV_MODE=1`, 跑跟 release 同样的代码"

**Change 2 — `runtime-mode-switching` (新增能力, 必须 change 1 完成后才开)**:

Scope: 运行时切换 — facade swap interface + BFF `/api/runtime/connect` endpoint

- frontend toggle UI + 持久化 store + SSE/WS 重连. 在 change 1 干净基础上加运行时切换.

* Stage 1 (1 release): facade swap interface + BFF 切换 endpoint + 持久化 (`deck-state.json` 扩展)
* Stage 2 (1 release): frontend Gateway 设置面板 + mode toggle + remote endpoint form + 状态指示
* Stage 3 (validation): SSE/WS 优雅迁移 + 运行时切换 E2E spec

> ⚠️ Change 2 必须等 change 1 完成 (依赖 facade 重构). CONTEXT.md 此处只
> 记录 change 2 的存在和 scope, 实际 OpenSpec proposal 推迟到 change 1 合并后再写.

**砍 bundled 实现机制后保留 R2 仍然有意义**:
新 local mode 仍然在 BFF 层做"调官方 CLI" 的胶水, 业务层不感知"调 CLI 是怎么调的"。
R2 修正版本继续约束业务层 mode-agnostic, 同时把"运维 surface" 显式列为合法的 mode-aware 区域。

---

### A2. "全面控制" 未定义 surface area

**用户表达**: "通过 gateway 的 rpc api 来全面控制它"

**待澄清**: "全面"的具体范围——哪些操作类别 / 粒度 / 时机 / 形态。

**deck-go 当前契约分层（事实，未由用户确认是否充分）**:

- `deck-mutations.contract.json` — 写操作
- `deck-list-queries.contract.json` — 读列表
- `deck-live-projections.contract.json` — 实时投影
- `deck-streams.contract.json` — 事件流
- `deck-config-write-safety.contract.json` — 配置写入安全策略
- `deck-route-governance.contract.json` — 路由治理
- `deck-dynamic-surfaces.contract.json` — 动态表面
- `deck-endpoints.contract.json` — 端点
- `deck-exceptions.contract.json` — 例外
- `deck-ui.contract.json` — UI 元数据

→ 这种分层暗示 control 不是单一形态。**A2 留待 Phase 2 prototype 阶段
通过手动玩 surface 完整答案**；Phase 1 只把分层维度记下来，不强行定义。

---

## Design rules（grill 沉淀的可执行规则）

### Rule R1 — 新增 deck.\* RPC 方法的协作 protocol（来自 Q3）

**默认做法**: 优先做**类型 1（包装/转换）**——deck.\* 方法只重组通用 RPC
输出为产品友好的 shape，不暴露 OpenClaw 内核没有的新能力。这类不需要
事先询问用户。

**类型 2（暴露内核未公开能力）的允许条件**——必须同时满足:

- 不影响内核稳定性（不依赖内核的 mutable state / private invariants /
  内部实现细节）
- 不是上游高频改动区（触碰的内核区域近期 commit 密度低，rebase 风险小）

**类型 3（纯 deck-go 产品逻辑）的额外考量**:

- 在加 deck.\* 方法前，先 surface "是否应该放 deck-go BFF 而不是 Gateway"
  这个选择题
- 如果产品逻辑不需要内核数据 / 内核流，**默认放 deck-go BFF**

**协作 protocol — 每次新增 deck.\* RPC 之前必须执行**:

1. 标明类型（1 / 2 / 3）
2. 类型 2：列出碰到的内核能力 + 上游该区近期是否改动
3. 类型 3：列出"放 deck-go BFF 的方案"作为替代
4. 召集一次 mini-grill 让用户决策

> ⚠️ **理由**: 用户不读底层 RPC、产品设计由 agent 主导，所以 agent 必须
> **主动**在每次具体新增时把决策点抛给用户，而不是凭判断直接加。这是
> Phase 5 模块展开期反复要执行的 protocol。

### Rule R2 — Control surface 分层 mode-aware（来自 Q4, 2026-05-13 修正）

deck-go control 视角下, **业务层** 不区分 mode, **运维层** 必须区分 mode。

> ⚠️ **本规则经历过一次修正**: 初版说 "业务层 + 运维层全部 mode-agnostic,
> 进程管理是 BFF 内部细节不进 UI"。A3 二次 reframe 后 (2026-05-13) 用户
> 明确"前后端都要感知 mode"——但要感知的是 **Gateway 运维 surface**, 不是
> 业务功能。R2 同步修正。

**两个分层的精确定义**:

#### 业务 surface (mode-agnostic) — 9 核心模块 + 17 边缘模块

- 9 核心: chat / agents / sessions / subagents / channels / plugins / models / memory / skills
- 17 边缘: config / settings / approvals / nodes / cron / webhooks / logs / usage / activity / alerts / budget / api-explorer / docs / identity / gateway / threads / 等
- 这些 UI / contract / 业务逻辑代码 **不感知 mode**, 任何"if mode == local then... else if mode == remote then..."都是违规
- testing fixtures 用同一组契约跑两种模式 (无差异)

#### 运维 surface (mode-aware) — Gateway lifecycle 管理 UI 区域

- **前端**: 一个明确的"Gateway 设置 / 状态"面板, 根据 mode 显示不同 control:
  - **local mode**: 显示本地 Gateway 进程状态 (running / stopped); 按钮: [Start] [Stop] [Restart] [Reinstall]; 显示 isolated `openclaw.json` 路径
  - **remote mode**: 显示 endpoint URL + token + 连接状态; 字段: endpoint, token, TLS verify; 按钮: [Test Connection] [Reconnect]
- **后端**: facade interface 暴露 capability 区分 (`mode`, `endpointMutable`, `supervisorState`); local/remote 各有自己的 runtime 实现包
- **contract**: `Capabilities.mode = "local" | "remote"` 字段保留, 业务层不读它, 只有运维 surface 读

**实施约束**:

- 业务 surface 代码 grep `"local"` / `"remote"` / `Capabilities.mode` 应几乎零命中 (只允许通过 facade 抽象传递, 不直接条件分支)
- 运维 surface 代码 mode-aware 是显式设计, 不是 leakage
- 类型守卫如 `isLocalRuntimeStatus()` / `isRemoteRuntimeStatus()` 只允许在运维 surface 使用; 在业务 surface 使用 = R2 违规

**Q5 Resolution（2026-05-12, 已被修正）**: 初版说"进程管理完全不进 UI"。
A3 二次 reframe 后 (2026-05-13) 修正为: **进程管理在运维 surface 内进 UI**
(用户在 deck-go UI 里直接看到本地 Gateway 状态并能 start/stop/restart),
**业务 surface 仍然不感知进程管理**。

**关键 audit 发现 (2026-05-13) — 当前 R2 违规分类**:

业务 surface 违规 (必须修):

- `frontend-new/src/deck-ui/HeaderBar.tsx:31` — header 直接读 `runtime.mode === "remote"` 做条件渲染。要么改走 capability 抽象, 要么把该条件移到运维 surface 内
- `backend/internal/server/assets.go:269` / `runtime/openclaw/legacy_admin_assets.go:249` — canvas A2UI 资产仅 bundled 加载, 这是 **functional leak** — 必须先确定资产归宿 (Gateway 暴露 / BFF 静态 / 前端静态)

可接受 (但应迁移到"运维 surface" 集中):

- `frontend-new/src/api.ts:566/572/578` — `isBundledRuntimeStatus()` / `isRemoteRuntimeStatus()` / `normalizeRuntimeGatewayStatus()` 类型守卫。重命名 `bundled → local`, 集中到运维 surface client。
- `frontend-new/src/components/runtime/FirstRunBanner.tsx` / `ModeBadge.tsx` — 已经是"运维 surface" 的合规组件, **不需要修**。

### Rule R3 — Real E2E 与 release 同源（来自 Phase 3 Q9, 2026-05-13）

**用户原话**:

> "其实和 release 部署的区别就在于调试模式启动和一些测试用的 .env 中变量的区别"

**强约束**:

Real E2E 跑的代码路径必须跟 release 部署**同源**. 唯一差别 =
**调试模式 flag** + **测试 .env 变量**. 不允许"E2E 走特殊 backdoor 路径,
release 走另一套" 的分叉.

**含义**:

- Real E2E 启动的 Gateway = 跟 release 一模一样的 build, 一模一样的 launch 路径
  - ✅ `openclaw gateway install + start` 在 E2E 也跑, 不绕开
  - ❌ 不允许 E2E-only 的 spawn shortcut / E2E-only 的 mock injection
- E2E 跟 release 的唯一允许分歧 = `.env` 里的:
  - 隔离路径 (e.g. `OPENCLAW_STATE_DIR=<repo>/deck-go/.local/...`)
  - 调试 flag (e.g. `RUNTIME_DEV_MODE=1`, frontend 走 Vite dev mode 而非 build)
  - 测试 token / test fixture 端口

**Mock E2E 跟 R3 的关系**:

- Mock E2E **不受 R3 约束** — mock 本身就是 release 路径的替代品, 用于 CI 快测
- Mock Gateway 由 test fixture 启动 (不是 BFF spawn), BFF 通过 endpoint 连 — 这是测试设计, 不是路径分叉
- 但 mock E2E + real E2E 跟同一份 deck-go BFF + frontend 代码对接, BFF 不允许"if running in mock then..."

**理由**:

- 若 E2E 用 shortcut 路径跑通而 release 路径有 bug, 测试不发现 → 生产事故
- 这条规则在 change 1 / change 2 / 后续 OpenSpec change 都生效, 不只是这次收敛

---

## Module priorities（来自 Q6）

### 核心模块（Phase 5 优先）— 9 个

按用户表述的优先级:

| 模块          | 角色                                      |
| ------------- | ----------------------------------------- |
| **chat** ⭐   | **核心中的核心** — product differentiator |
| **agents**    | chat 的对话主体                           |
| **sessions**  | chat 的容器                               |
| **subagents** | agent 之间的协作                          |
| **channels**  | agent 接入通道                            |
| **plugins**   | agent 能力扩展                            |
| **models**    | agent 用的模型                            |
| **memory**    | agent 的记忆                              |
| **skills**    | agent 的技能                              |

**chat 为什么是 differentiator（用户原话）**:

> "chat 是这个控制端最区别于原生 openclaw 的地方。其他配置可以直接通过
> openclaw 的 cli 或者直接修改 openclaw.json 来实现，但是 chat 不能。"

→ **含义**: 其他模块 deck-go 只是"做得更好用"（替代品存在），**chat 是
"做了原生 OpenClaw 没有的东西"** —— 不可替代的产品价值。

### 边缘模块（不在 Phase 5 主线）— 17 个

| 类别               | 模块                                           | 备注                                     |
| ------------------ | ---------------------------------------------- | ---------------------------------------- |
| 配置（CLI 可替代） | `config` `settings`                            | 走 OpenClaw CLI 或直接编辑 openclaw.json |
| 审批               | `approvals` `exec-approvals` `plugin-approval` | 不是 deck 独有价值                       |
| 运维节点           | `nodes` `cron` `webhooks` `routing`            | 偏部署/调度                              |
| 观察类             | `logs` `usage` `activity` `alerts` `budget`    | 监控向                                   |
| 工具/元            | `api-explorer` `docs` `identity` `gateway`     | 辅助                                     |
| 未明确分类         | `threads`                                      | 倾向 sessions 子概念，Phase 3 厘清       |

**原则**:

- 不是"永远不做"，是 Phase 5 优先级低于 9 个核心
- 如果某个边缘模块 block 核心模块（如 sessions 依赖 identity），按需带做
- 用户未明确"砍掉"任何模块 — 仅优先级排序

### Phase 4 vertical slice 候选 — chat 端到端

基于 chat 是核心 + `.local/` 显示 chat 已反复 remediation
（`chat-prototype-remediation-*`、`chat-sse-bridge-verification`、
`chat-remediation-real-e2e` 等），**Phase 4 强候选 = chat 端到端**:

```
用户在 deck-go 输入消息
  → deck-go BFF 接收（HTTP / SSE）
  → Gateway RPC（chat.send 或 deck.chat.*）
  → agent runtime 执行（含 model / skill / memory / plugin 调用）
  → 流式响应（SSE / WebSocket）回流
  → deck-go BFF 中继
  → frontend 渲染
```

**但这是个大 vertical slice**——锁死它就锁死了整个 deck-go 核心契约链。
Phase 3 决定:

- 直接挑 chat 端到端（高价值高难度）
- 还是先拆出更小子片段（如 sessions 列表 → 起新对话 → 收一条响应）

---

## Grill log（追踪对话进度）

### Phase 1 grill (2026-05-12)

| Q#  | Topic                                   | Status      | Resolution                                                           |
| --- | --------------------------------------- | ----------- | -------------------------------------------------------------------- |
| 1   | "openclaw" 在用户心里指什么             | ✅ Resolved | 整个 TS core；Gateway 是它的对外接口层                               |
| 2   | "避免大幅改动 openclaw" 的动机          | ✅ Resolved | A+C+D 叠加；产出 4 层扩展边界规则                                    |
| 3   | deck.\* 命名空间内允许的方法**类型**    | ✅ Resolved | 默认类型 1；类型 2/3 走协作 protocol，写进 Rule R1                   |
| 4   | "runtime 端" 的精确指代                 | ✅ Resolved | 狭义=内核 / 广义=含 Gateway；control 对象 = "一个 Gateway 对象"；R2  |
| 5   | bundled 进程管理是否算 control surface  | ✅ Resolved | B - 不算（**2026-05-13 修正**: 进运维 surface, 不进业务 surface）    |
| 6   | "全面控制" 模块清单的核心 / 边缘 / 缺失 | ✅ Resolved | 9 核心 + 17 边缘；chat 是 differentiator；Phase 4 候选 = chat 端到端 |

### Phase 3 grill (2026-05-13) — A3 收敛方案

| Q#  | Topic                                                                  | Status      | Resolution                                                                                                                                                   |
| --- | ---------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | bundled 模式的产品意图 — 是否仍然需要                                  | ✅ Resolved | "历史包袱" — Gateway 应通过官方 CLI 单独运维, 不该 spawn 子进程                                                                                              |
| 2   | 收敛切片节奏 — 一刀切 vs 渐进式 vs 暂缓                                | ✅ Resolved | A 高优先级, 立即开 OpenSpec change `gateway-launcher-rewrite`, β 渐进式 4 阶段                                                                               |
| 3   | 调试模式的 Gateway 启动机制 — 系统服务 vs detached spawn vs 文档化人工 | ✅ Resolved | C1 系统服务 (launchd/systemd/schtasks); + 保留 mode 二元概念, 砍 spawn 实现机制 (二次 reframe 见 A3)                                                         |
| 4   | local mode 下 deck-go 的运维责任档位                                   | ✅ Resolved | B 中等档 (life-cycle copilot) — 显示状态 + Start/Stop/Restart UI, 调官方 CLI; 不管升级 / token rotation                                                      |
| 5   | mode 是 boot-time 冻结还是运行时切换 / 切换持久化策略                  | ✅ Resolved | **运行时可切换** (三次 reframe); 默认 local; 切换持久化 (下次启动按上次连); 切到 remote 时本地 Gateway 保持运行                                              |
| 6   | OpenSpec change 拆分策略 — 大一统 vs 二分 vs 三分                      | ✅ Resolved | **β 二分** — change 1 `gateway-launcher-rewrite` (清理: 砍 spawn + 重命名 + R2 violation 修复), change 2 `runtime-mode-switching` (新增运行时切换); 串行交付 |
| 7   | "本地 Gateway" 的精确身份                                              | ✅ Resolved | = 本仓库 build 出来的 `dist/entry.js`, 不是用户全局装的 OpenClaw. deck-go + OpenClaw 同 source 同 root, 共同分发. 详见 A3 子节                               |
| 8   | 启动时本地 Gateway 各种状态的体验 + entrypoint 路径策略                | ✅ Resolved | 8.1 不做 wizard / 8.2 单击触发 install / 8.3 启动时+主动 probe / 8.4 轻量诊断不静默重试 / 8.5 相对路径+env 覆盖+install 时绝对路径 全部                      |
| 9   | E2E 体系 (mock + real) 在 change 1+2 完成后是否到位                    | ✅ Resolved | 覆盖大部分; 补 5 个 explicit gap 进 change 1 scope; 新增 **Rule R3** "Real E2E ≡ release + .env 差异"                                                        |

**Phase 1 status**: ✅ **Completed 2026-05-12**

Phase 1 产出汇总:

- 4 个 Core entities 定义（OpenClaw / Gateway / deck-go / runtime）
- 关系图 + control 对象 = "一个 Gateway 对象"的统一抽象
- 3 个 Flagged ambiguities（A1 ✅ / A2 留 Phase 2 / A3 留 Phase 3）
- 2 个 Design rules（R1 deck.\* RPC 协作 / R2 mode-agnostic + 前向兼容）
- 9 核心 + 17 边缘的 Module priorities
- Phase 4 vertical slice 强候选 = chat 端到端

下一步: Phase 2 — `prototype` 摸 chat 控制 surface area（A2 解决）。
