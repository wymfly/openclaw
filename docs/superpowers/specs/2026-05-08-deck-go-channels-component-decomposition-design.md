# deck-go channels 模块组件拆分（子项目 #1）

| 字段                | 值                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| 设计日期            | 2026-05-08                                                                                      |
| 修订状态            | v2 after Codex cross-review                                                                     |
| 子项目编号          | #1 of 5（channels 全档对齐 program 的第一个子项目）                                             |
| 主目标路径          | `deck-go/frontend-new/src/components/panels/channels/`                                          |
| Brainstorming skill | `superpowers:brainstorming`                                                                     |
| 外部审查记录        | `docs/superpowers/specs/2026-05-08-deck-go-channels-component-decomposition-review-response.md` |
| 后续                | 创建 OpenSpec change；必要时再用 `writing-plans` 细化实施步骤                                   |

## 1. 摘要

把 `deck-go/frontend-new/src/components/panels/channels/ChannelsPanel.tsx` 从当前 1492 行 mega-panel，按 **channels v2 handoff skeleton + 当前 production 自然边界**拆成可维护的 `views/` + `tabs/` + `parts/` + `dialogs/` + `lib/`。

本子项目是**纯组件分解**：

- 不新增渠道能力。
- 不改 Gateway RPC、Deck BFF routes、contracts/source、Data Fabric query key 或 mutation shape。
- 不改产品视觉目标；只保持当前 production 行为和现有 mock visual smoke 覆盖。
- 不实现 create-channel wizard；当前契约没有 first-class create-channel endpoint。
- 不把 legacy dashboard 组件名当作结构权威；dashboard 仅作为历史参考。

## 2. 动机与非目标

### 动机

- **维护性**：`ChannelsPanel.tsx` 当前 1492 行，包含数据拉取、派生 selector、list/detail 渲染、tab body、routing query、dialogs 等多种职责。单文件问题是 maintainability concern，不是既有 protocol violation；本子项目专门把它转成可审查边界。
- **解锁后续子项目**：#2 WeCom 多 page 化、#3 per-channel UI registry、#4 onboarding wizard、#5 throughput analytics 都需要 list/detail/tabs/dialogs 有稳定局部边界。
- **测试可聚焦**：把纯 selector 和纯展示组件拆出后，可以用 fixture-based 组件测试覆盖空态、筛选态、diagnostic、throughput、probe、routing、dialog 等场景，避免每次都通过完整 panel 触发。

### 非目标（本子项目显式不做）

- 不增任何 Gateway/Deck 能力：probe、logout、settings patch、WeCom access、routing 行为保持当前语义。
- 不改 `deck-go/contracts/source/**`、`deck-go/contracts/generated/**`、`deck-go/backend/**`、`deck-go/frontend-new/src/api.ts`。
- 不动 Data Fabric `channelsListQueryOptions` / `channelThroughputQueryOptions` / `useTestChannelMutation` / `useLogoutChannelMutation` / `usePatchChannelConfigMutation` / `routingBindingsQueryOptions` 的接口和 key 语义。
- 不改现有 smart 专用组件的外部接口：`ChannelSettingsEditor.tsx`、`AccountDmPolicyEditor.tsx`、`WecomAccessControls.tsx`、`WecomRoutingSummary.tsx`。
- 不把 `RetryStrategyEditor` / `AllowFromEditor` 新建为通用 top-level parts。当前 retry、dmPolicy、json patch 在 `ChannelSettingsEditor` 内一体化；allowFrom 是 `WecomAccessControls` 内部 WeCom-specific 子功能。
- 不实现 `CreateChannelDialog`。生产当前只保留 disabled `New channel` affordance 和 unavailable copy。
- 不升级 `frontend-handoff/modules/channels/` reverse sign-off；当前 `needs-revision` / `unreviewed` 状态保持不变。
- 不引入新 design-system atom / pattern。所有新增组件先保持 module-local；是否提升为 shared pattern 留到 #3 或 design-system follow-up。
- 不替换当前 confirm/dialog 模式为新的全局 modal 体系。
- 不引入 mutation retry、offline replay、IndexedDB persistence。
- 不新增 Playwright `toHaveScreenshot()` baseline 基础设施。

