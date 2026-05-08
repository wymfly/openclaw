# Frontend Data Fabric — 实施代码审查报告

| 字段        | 值                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| Spec 基线   | `docs/superpowers/specs/2026-05-08-frontend-data-fabric-design.md`                                             |
| Spec commit | `a17d76d01c Define frontend server-state refresh architecture`                                                 |
| 审查范围    | `deck-go/frontend-new/src/data/**`（139 文件）+ 6 个 OpenSpec archive 提案 + `deck-ui/ui-store.tsx` 等关联改造 |
| 审查方式    | 静态阅读 + 全仓 grep + tasks.md/proposal.md 交叉对照                                                           |
| 审查日期    | 2026-05-08                                                                                                     |
| Reviewer    | Claude Opus 4.7                                                                                                |
| Implementer | Codex（基于 design spec 拆分 OpenSpec 6 提案后逐个实施）                                                       |
| 总体判定    | ✅ 高度契合 spec，工程纪律强；存在 1 个明确技术债务、3 个有意识的范围收敛、若干小裂缝                          |
| 总评        | **A-**                                                                                                         |

> **Codex 阅读须知**：本报告分两部分。"Findings" 章节按 7 个维度给出评分和事实；"待修复清单" 章节按优先级列出可执行项，每条都标注了 file:line、根因、修复成本和验收手段。请逐条 confirm 或 reject，并把修复纳入下一个 OpenSpec follow-up。

---

## 1. 与原始设计方案的契合度

### Findings

| Spec 决策                                          | 实施落地                                                                                                                                               | 契合度                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| **D1 单 QueryClient + scoped key**                 | `client/query-client.tsx` + `client/scoped-query-provider.tsx`，所有 `deckKeys` 以 `["deck-go", "runtime", runtimeId]` 开头                            | ✅                              |
| **D2 BFF + Gateway RPC 双 transport**              | `transport/bff.ts` + `transport/gateway-rpc.ts`，`DataFabricTransports` context 一次性注入                                                             | ✅                              |
| **D3 8 freshness tiers**                           | `contracts/freshness.ts` 8 tier 全表，所有 tier 都 `refetchOnMount: false`（"切换不刷"原则）                                                           | ✅                              |
| **D4 server-as-truth + base-hash 守卫**            | mutations 不做 `setQueryData`，只 `invalidateQueries`；`requireBaseHash` 在调用前 throw                                                                | ✅                              |
| **D5 mutation 默认 `retry:false`**                 | `mutationDefaults` + `controlledReadRetry`（最多 2 次，仅限 network/timeout/rate-limit/server 4 类）                                                   | ✅                              |
| **D6 渐进式迁移**                                  | foundation → agents-reference → config-inventory → live-workbench → chat-surroundings → governance-sweep 6 阶段                                        | ✅                              |
| **D7 错误协议**                                    | `DataFabricError` + 11 kind discriminated union + `normalizeDataFabricError` 保留 status / upstreamCode / baseHash / currentHash / requestId / traceId | ✅                              |
| **D8 Phase 1.0 锚点：DeckUIProvider 30s 轮询替换** | `SUMMARY_REFRESH_MS` 已全仓清零；改用 `useRuntimeSummaryLoader` + React 19 `useEffectEvent`                                                            | ✅                              |
| **Live invalidation 保守化**                       | 只处理 `runtime.gateway.*` + `projection.gap`；不依赖 `patchStrategy/patchKeys`                                                                        | ✅（与 spec deferred 列表一致） |

**有意识地"未实现"的项**（在 `frontend-new/CLAUDE.md` 与 `data/README.md` 显式列为 deferred，不算偏差）：

- mutation retry / offline mutation queue / IndexedDB persistence
- 自定义 oxlint 规则 → 改用 **runtime test-time 静态扫描 + 白名单**（实施改进，下文详谈）
- generated `patchStrategy / patchKeys` → 等契约扩展再说，目前用 invalidate-only

### 评分: **A+**（9/9 核心决策完整落地）

