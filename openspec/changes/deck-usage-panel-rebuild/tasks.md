## 1. API 路由与 Store 重构

- [x] 1.1 新增 `dashboard/src/app/api/usage/sessions/route.ts`，代理 `sessions.usage` RPC，支持 startDate/endDate/limit 参数
- [x] 1.2 新增 `dashboard/src/app/api/usage/sessions/logs/route.ts`，代理 `sessions.usage.logs` RPC，支持 key/limit 参数
- [x] 1.3 重构 `dashboard/src/stores/usage.ts`：新增 `fetchSessionsUsage(startDate, endDate)` 方法，存储 `SessionsUsageResult` 原始响应
- [x] 1.4 实现日期范围状态管理：`startDate`/`endDate` + 快捷按钮（today/7d/30d）到日期转换
- [x] 1.5 实现请求去重：同参数 30s 内不重复调用，保留 `usage.cost` 作为初始快速加载 fallback

## 2. 面板布局与 SummaryCards

- [x] 2.1 重构 UsagePanel.tsx 布局：顶栏（日期范围选择器 + 刷新）、指标卡片行、主内容区（图表 + breakdown）、底部（session 列表）
- [x] 2.2 重写 SummaryCards.tsx：6 个指标卡片（Tokens In/Out、Total Cost、Messages、Tool Calls、Avg Latency），支持 progressive loading（先 cost 数据后 sessions.usage 数据）
- [x] 2.3 实现日期范围选择器组件：快捷按钮 + 自定义日期范围展开面板

## 3. 时间序列图表

- [x] 3.1 重写 UsageChart.tsx：使用 `aggregates.daily` 渲染面积图（X=日期，Y=tokens 或 cost），支持 tokens/cost 视图切换
- [x] 3.2 新增按模型分色堆叠面积图模式：使用 `aggregates.modelDaily` 数据，每个模型一个颜色层

## 4. 多维度 Breakdown

- [x] 4.1 重写 BreakdownTable.tsx：四维度 tab（Model/Provider/Agent/Channel），分别消费 aggregates.byModel/byProvider/byAgent/byChannel
- [x] 4.2 集成 SortableHeader 排序（按 Tokens In/Out/Cost 列）和 PaginatedList 分页（> 20 条时）
- [x] 4.3 每行添加占比百分比条（相对于 totals 的占比），使用 CSS 变量着色

## 5. 延迟分析

- [x] 5.1 新增 LatencyCard.tsx：展示 p50/p90/p99 延迟值，自动单位转换（ms/s）
- [x] 5.2 实现每日延迟趋势折线图（使用 aggregates.dailyLatency），支持 p50/p90/p99 切换
- [x] 5.3 处理 latency 数据不可用的降级（条件渲染，不显示空卡片）

## 6. Session 下钻

- [x] 6.1 新增 SessionUsageList.tsx：使用 PaginatedList 渲染 session 列表（key、agent、tokens、cost、时间），默认按 cost 降序
- [x] 6.2 集成 ListSearchBar：按 session key 或 agent 名称搜索
- [x] 6.3 实现 session 展开详情：点击行调用 `sessions.usage.logs`，展示日志列表（timestamp、event、tokens、cost）
- [x] 6.4 添加 "查看详情" 导航按钮，跳转到 Sessions 面板对应 session

## 7. i18n 与验证

- [x] 7.1 在 `zh.json`/`en.json` 的 `usage` 命名空间新增所有 key（dimension tab 名、latency 指标名、date range 标签、session 列表标题等）
- [x] 7.2 验证 dark mode 样式（所有颜色通过 CSS 变量）
- [x] 7.3 运行 `tsc --noEmit` 确保零类型错误