## 3. 子项目矩阵（program 全景）

本设计是 5 子项目 program 中的 **#1**：

| #      | 子项目                                | 状态          | 推荐顺序                         |
| ------ | ------------------------------------- | ------------- | -------------------------------- |
| **#1** | **组件拆分**                          | **本设计 v2** | 1                                |
| #2     | WeCom 多 page 化                      | pending       | 2（依赖 #1 的 detail/tabs 边界） |
| #3     | per-channel UI registry               | pending       | 3（依赖 #1，决定 #4 schema）     |
| #4     | 接入向导 / ConfigWizard / WeComWizard | pending       | 4（依赖 #3；需要重新校准契约）   |
| #5     | 真实 throughput / analytics           | pending       | 可独立排期（偏后端/契约）        |

每个子项目独立走 OpenSpec change 闭环。Program-level closure 按根 `AGENTS.md` "多 OpenSpec change / program matrix" 规则收尾。

## 4. 事实基线

### 4.1 结构权威

`deck-go/AGENTS.md` 明确：不要默认复制 legacy `dashboard/` implementation details。`dashboard/src/components/panels/channels/` 可作为历史参考，但不是 deck-go 文件结构或命名权威。

本子项目的结构权威按优先级为：

1. 当前 `deck-go/frontend-new/src/components/panels/channels/` production 代码真相。
2. `deck-go/frontend-handoff/modules/channels/components.md` 的 v2 production skeleton。
3. `deck-go/frontend-handoff/modules/channels/implementation-notes.md` 的 contract calibration 和 accepted divergences。
4. legacy `dashboard/src/components/panels/channels/`，仅用于理解旧产品语义，不用于直接复制文件名。

### 4.2 当前 frontend-new 代码真相

`deck-go/frontend-new/src/components/panels/channels/` 当前 6 个 `.tsx`：

- `ChannelsPanel.tsx`：1492 行，包含 list + detail + tabs + routing query + dialogs + selector helpers。
- `ChannelsPanel.test.tsx`：当前 10 个 `it(...)` panel 行为场景；历史 "64 tests passed" 是 `api.chat-helpers.test.ts` + `ChannelsPanel.test.tsx` 合计，不是单文件 case 数。
- `ChannelSettingsEditor.tsx`：smart component，内部调用 `usePatchChannelConfigMutation`，维护 retry/dmPolicy/jsonPatch draft。
- `AccountDmPolicyEditor.tsx`：smart component，内部调用 `usePatchChannelConfigMutation`，维护 account DM policy draft。
- `WecomAccessControls.tsx`：smart component，内部调用 `useConfigSnapshotQuery` / `usePatchDeckConfigMutation`，维护 WeCom access state；内部有 WeCom-specific `AllowFromEditor`。
- `WecomRoutingSummary.tsx`：WeCom access 相关展示组件。

当前 `ChannelsPanel.tsx` 中已经存在的自然拆分点：

- pure-ish selector/helper：`asRecord`、`stringValue`、`booleanValue`、`numberValue`、`accountDiagnostic`、`normalizeChannelAccounts`、`countAlertingAccounts`、`channelMatchesFilter`、`hasWecomChannel`、`readThroughputSummary` 等。
- local parts：`ChannelGlyph`、`MetricTile`、`ChannelProbeResultBadge`、`ChannelThroughputChart`。
- smart inline island：`ChannelRoutingPanel` 当前内部调用 Data Fabric/query/navigation hooks。
- view renderers：`renderList`、`renderOverview`、`renderProbe`、`renderSettings`、`renderTab`、`renderDetail`。
- inline dialogs：test-result dialog 和 logout confirmation dialog。

### 4.3 契约和路由真相

Channels 相关 Deck-facing DTO authority 在 `deck-go/contracts/source/deck-api.contract.ts`：