---

## 2. OpenSpec 提案拆分质量

### Findings

6 个提案严格分阶段：

```
2026-05-07 foundation         (Phase 0)  client/contracts/transport/errors/test-provider 骨架 + DeckUIProvider 替换
2026-05-08 agents-reference   (Phase 1)  最复杂模块跑通 module pattern（GW RPC + BFF + 配置写 + protected main + files + projection）
2026-05-07 config-inventory   (Phase 2)  10 模块 skills/models/channels/routing/nodes/settings/plugins/docs/memory/config
2026-05-07 live-workbench     (Phase 3)  11 模块 sessions/approvals/activity/gateway/usage/logs/alerts/budget/cron/threads/webhooks
2026-05-07 chat-surroundings  (Phase 4)  chat/commands + 复用已有 sessions/approvals 模块（不建并行 cache）
2026-05-07 governance-sweep   (Phase 5)  ApiExplorer/Identity/Subagents/useCapabilities + governance/exceptions registry
```

**亮点**：

- 每个 `proposal.md` 都明确列出 `Out Of Scope`，禁止范围漂移
- 每个 `design.md` 都做了 `Implementation Baseline Check`，重新引用契约真相（这是 spec 锁定后还能防止 agent 实施时偏离的关键纪律）
- agents 故意不在 foundation 里、foundation 故意不碰 agents — 一次提案塞太多决策的反模式被避免
- chat-surroundings 显式声明 **不把 stream bytes 移入 query cache**，只把"周边"server-state 收口（spec 决策的精确执行）

**轻微瑕疵**：

- 6 个提案都已 `archive/`，但 git log 只有 1 个 commit `a17d76d01c`（spec 本身）。**实施代码全部在 working tree 未 commit** — 这是必须修复项，详见 [F-3]。

### 评分: **A**

---

## 3. 核心骨架代码质量

### Findings

✅ **强项**：

- `contracts/freshness.ts:99` 用 `satisfies Record<DataFreshnessTier, DataFreshnessPolicy>` 保证 8 tier 表完整 + `getDataFreshnessPolicy` 每次返回拷贝（防止外部修改污染）
- `contracts/query-keys.ts:23-44` 的 `stableValue()` 递归排序对象 key — 解决 filters 序列化稳定性，是 cache hit 率的关键
- `errors/error-types.ts` 用 `kind` discriminated union + 6 个独立 metadata 字段，比 spec 草案的纯 errno 更精细
- `client/scoped-query-provider.tsx:43` 用 `[client] = useState(() => ...)` 保证 QueryClient 实例在 Strict Mode/HMR 下不重建
- `transport/gateway-rpc.ts` 用泛型 `GatewayRpcQuerySource<M extends GatewayMethodName>` 把生成的 `GatewayMethodMap` 接到 source — 类型安全扎实

⚠️ **可改进**（详见 [F-4][F-5]）：

- `contracts/query-keys.ts:14` 的 `DEFAULT_RUNTIME_ID = "rt_local"` 是 magic string fallback
- `transport/gateway-rpc.ts` 文档说"每次调用新建 client"，对 short-lived 场景是浪费
- `contracts/query-keys.ts:35` 的 `Object.keys(...).sort()` 默认字符串排序，对纯数字 key 反直觉（影响范围有限）

### 评分: **A-**

---

## 4. Reference Module 实现质量

### Findings

⚠️ **严重发现 — `agents/queries.ts` 与 `shared.ts` 抽象漂移**：

`grep -L "shared"` 显示 **26 个模块的 queries.ts 中有且仅有 1 个不 import `shared`：`agents/queries.ts`**。

agents 自己复刻了：

- `bffQueryOptions` / `gatewayRpcQueryOptions`（`agents/queries.ts:64-100`，与 `shared.ts:73-109` 行为一致）
- `freshnessDefaults` / `enabledAgent`（`agents/queries.ts:54-62` vs `shared.ts:52-60`）
- `AgentBaseHashRequiredError` 类（`agents/mutations.ts:23-30` vs `shared.ts:34-50` 的 `DataFabricBaseHashRequiredError`）

