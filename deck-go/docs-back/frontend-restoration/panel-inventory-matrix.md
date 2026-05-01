# Panel Inventory Matrix

This matrix is keyed to the live `panel-registry` surface, not directory names.

## Runtime panels

| Panel id       | Group      | Legacy import target                                | Loading mode | Notes                                   |
| -------------- | ---------- | --------------------------------------------------- | ------------ | --------------------------------------- |
| `chat`         | `core`     | `@/components/panels/chat/ChatPanel`                | eager        | highest workflow density surface        |
| `agents`       | `core`     | `@/components/panels/agents/AgentsPanel`            | lazy         | agent list/detail + tabs                |
| `gateway`      | `core`     | `@/components/panels/monitor/MonitorPanel`          | lazy         | folder name differs from panel id       |
| `models`       | `core`     | `@/components/panels/models/ModelsPanel`            | lazy         | provider/model management               |
| `usage`        | `observe`  | `@/components/panels/usage/UsagePanel`              | lazy         | charts/cards/list                       |
| `sessions`     | `observe`  | `@/components/panels/sessions/SessionsPanel`        | lazy         | session browser/detail                  |
| `memory`       | `observe`  | `@/components/panels/memory/MemoryPanel`            | lazy         | search/graph/health                     |
| `logs`         | `observe`  | `@/components/panels/logs/LogsPanel`                | lazy         | stream + filters                        |
| `activity`     | `observe`  | `@/components/panels/activity/ActivityPanel`        | lazy         | event/activity view                     |
| `threads`      | `observe`  | `@/components/panels/threads/ThreadsPanel`          | lazy         | thread list/detail/relation             |
| `api-explorer` | `observe`  | `@/components/panels/api-explorer/ApiExplorerPanel` | lazy         | gateway describe/method explorer        |
| `cron`         | `automate` | `@/components/panels/scheduler/SchedulerPanel`      | lazy         | registry target overrides folder naming |
| `webhooks`     | `automate` | `@/components/panels/webhooks/WebhooksPanel`        | lazy         | outbound delivery config/history        |
| `approvals`    | `automate` | `@/components/panels/approvals/ApprovalsPanel`      | lazy         | pending/plugins/policy tabs             |
| `skills`       | `automate` | `@/components/panels/skills/SkillsPanel`            | lazy         | hub/config/matrix/info                  |
| `budget`       | `control`  | `@/components/panels/budget/BudgetPanel`            | lazy         | budget controls                         |
| `alerts`       | `control`  | `@/components/panels/alerts/AlertsPanel`            | lazy         | rules + fired alerts                    |
| `channels`     | `control`  | `@/components/panels/channels/ChannelsPanel`        | lazy         | channel list/detail/access/settings     |
| `plugins`      | `control`  | `@/components/panels/plugins/PluginsPanel`          | lazy         | plugin inventory/detail                 |
| `routing`      | `control`  | `@/components/panels/routing/RoutingPanel`          | lazy         | bindings/simulation                     |
| `subagents`    | `control`  | `@/components/panels/subagents/SubagentsPanel`      | lazy         | active/history/config tabs              |
| `identity`     | `control`  | `@/components/panels/identity/IdentityPanel`        | lazy         | identity list/linking                   |
| `config`       | `control`  | `@/components/panels/config-editor/ConfigPanel`     | lazy         | config editor/schema form               |
| `nodes`        | `control`  | `@/components/panels/nodes/NodeManagementPanel`     | lazy         | pairing/lifecycle                       |
| `docs`         | `control`  | `@/components/panels/docs/DocHubPanel`              | lazy         | docs hub/list/viewer                    |
| `settings`     | `bottom`   | `@/components/panels/settings/SettingsPanel`        | lazy         | bottom-rail special slot                |

## Inventory notes

- `gateway` panel id maps to `monitor` folder/module.
- `cron` panel id maps to `scheduler` folder/module.
- `settings` is not grouped with the main sections; it is positioned in the bottom rail.

These mismatches are expected and are part of the reason `panel-registry` is the authoritative inventory source.