- `DeckGoChannelsStatusResponse`
- `DeckGoChannelUiMeta`
- `DeckGoChannelTestResponse`
- `DeckGoChannelLogoutResponse`
- `DeckGoChannelThroughputResponse`
- `DeckGoRoutingListResponse`
- `DeckGoRoutingBinding`
- `DeckGoConfigSnapshotResponse`
- `DeckGoConfigApplyResponse`

真实 frontend wrapper / BFF routes：

| Workflow        | Frontend wrapper                               | BFF route / behavior                                                         |
| --------------- | ---------------------------------------------- | ---------------------------------------------------------------------------- |
| inventory       | `fetchChannels()`                              | `GET /channels`                                                              |
| probe           | `testChannel(channelId)`                       | `POST /channels/{channelId}/test`                                            |
| logout          | `logoutChannel(channelId)`                     | `POST /channels/{channelId}/logout`                                          |
| throughput      | `fetchChannelThroughput(channelId, window)`    | `GET /channels/{channelId}/throughput?window=`                               |
| channel patch   | `patchChannelConfig(channelId, patch)`         | `PATCH /channels/{channelId}`; backend derives baseHash through `config.get` |
| config snapshot | `fetchDeckConfig()`                            | `GET /config`                                                                |
| config patch    | `patchDeckConfig(patch, baseHash?)`            | `POST /config/patch`                                                         |
| routing         | `fetchRoutingBindings({ channel, accountId })` | `GET /deck/routing?...`                                                      |

`channels.config.patch` 的 config-write-safety contract 是 `baseHashMode: backend-derived`，不是 client-required。前端 `patchChannelConfig` 不传 baseHash；冲突或 upstream error 只按现有 error-preserved 行为展示。

### 4.4 Visual / E2E 真相

当前 `deck-go/test/e2e/channels-visual.spec.ts` 是 mock visual smoke，产出 7 张 screenshot artifact：

- `channels-list-ready.png`
- `channels-discord-detail.png`
- `channels-probe-state.png`
- `channels-settings-state.png`
- `channels-routing-state.png`
- `channels-wecom-access-state.png`
- `channels-light-zh.png`

该 spec 当前使用 `page.screenshot()` 记录 artifact，不使用 `toHaveScreenshot()`，所以不能宣称 pixel-level baseline diff 或 diff=0。

当前 `deck-go/test/e2e/channels-real-gateway.spec.ts` 有 2 个 real Gateway 场景，支持 safe read/UI smoke。probe/logout/config mutation 等需要 disposable provider/config state，当前保持 skipped-safe/deferred。

## 5. 设计决策清单

| #   | 维度                      | 决策                                                                                                                                                                    |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 命名权威                  | 以 `frontend-handoff/modules/channels/components.md` v2 skeleton + 当前 production 自然边界为准，不以 dashboard 6 文件名为主锚点                                        |
| 2   | 拆分范围                  | `ChannelsPanel.tsx` 拆为 orchestrator + `views/` + `tabs/` + `parts/` + `dialogs/` + `lib/`                                                                             |
| 3   | 新组件数据边界            | 新抽出的 views/tabs/parts/dialogs 默认不 import `@tanstack/react-query`、`data/modules/*`、`api.ts`、Gateway client、或 `useDeckUI`；数据和导航回调由 orchestrator 传入 |
| 4   | 既有 smart 组件例外       | `ChannelSettingsEditor` / `AccountDmPolicyEditor` / `WecomAccessControls` 保留当前 smart 行为和接口，不在 #1 中重构                                                     |
| 5   | Routing smart island 处理 | 当前 inline `ChannelRoutingPanel` 应拆为 pure `TabRouting`；routing query/state 和 `navigateToRouting` 回调上提到 `ChannelsPanel`                                       |
| 6   | Create channel            | 不抽 `CreateChannelDialog`；当前生产只保留 disabled `New channel` affordance                                                                                            |
| 7   | DS 归属                   | 全部 module-local；不新增或提升 shared atom/pattern                                                                                                                     |
| 8   | 派生逻辑                  | `normalizeChannelAccounts` / `accountDiagnostic` / filter/count/read helpers 抽到 `lib/normalize.ts` 或 `lib/channel-selectors.ts`                                      |
| 9   | 状态管理                  | top-level list/detail/tab/action/routing/throughput state 由 orchestrator 管；既有 smart 组件自己的 draft state 保持不动                                                |
| 10  | 错误约定                  | channels.config.patch 按 backend-derived baseHash + upstream-error-preserved；前端不引入 `DataFabricBaseHashRequiredError` 语义                                         |
| 11  | 视觉                      | 不做视觉 redesign；mock visual smoke 需继续通过并产出 7 张 artifact                                                                                                     |
| 12  | 验收档位                  | 中等：现有 panel 语义不退化 + 新纯组件有 focused tests + build + mock visual smoke                                                                                      |