**根因**：agents 是 reference module（提案 2），早于 config-inventory（提案 3）落地；`shared.ts` 是后续模块复用 agents 模式时被抽象出来的，但 agents 自己**没有回填到 shared**。

**影响**：

- 风险低（行为一致），但维护性扣分：未来改 freshness 默认值或错误类型，要改两处
- agents 错误码是 `agents.baseHashRequired`，shared 是 `${action}.baseHashRequired`（如 `agents.skills.save.baseHashRequired`） — **错误码格式分裂**
- 违反 spec D1 的"single source of truth"精神

**修复成本**：1-2 小时，纯机械替换。详见 [F-1]。

✅ **其他模块一致性 — 优秀**：

- 25/26 模块 100% 走 `shared.ts` 的 `bffQueryOptions / gatewayRpcQueryOptions / mutationDefaults`
- 命名规范严格：`<module>Keys` / `<source>QueryOptions` / `use<Thing>Query` / `use<Action>Mutation` / `apply<Projection>Invalidation` / `is<RunScoped*>`
- 文件结构 100% 一致：`keys.ts + queries.ts (+ mutations.ts? + projections.ts?) + index.ts`

### 评分: **B+**（agents 漂移）/ **A**（其他 25 模块）

---

## 5. 测试覆盖与质量

### Findings

**14 个测试文件**布局合理：

```
data/
├── client/query-client.test.ts                     # provider 隔离
├── contracts/{freshness,query-keys}.test.ts        # 契约稳定性
├── governance/exceptions.test.ts                   # 静态扫描白名单
├── live-invalidation.test.ts                       # 核心失效逻辑
├── queries/runtime.test.tsx                        # bootstrap/gateway hook
└── modules/
    ├── agents/{keys,queries,mutations,projections}.test.{ts,tsx}  # 4 文件深度覆盖 reference
    ├── chat-surroundings.test.tsx                  # 跨模块集成
    ├── config-inventory.test.tsx
    ├── governance-sweep.test.tsx
    └── live-workbench.test.tsx
```

✅ **亮点**：

- **集成测试方法学上乘**：每个跨模块 test 不只 mock + 断言 staleTime，还做真实的 `queryClient.fetchQuery` 后断言 `apiMocks.fetch*.toHaveBeenCalledWith(...)` — 真测了 transport 链路
- `live-workbench.test.tsx:256-269` 测了"refetch 失败时保留 cached data" — **spec D4 "server-as-truth + 旧值不消失"协议的精确验收**
- `governance-sweep.test.tsx:159-218` 对 identity/subagents 的 mutation 测了 base-hash 透传 + invalidation 触发，组合验收
- `live-workbench.test.tsx:333-343` 测 `isRunScoped*` fixture-safety helper — **真 E2E 写测试的安全边界**用单测固化
- 测试 freshness tier 映射时直接断言 `===` `dataFreshnessPolicies["live-workbench"].staleTime`，不会因常量改值漂移

⚠️ **轻微缺陷**：

- 单模块的 `keys.ts/queries.ts/mutations.ts/projections.ts` 没有都各自配套独立单测；只有 agents 是 reference 身份独享 4 个独立测试。其他 25 模块的覆盖被合并到 4 个跨模块集成测试 — 取舍合理但单点失败时定位粒度变粗
- 集成测试用 raw `createRoot` + `act` 而非 `@testing-library/react`，可读性偏低（但对 hook 行为验证够用）

### 评分: **A**

---

## 6. Governance 治理方案

### Findings

✅ **比原 spec 的 oxlint 方案更聪明**

原 spec 计划写 oxlint 规则；实际采用 `governance/exceptions.ts` + `governance/exceptions.test.ts` 的"runtime 静态扫描 + 白名单"。

**`exceptions.test.ts` 实际做了什么**：