## 6. 目标物理结构

```
panels/channels/
├── ChannelsPanel.tsx                  # orchestrator：query/mutation/state/callback wiring
├── ChannelsPanel.test.tsx             # 保留现有 panel 集成语义；selector 可更新，语义不可减少
├── channels-panel.css                 # panel-level 样式，按需要仅做 class 搬迁
├── types.ts                           # ChannelInventoryItem / ChannelTabId / PanelState / ThroughputWindow 等
├── lib/
│   ├── channel-selectors.ts           # normalize/filter/count/read helpers
│   └── channel-selectors.test.ts
├── views/
│   ├── ChannelsListView.tsx
│   ├── ChannelsListView.test.tsx
│   ├── ChannelsDetailView.tsx
│   └── ChannelsDetailView.test.tsx
├── tabs/
│   ├── TabOverview.tsx
│   ├── TabThroughput.tsx
│   ├── TabProbe.tsx
│   ├── TabSettings.tsx                # 组合现有 smart settings/account policy components
│   ├── TabRouting.tsx                 # pure routing list/empty/error/open-routing view
│   ├── TabWeComAccess.tsx             # 组合现有 smart WecomAccessControls
│   └── tabs.test.tsx
├── parts/
│   ├── ChannelGlyph.tsx
│   ├── ChannelInventoryRow.tsx
│   ├── ChannelProbeResultBadge.tsx
│   ├── ChannelThroughputChart.tsx
│   ├── MetricTile.tsx
│   └── parts.test.tsx
├── dialogs/
│   ├── TestResultDialog.tsx
│   ├── LogoutDialog.tsx
│   └── dialogs.test.tsx
├── __fixtures__/
│   └── channels.fixture.ts
└── existing smart components kept in place
    ├── ChannelSettingsEditor.tsx
    ├── AccountDmPolicyEditor.tsx
    ├── WecomAccessControls.tsx
    └── WecomRoutingSummary.tsx
```

`ChannelsPanel.tsx` 瘦身目标：

- 目标：约 400-550 行。
- 硬门槛：不得继续超过 700 行 reviewability ceiling，除非 OpenSpec task 记录明确原因和 follow-up。

## 7. 组件 props 契约

以下 props 是 OpenSpec 实施时的目标形态；允许小幅按代码实际收敛，但不得改变数据边界。

### 7.1 shared types

```ts
type PanelState = "idle" | "loading" | "ready";
type ThroughputWindow = "1h" | "6h" | "24h";
type ChannelFilter = "all" | "enabled" | "alerts" | "wecom";
type ChannelTabId = "overview" | "throughput" | "probe" | "settings" | "routing" | "wecom";

type NormalizedChannelAccount = {
  accountId: string;
  payload: Record<string, unknown>;
  diagnostic: {
    tone: "success" | "warning" | "error" | "neutral" | "info";
    title: string;
    description: string;
    nextStep: string;
  };
};

type ChannelInventoryItem = {
  accounts: NormalizedChannelAccount[];
  alertCount: number;
  channel: Record<string, unknown>;
  defaultAccountId: string;
  detailLabel: string;
  enabled: boolean;
  id: string;
  label: string;
  meta?: DeckGoChannelUiMeta;
  throughputSummary: { messagesIn: number; messagesOut: number };
};
```

### 7.2 views

```ts
interface ChannelsListViewProps {
  channels: ChannelInventoryItem[];
  filteredChannels: ChannelInventoryItem[];
  selectedChannelId: string;
  totals: {
    alerts: number;
    degraded: number;
    enabled: number;
    messagesIn: number;
    messagesOut: number;
    totalAccounts: number;
  };
  loadState: PanelState;
  error: string;
  query: string;
  filter: ChannelFilter;
  availableFilters: ChannelFilter[];
  filterCounts: Record<ChannelFilter, number>;
  timestamp: number | string | null | undefined;
  onQuery: (q: string) => void;
  onFilter: (f: ChannelFilter) => void;
  onSelect: (channelId: string) => void;
  onRefresh: () => void;
  onClearFilters: () => void;
}

interface ChannelsDetailViewProps {
  channel: ChannelInventoryItem;
  activeTab: ChannelTabId;
  availableTabs: Array<{ id: ChannelTabId; wecomOnly?: boolean }>;
  timestamp: number | string | null | undefined;
  error: string;
  probeResult: DeckGoChannelTestResponse | null;
  actionState: "idle" | "logging-out" | "testing" | "toggling";
  tabContent: React.ReactNode;
  onBack: () => void;
  onTabChange: (tab: ChannelTabId) => void;
  onTest: () => void;
  onLogoutRequested: () => void;
}
```

### 7.3 tabs

```ts
interface TabOverviewProps {
  channel: ChannelInventoryItem;
  throughputWindow: ThroughputWindow;
  throughputMessagesIn: number;
  throughputMessagesOut: number;
  selectedChannelLatency?: number;
  probeResult: DeckGoChannelTestResponse | null;
  onOpenPlugin: (pluginId: string) => void;
  onOpenRoutingTab: () => void;
  onOpenSettingsTab: () => void;
}

interface TabThroughputProps {
  buckets: DeckGoChannelThroughputBucket[];
  messagesIn: number;
  messagesOut: number;
  window: ThroughputWindow;
  onWindow: (w: ThroughputWindow) => void;
}

interface TabProbeProps {
  channel: ChannelInventoryItem;
  probeResult: DeckGoChannelTestResponse | null;
  actionState: "idle" | "logging-out" | "testing" | "toggling";
  onRunProbe: () => void;
}

interface TabRoutingProps {
  channelId: string;
  accountId: string;
  routing: DeckGoRoutingListResponse | null;
  loadState: PanelState;
  error: string;
  onOpenRouting: () => void;
}
```

`TabSettings` 和 `TabWeComAccess` 是 bridge tabs：它们可以组合现有 smart components，但不得改变这些组件的 public props 或内部写入路径。

### 7.4 parts / dialogs

```ts
interface ChannelInventoryRowProps {
  item: ChannelInventoryItem;
  selected: boolean;
  totalMessagesIn: number;
  onSelect: (channelId: string) => void;
}

interface ChannelProbeResultBadgeProps {
  result: DeckGoChannelTestResponse;
}

interface ChannelThroughputChartProps {
  buckets: DeckGoChannelThroughputBucket[];
  messagesIn: number;
  messagesOut: number;
  window: ThroughputWindow;
}

interface TestResultDialogProps {
  channelLabel: string;
  result: DeckGoChannelTestResponse;
  onClose: () => void;
}

interface LogoutDialogProps {
  channelId: string;
  actionState: "idle" | "logging-out" | "testing" | "toggling";
  onCancel: () => void;
  onConfirm: () => void;
}
```

#1 中有意不定义 `CreateChannelDialogProps`。

## 8. 数据流

### 8.1 数据入口

`ChannelsPanel.tsx` 是本子项目新增抽离组件的数据入口。它可以保留当前 `queryClient.fetchQuery(...)` 形态，也可以使用已有 Data Fabric query hooks，但不得改变 Data Fabric contracts。

当前应由 `ChannelsPanel.tsx` 负责：

```ts
queryClient.fetchQuery({ ...channelsListQueryOptions(bff), staleTime: 0 });
queryClient.fetchQuery(channelThroughputQueryOptions(bff, selectedChannelId, throughputWindow));
queryClient.fetchQuery(routingBindingsQueryOptions(bff, { channel: selectedChannelId, accountId }));

const probeMutation = useTestChannelMutation();
const logoutMutation = useLogoutChannelMutation();
const patchMutation = usePatchChannelConfigMutation();
```