1. 自定义 `walk()` 递归扫 `src/{components,hooks,stores}/**/*.{ts,tsx}`（排除 test 文件）
2. 用 4 个正则匹配 4 类违规模式：
   - `import { fetch* } from "@/api"` → `raw-api-fetch-import`
   - `import { fetch* } from "./chat-api"` → `chat-adapter-fetch-import`（chat 限定）
   - `deckFetch(...)` 调用 → `raw-deck-fetch-call`
   - stores/ 下 `fetch/load/refresh<Name>:` 方法定义 → `store-server-lifecycle-method`
3. 把所有 finding 与 `dataFabricGovernanceExceptions` 白名单比对，多余的让 `expect([]).toEqual([])` 失败

**为什么比 oxlint 更好**：

- ✅ **零配置依赖**：无需 oxlint 自定义插件，CI 直接跑 vitest 就能拦
- ✅ **白名单显式**：每条豁免有 `owner / reason / followUpStatus`（reason 长度 >40 字符强制，防止"because"敷衍）
- ✅ **精确到模式**：分 4 种违规模式，可以"agents 不可用 deckFetch 但 chat-api 内部可以用 fetchSnapshot"这种细粒度
- ✅ **实测有效**：`grep` 全仓只剩一条违规 `chat/slash-command-executor.ts:1` 的 `fetchAgentsList` import，且这条**已在白名单**

⚠️ **唯一的小裂缝**（详见 [F-6]）：

- `slash-command-executor.ts` 的 import 行被白名单为 `raw-api-fetch-import`，但 line 358 的 `await fetchAgentsList()` **直接调用本身没单独被 `raw-deck-fetch-call` 模式捕获**（因为不是 `deckFetch`），所以即便没白名单也不会被扫到
- 该模式覆盖面有限于 `deckFetch` 字面，未覆盖任意 `fetch*()` 直接调用
- 边缘情况会让违规漏网，但 panel 代码很难绕开 import 白名单，整体仍受控

### 评分: **A+**

---

## 7. 偏差、风险与亮点汇总

### 与早期 Claude spec 草案的偏差（实际由 Codex spec 锁定为正式决策，**不是缺陷**）

1. **8 tier 而非 7 tier**：增加了 `lazy-detail` 与 `stream-driven` 拆分 — 实施严格按 8 tier，所有 tier 都有真实模块映射
2. **没有 `useScopedQuery / useScopedMutation / useProjection` hook**：直接用 `useQuery / useMutation`，scope 通过 `DeckQueryScope` 参数传入，scoped key 在 `scopedRuntimeKey()` 一处统一加 `["deck-go", "runtime", runtimeId]` 前缀 — 比 spec 草案更轻量
3. **Live-invalidation 保守**：只支持 `runtime.gateway.*` + `projection.gap`，不做 per-event reducer pipeline — **与 spec deferred 列表一致**

### 重要亮点

- ✨ `DataFabricBaseHashRequiredError` 在 `mutationFn` 内 throw 而非提前 return — TanStack Query 的 `onError` 路径会接住，UI 拿到的是 typed error 而不是"成功但服务器拒绝"
- ✨ `live-workbench.test.tsx:333` 的 `isRunScoped*` fixture-safety 单测 — 把 spec "real E2E 必须 run-scoped" 这条规则用 unit test 锁死
- ✨ `DeckUIProvider` 用 React 19 `useEffectEvent` 包裹 loader/clear/apply — 解决了原 spec 没考虑的 stale-closure 问题
- ✨ chat 模块严格遵守"stream bytes 不进 cache" — `chat/queries.ts` 只 38 行，只做 snapshot；`chat-dispatchers / useChatSSE` 在白名单，**spec 决策被显式守护**
- ✨ 每个 OpenSpec 提案的 `Implementation Baseline Check` 都重新读契约源 — 用工程纪律根除"agent 不读契约就动手"

---

# 待修复清单

每条都给出 finding ID、优先级、根因、修复手段、验收方法。Codex 请逐条 confirm 或 reject。