`views/`、`tabs/`、`parts/`、`dialogs/` 默认不 import Data Fabric、React Query、API wrapper、Gateway client 或 navigation store。例外仅限本次保留的既有 smart components。

### 8.2 单向数据流

```
ChannelsPanel
  ├─ fetches inventory / throughput / routing
  ├─ runs probe / logout / channel patch mutations
  ├─ owns view state: list/detail, selectedChannelId, activeTab, dialogs
  ├─ owns filters: searchQuery, filter, availableFilters, filterCounts
  ├─ owns action state and top-level errors
  ├─ derives ChannelInventoryItem[] via lib/channel-selectors
  │
  ├─→ <ChannelsListView>
  │     └─→ parts: MetricTile / ChannelInventoryRow / ChannelGlyph
  │
  └─→ <ChannelsDetailView>
        └─→ tabs: Overview / Throughput / Probe / Settings / Routing / WeComAccess
              └─→ parts or existing smart components
```

### 8.3 事件冒泡

| Surface              | 事件                               | orchestrator 接管                                                      |
| -------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| `ChannelsListView`   | search/filter/select/refresh/clear | set local state or call `refresh()`                                    |
| `ChannelsDetailView` | back/tab/test/logout request       | set local state or call mutation                                       |
| `TabOverview`        | open plugin/routing/settings       | navigation callback or tab state                                       |
| `TabThroughput`      | window change                      | set `throughputWindow`                                                 |
| `TabProbe`           | run probe                          | `testChannelMutation.mutateAsync(selected.id)`                         |
| `TabRouting`         | open routing                       | `navigateToRouting(ui, { channelId, accountId })` from parent callback |
| `LogoutDialog`       | confirm/cancel                     | `logoutChannelMutation.mutateAsync(selected.id)` or close              |
| `TestResultDialog`   | close                              | local dialog state                                                     |

### 8.4 既有 smart 组件例外

保留以下现状，不在 #1 中重构为 dumb props：

- `ChannelSettingsEditor` 内部调用 `usePatchChannelConfigMutation`，维护 retry / dmPolicy / json patch draft。
- `AccountDmPolicyEditor` 内部调用 `usePatchChannelConfigMutation`，维护 account policy draft。
- `WecomAccessControls` 内部调用 `useConfigSnapshotQuery` / `usePatchDeckConfigMutation`，维护 WeCom access model、baseHash、savingSection 等。

这三个组件后续如果要去 smart 化或拆分内部 sub-editor，必须作为 #2 / #3 / 独立 follow-up 处理。

## 9. 错误处理 / 边界状态

| 层             | 状态                             | 渲染策略                                                        | 责任方                            |
| -------------- | -------------------------------- | --------------------------------------------------------------- | --------------------------------- |
| Panel 级       | inventory loading/error/ready    | `ChannelsListView` 渲染 loading/error/true-empty/filtered-empty | `ChannelsPanel`                   |
| View 级        | selectedChannel missing          | orchestrator 回退 list 或选择第一项                             | `ChannelsPanel`                   |
| Tab 级         | throughput empty buckets         | `TabThroughput` 显示 honest empty state，不伪造 chart           | `TabThroughput`                   |
| Tab 级         | routing loading/error/0 bindings | `TabRouting` 显示 loading/error/empty state                     | `ChannelsPanel` + `TabRouting`    |
| Part 级        | busy/disabled                    | 禁用对应按钮，必要时显示 inline label                           | parts/dialogs                     |
| Mutation error | probe/logout/patch error         | parent 注入 error 或 existing smart component 自己显示          | `ChannelsPanel` / smart component |

现有错误语义保持：

- `channels.config.patch`：backend-derived baseHash；前端不提供 baseHash，不使用 `DataFabricBaseHashRequiredError` 语义。
- `patchDeckConfig`：仍由 WeCom/config 相关 smart components 使用 baseHash。
- 网络/超时：沿用 Data Fabric shared retry/error behavior。
- Probe 失败：`testChannel()` 保留 error-preserving response；UI 显示 warning/error。
- Logout：继续通过 confirmation gate；real mutation 在缺 disposable provider state 时 skipped-safe/deferred。

## 10. 测试策略

### 10.1 现有测试零语义退化

| 测试                                                | 要求                                                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `ChannelsPanel.test.tsx`                            | 当前 10 个 `it(...)` 场景继续覆盖；允许 selector 调整，不允许降低语义覆盖                        |
| `api.chat-helpers.test.ts` channels helper coverage | 若 wrapper/API seam 被触达，必须继续通过相关 cases                                               |
| `channels-visual.spec.ts`                           | mock visual smoke 继续通过，产出 7 张 screenshot artifact，无 console/page/API unexpected errors |
| `channels-real-gateway.spec.ts`                     | 若运行 real E2E，保持 2 个场景不退化；unsafe mutation 继续按 skipped-safe/deferred 记录          |

### 10.2 新增 focused tests

新增测试不以 arbitrary case 数量作为目标，而以覆盖面作为目标：

| 文件                                | 覆盖重点                                                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `lib/channel-selectors.test.ts`     | account diagnostic tone、account normalization、filter/count、throughput summary、WeCom filter availability |
| `parts/parts.test.tsx`              | glyph、inventory row、metric tile、probe badge、throughput chart empty/non-empty                            |
| `views/ChannelsListView.test.tsx`   | loading、error、true-empty、filtered-empty、clear filters、row select                                       |
| `views/ChannelsDetailView.test.tsx` | hero、tabs、back、test/logout callbacks、wecom-only tab gating                                              |
| `tabs/tabs.test.tsx`                | overview metrics/alerts, throughput empty, probe empty/result, routing loading/error/empty                  |
| `dialogs/dialogs.test.tsx`          | test-result close, logout cancel/confirm, busy disabled                                                     |

对于可独立渲染的 view/dialog，优先复用 `expectNoAxeViolations` 做基础 a11y smoke。不要为了满足测试数量制造低价值断言。

### 10.3 Fixture 矩阵

`__fixtures__/channels.fixture.ts` 至少覆盖：

- Telegram：enabled / configured / linked / connected。
- Discord：enabled with warning/error account mix。
- WeCom：partial connected，has WeCom access accounts。
- Slack：disabled。
- QQ：extension plugin / origin=extension。
- empty payload：真实 empty shape。
- throughput：empty buckets 和 non-empty buckets。
- routing：0 bindings 和 1+ bindings。

Fixture 是 unit/component/mock visual 的本地证据，不代表 real provider behavior。

### 10.4 验证命令链

```bash
# focused component/unit tests
cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/channels/

# frontend build
cd deck-go && make frontend-build

# mock visual smoke
cd deck-go && pnpm exec playwright test test/e2e/channels-visual.spec.ts --config playwright.config.ts

# optional real Gateway E2E, bounded/skipped-safe allowed for unsafe mutations
cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/channels-real-gateway.spec.ts --config playwright.config.ts
```

## 11. 验收证据

| 层           | 证据                                                      | 通过判定                                                                                                           |
| ------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 代码结构     | 文件拆分 + `ChannelsPanel.tsx` LOC                        | target 400-550 LOC；hard gate ≤ 700 LOC；职责清晰                                                                  |
| 数据边界     | grep/import review                                        | 新抽 views/tabs/parts/dialogs 不 import Data Fabric/API/Gateway/navigation store；既有 smart components 是明确例外 |
| 单元/组件    | `npm run test:deck-ui -- src/components/panels/channels/` | 现有 panel 场景 + 新 focused tests 全过                                                                            |
| 类型/build   | `make frontend-build`                                     | 0 error；仅允许既有 Vite chunk warning                                                                             |
| mock visual  | `channels-visual.spec.ts`                                 | 1 spec 通过，7 张 screenshot artifact 产出，无 unexpected console/page/API errors                                  |
| real Gateway | `channels-real-gateway.spec.ts`                           | 不强制；若运行，safe read/UI 不退化，unsafe mutation skipped-safe/deferred 有记录                                  |
| OpenSpec     | `openspec validate <change> --type change --strict`       | change strict valid；tasks 只在 fresh evidence 后勾选                                                              |