## P0（必修，下一个 follow-up 提案优先做）

### [F-1] agents 模块抽象漂移

| 字段     | 内容                                                                                                                                                                                                                                                                                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **位置** | `deck-go/frontend-new/src/data/modules/agents/queries.ts:54-100`、`deck-go/frontend-new/src/data/modules/agents/mutations.ts:23-39`                                                                                                                                                                                                                                        |
| **问题** | agents 是 26 个模块中**唯一**没有 import `../shared` 的 queries.ts；`bffQueryOptions / gatewayRpcQueryOptions / freshnessDefaults / enabledAgent / AgentBaseHashRequiredError` 与 `shared.ts` 重复实现；错误码格式 `agents.baseHashRequired` 与 shared 的 `${action}.baseHashRequired` 不一致                                                                              |
| **根因** | agents 是 reference module（提案 2），shared.ts 是 config-inventory（提案 3）抽象出来的，agents 没有回填                                                                                                                                                                                                                                                                   |
| **修复** | 1) `agents/queries.ts` 删除本地 `bffQueryOptions / gatewayRpcQueryOptions / freshnessDefaults / enabledAgent`，改 import `from "../shared"`；2) `agents/mutations.ts` 删除 `AgentBaseHashRequiredError`，改用 `shared.ts` 的 `DataFabricBaseHashRequiredError + requireBaseHash`；3) 检查 agents 单测是否断言 `agents.baseHashRequired` 错误码字符串，统一改为 shared 格式 |
| **验收** | a) `grep -c "import.*shared" src/data/modules/*/queries.ts` 应显示 26 个模块都为 `1`；b) `agents/{queries,mutations}.test.tsx` 全绿；c) `live-workbench.test.tsx` 等跨模块集成测试不受影响                                                                                                                                                                                 |
| **成本** | 1-2 小时，纯机械替换                                                                                                                                                                                                                                                                                                                                                       |

### [F-2] Codex 实施代码尚未 commit

| 字段     | 内容                                                                                                                                                                                                       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **位置** | 整个 `deck-go/frontend-new/src/data/**` + `deck-ui/ui-store.tsx` 改造 + 6 个 OpenSpec archive 提案                                                                                                         |
| **问题** | `git log --oneline` 只有 1 个相关 commit `a17d76d01c Define frontend server-state refresh architecture`（spec 自身）；6 个 archived 提案 + 26 个模块 + 14 测试文件全部在 working tree 未提交               |
| **风险** | 1) 任何意外 reset 都会丢工作量；2) `pnpm install` / 切分支等操作可能引入冲突；3) 无法做 PR review；4) `enhanced` 分支的 rebase 流程也需要这部分入库                                                        |
| **修复** | 按 6 个 OpenSpec 提案分 commit 提交：foundation / agents-reference / config-inventory / live-workbench / chat-surroundings / governance-sweep。建议每个 commit 前缀 `[enhanced]` 或对应 OpenSpec change id |
| **验收** | `git status` 工作区干净；`git log` 看到至少 6 个连续 commit；每个 commit 都包含对应提案的 `archive/` 元数据 + 实施文件 + 测试                                                                              |
| **成本** | 30-60 分钟（含分组 staging + commit message 撰写）                                                                                                                                                         |

## P1（建议在下一个 follow-up 提案处理）

### [F-3] `DEFAULT_RUNTIME_ID = "rt_local"` magic string fallback

| 字段     | 内容                                                                                                                                                                                                                                                                                                                                                           |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **位置** | `deck-go/frontend-new/src/data/contracts/query-keys.ts:14`                                                                                                                                                                                                                                                                                                     |
| **问题** | 硬编码 `"rt_local"` 作为 fallback runtime id；如果未来 runtime id 命名规则改变（比如 `"rt_default"` 或带前缀），cache key 会 silently 错位且 TS 不报错                                                                                                                                                                                                         |
| **修复** | 1) 检查 `deck-go/contracts/source/deck-api.contract.ts` 与生成代码是否已有 `DEFAULT_RUNTIME_ID` 常量 — 若有，import 它；2) 若没有，把 `"rt_local"` 提升为 contract 字段（在 `deck-api.contract.ts` 加 `DefaultRuntimeId` 常量），重新生成；3) 或退一步：在该文件加 `// CONTRACT: must match deck-api.contract.ts DEFAULT_RUNTIME_ID` 注释 + 加单测断言两侧一致 |
| **验收** | `query-keys.test.ts` 增加一条 "DEFAULT_RUNTIME_ID matches contract source" 断言                                                                                                                                                                                                                                                                                |
| **成本** | 30 分钟（如果走注释 + 测试方案）                                                                                                                                                                                                                                                                                                                               |

### [F-4] Gateway RPC client 每次调用新建

| 字段     | 内容                                                                                                                                                        |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **位置** | `deck-go/frontend-new/src/data/transport/gateway-rpc.ts`（约 42 行的 `createGatewayRpcTransport()`）                                                        |
| **问题** | 文档说"每次调用新建 client"。对短生命周期 transport 是浪费 — TanStack Query 的 prefetch、refetch、`useQueries` 多并发都会触发反复构建                       |
| **修复** | 在 `scoped-query-provider.tsx:24-27` 的 `defaultTransports` 工厂里 memo 一次 client 实例；或在 `createGatewayRpcTransport()` 内做 lazy + cache by runtimeId |
| **验收** | 加一条单测：连续调用 transport 10 次，underlying client 构造函数只被调用一次（用 `vi.spyOn` 监测）                                                          |
| **成本** | 30 分钟                                                                                                                                                     |

### [F-5] governance 静态扫描覆盖盲区

| 字段     | 内容                                                                                                                                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **位置** | `deck-go/frontend-new/src/data/governance/exceptions.test.ts:67-75`（`deckFetchPattern` 仅匹配 `\bdeckFetch\s*\(`）                                                                                                                                     |
| **问题** | 4 类违规模式中，`raw-deck-fetch-call` 仅捕获 `deckFetch(...)` 字面；任意 `fetch*()` 直接调用（如 `fetchAgentsList()`）不会被 call-site 模式捕获，只能依赖 `import` 模式拦截。已知边缘案例：`slash-command-executor.ts:358` 的 `await fetchAgentsList()` |
| **修复** | 在 `collectFindings` 加第 5 个模式：`/\bfetch[A-Z]\w*\s*\(/g` 标记为 `raw-fetch-helper-call`；遇到 import 已经被白名单的文件，可以接受 call-site 也豁免（白名单格式扩展为 `<file>:<pattern>`，已经支持）                                                |
| **验收** | 当前白名单 5 条都应仍然通过；故意在 `panels/agents/AgentsPanel.tsx` 加一条 `fetchAgentsList()` 直接调用（无 import）应让测试失败                                                                                                                        |
| **成本** | 1 小时（含写反例验证）                                                                                                                                                                                                                                  |

## P2（可选清理，不阻塞 follow-up 提案落地）

### [F-6] `Object.keys(...).sort()` 数字 key 排序

| 字段     | 内容                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------- |
| **位置** | `deck-go/frontend-new/src/data/contracts/query-keys.ts:35`                                        |
| **问题** | JS 默认字符串排序，纯数字 key 反直觉（`"10"` < `"2"`）。当前 filters 几乎都是字符串字段，影响有限 |
| **修复** | 仅当未来发现 cache key 不稳定时再处理；或保守起见加 `(a, b) => a.localeCompare(b)`                |
| **验收** | `query-keys.test.ts` 加一条针对数字 key 的断言                                                    |
| **成本** | 15 分钟                                                                                           |

### [F-7] 25 个非 reference 模块缺独立单测