## 12. 风险与护栏

| 风险                    | 触发条件                                      | 护栏                                                                                               |
| ----------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 误把 dashboard 当权威   | 继续按旧 6 文件名硬拆                         | 主 design 明确 v2 skeleton + production 自然边界为权威；dashboard 仅参考                           |
| smart/dumb 边界混乱     | 新组件偷偷调 Data Fabric/API hook             | grep import；除 `ChannelsPanel.tsx` 和既有 smart components 外，不得引入 data/api/navigation hooks |
| Routing query 仍散落    | `TabRouting` 内部保留 queryClient/Data Fabric | routing fetch/state 上提到 orchestrator；`TabRouting` 只接 props                                   |
| Settings/WeCom 被误重构 | #1 顺手改 smart component 接口                | 4 个既有专用组件接口不动；内部重构另开 follow-up                                                   |
| Create wizard 被误实现  | 根据 prototype 创建 `CreateChannelDialog`     | #1 禁止实现；保留 disabled affordance                                                              |
| 视觉 gate 写过头        | 声称 pixel-level diff=0                       | 只记录当前 visual smoke + artifact；baseline diff 单独 follow-up                                   |
| 测试数字漂移            | 再次引用 "64 cases"                           | 用 `grep -c "^\s*it("` 核实单文件 case；验收按场景覆盖而非历史合计数字                             |
| baseHash 语义错误       | 给 channel patch props 加 baseHash            | `patchChannelConfig(channelId, patch)` 不传 baseHash；contract 是 backend-derived                  |
| Data Fabric 契约误改    | 改 query key/mutation shape                   | `data/modules/channels/` 和 `data/modules/routing/` 接口不在 #1 范围；diff review                  |
| handoff sign-off 误升级 | 顺手改 manifest status                        | #1 不升级 reverse sign-off；只可记录本 change evidence                                             |

## 13. 不在 #1 范围（明确 follow-up）

- #2 WeCom 多 page 化：`WecomOverviewPage` / `WecomAccessPage` / `WecomOnboardingPage` 级别设计。
- #3 per-channel UI registry：schema-driven UI definitions。
- #4 onboarding / ConfigWizard / WeComWizard：需要 Gateway/BFF contract calibration，不得从 prototype 直接实现。
- #5 真实 throughput / analytics：当前 BFF throughput 是 empty placeholder。
- `CreateChannelDialog`：当前无 first-class create-channel endpoint。
- `RetryStrategyEditor` / `AllowFromEditor` 是否从 smart components 内部拆出。
- `window.confirm` / current modal shape 到 canonical Modal 的收敛。
- Playwright `toHaveScreenshot()` baseline visual diff 基础设施。
- handoff reverse sign-off 升级。
- prototype-current parity report 重生成。
- mutation retry / offline replay / IndexedDB persistence。
- schema-driven validation in editors。
- cross-tab error coordination。
- new shared atom / pattern proposal。

## 14. 后续

本 design v2 已吸收 Claude Code review-response 和 Codex cross-review 的事实修正。下一步应创建 OpenSpec change，至少包含：

1. `proposal.md`：说明这是 maintainability decomposition，不是 capability change。
2. `design.md`：引用本设计，明确 v2 skeleton、smart component exceptions、routing query 上提、no create wizard。
3. `spec.md`：requirements 覆盖结构边界、数据边界、行为不退化、visual smoke、real safe evidence。
4. `tasks.md`：按 `types/lib -> fixtures -> parts -> dialogs -> tabs -> views -> orchestrator -> tests/build/visual` 顺序拆分。
5. `verification.yaml`：记录 focused tests、frontend build、mock visual smoke、optional real E2E 和 known skipped-safe mutation gaps。

若实施过程中发现 deterministic code defect，应直接修；若发现会改变 product/design/contract 边界的问题，记录到 `openspec/follow-ups/` 或当前 change handoff。