| 字段     | 内容                                                                                                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **位置** | `deck-go/frontend-new/src/data/modules/{config,channels,routing,nodes,...}/`（除 agents 外都没有 `keys.test.ts / queries.test.tsx` 等独立单测）                               |
| **问题** | 覆盖被合并到 4 个跨模块集成测试。集成测试覆盖了关键路径，但单点失败时定位粒度变粗（要在 `live-workbench.test.tsx` 850 行里找）                                                |
| **修复** | 不强求；如要补，建议每个模块至少加 `keys.test.ts`（key 稳定性）+ `mutations.test.tsx`（如有 mutations）。或保留现状，把跨模块集成测试拆成 by-module describe block 提升可读性 |
| **验收** | 跨模块集成测试不变；新加的 per-module 测试与集成测试断言无重叠或最小重叠                                                                                                      |
| **成本** | 每模块 1-2 小时，可分批                                                                                                                                                       |

### [F-8] 集成测试可读性

| 字段     | 内容                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **位置** | `live-workbench.test.tsx / chat-surroundings.test.tsx / config-inventory.test.tsx / governance-sweep.test.tsx`                       |
| **问题** | 用 raw `createRoot + act` 而非 `@testing-library/react`，setup boilerplate 较多（`MutationProbe / renderMutationProbe`），可读性偏低 |
| **修复** | 引入 `@testing-library/react` 的 `renderHook`，把 mutation handle 提取改为 `result.current` 模式。或保持现状（行为正确，只是风格）   |
| **验收** | 测试断言数量与覆盖不变                                                                                                               |
| **成本** | 4-6 小时（需要熟悉两种 API 的等价转换）                                                                                              |

---

## 验收建议

修复 [F-1][F-2] 后即可视为"实施代码 production-ready"。其余 P1/P2 可作为 backlog，分提案推进。

建议下一个 OpenSpec follow-up 提案命名：
`2026-05-XX-deck-go-data-fabric-foundation-cleanup`，scope 限定为 [F-1][F-3][F-4][F-5]，把 [F-2] 作为该提案 G3 阶段的 commit 动作完成。

---

# Codex 交叉审查与修复记录

| 字段     | 值                                                                                                                      |
| -------- | ----------------------------------------------------------------------------------------------------------------------- |
| 审查日期 | 2026-05-08                                                                                                              |
| 审查方式 | 逐条对照代码真相 + 聚焦修复 + 聚焦测试                                                                                  |
| 结论     | 接受并修复 F-1 / F-5；接受并部分收敛 F-3；接受 F-2 事实但未在本轮提交；拒绝直接实施 F-4；F-6/F-7/F-8 作为非阻塞 backlog |

## 逐条结论

### F-1 agents 模块抽象漂移 — accepted / fixed

确认成立。`agents/queries.ts` 确实保留了本地
`bffQueryOptions` / `gatewayRpcQueryOptions` / `freshnessDefaults` /
`enabledAgent`，`agents/mutations.ts` 也保留了本地
`AgentBaseHashRequiredError` 与 `mutationDefaults`。

已修复：

- `agents/queries.ts` 改为复用 `../shared` 的 `bffQueryOptions`、
  `gatewayRpcQueryOptions`、`bffSource`、`gatewayRpcSource`、
  `enabledNonEmpty` 和 `ModuleQueryOptions`。
- `agents/mutations.ts` 改为复用 `../shared` 的 `mutationDefaults` 与
  `requireBaseHash`。
- `agents/mutations.test.tsx` 改为断言
  `DataFabricBaseHashRequiredError`。

验证：

- `cd deck-go/frontend-new && npm run test:deck-ui -- src/data/modules/agents/queries.test.tsx src/data/modules/agents/mutations.test.tsx src/data/contracts/query-keys.test.ts src/lib/gateway-client.test.ts src/data/governance/exceptions.test.ts`
- 结果：5 files passed, 15 tests passed。
- `cd deck-go/frontend-new && npx tsc -b --pretty false`
- 结果：通过。
- `cd deck-go/frontend-new && rg --files src/data/modules | rg '/queries\.ts$' | wc -l`
  与 `rg -l 'from "\.\./shared"' src/data/modules/*/queries.ts | wc -l`
  均为 26。

### F-2 实施代码尚未 commit — accepted / not fixed in this pass

确认成立：当前仍有大量 unstaged / untracked Data Fabric 实施文件和
OpenSpec archive/spec 文件。另有一个本地 commit
`a17d76d01c Define frontend server-state refresh architecture` 只提交了设计文档。

本轮未直接提交，原因是当前 worktree 同时包含大量非 Data Fabric / 非 deck-go
改动，例如 `extensions/wecom/**`、`deploy/STATUS.md` 等。直接提交会混入不明来源
变更，违反本仓库的多 agent 安全规则。后续应按 scope 分组提交，至少把 Data Fabric
矩阵和 OpenSpec archive/spec 作为独立提交组处理。

### F-3 `DEFAULT_RUNTIME_ID = "rt_local"` magic string — accepted / partially fixed

确认部分成立：前端至少在 Data Fabric query key 和 Gateway client 中重复使用
`"rt_local"`。代码真相中 Go 后端权威常量位于
`deck-go/backend/internal/runtime/runtimeid/default.go`，但当前 Deck-facing contract
没有生成 TS runtime id 常量。

已收敛：

- 新增 `frontend-new/src/lib/runtime-id.ts`，导出
  `DEFAULT_RUNTIME_ID = "rt_local"`，并标注其镜像后端 Go 常量。
- `data/contracts/query-keys.ts` 和 `lib/gateway-client.ts` 改为复用该常量。
- `query-keys.test.ts` 改为断言公共常量而不是重复字符串。

剩余：若要完全消除镜像关系，后续需要把默认 runtime id 纳入契约生成链。

### F-4 Gateway RPC client 每次调用新建 — rejected for direct fix / needs redesign

没有直接采纳。报告指出的构造浪费存在，但当前
`createDeckGatewayClient()` / `createDeckGatewayTransport()` 的构造同时捕获
`requestId`。若简单在 Data Fabric transport 层缓存 client，会导致多次 Gateway RPC
复用同一个 `X-Request-Id`，削弱 tracing 语义。

可接受的后续方案应先拆开两个职责：

- client / method table 可以缓存；
- `requestId` 应在每次 request 生成，除非调用者显式传入固定 `requestId`。

因此 F-4 不是机械修复项，建议单独小提案或随 Gateway client transport cleanup 处理。

### F-5 governance 静态扫描覆盖盲区 — accepted / fixed

确认成立。旧测试可拦截 `fetch*` import，但不直接拦截 call-site；例如
`slash-command-executor.ts` 中的 `fetchAgentsList()` 依赖 import 白名单间接覆盖。

已修复：

- `exceptions.test.ts` 新增 `raw-fetch-helper-call` 扫描模式。
- 排除 `queryClient.fetchQuery()` 等 Data Fabric method-call 误报，仅捕获独立
  `fetch*()` helper 调用。
- `exceptions.ts` 为 Chat adapter / SSE / command / history seam 增加明确的
  `raw-fetch-helper-call` exception。
- `src/data/README.md` 更新治理规则，明确 direct `fetch*()` helper calls 也属于
  默认禁止项。

验证同 F-1 聚焦测试，治理测试已通过。

### F-6 数字 key 排序 — deferred

确认是低风险边界问题。当前 Data Fabric filters 以字符串字段为主，且默认 JS key
排序本身是确定性的；它不会造成跨 render cache key 不稳定。本轮不处理。

### F-7 非 reference 模块缺独立单测 — deferred

确认是测试粒度权衡，不是当前 blocker。跨模块集成测试已经覆盖关键 query/mutation
路径。后续如果某类模块开始频繁失败，再拆 per-module tests 更合适。

### F-8 集成测试可读性 — deferred

确认是维护性建议，不影响当前行为。当前 raw `createRoot + act` 可读性一般，但测试
行为稳定；迁移到 `renderHook` 不应混入这次治理修复。
