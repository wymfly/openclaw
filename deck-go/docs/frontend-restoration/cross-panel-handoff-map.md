# Cross-Panel Handoff Map

This artifact records the exported cross-panel navigation helpers that must be
preserved during frontend restoration.

## Canonical handoffs

| Function                                         | Source                                  | Target panel | Context carried                                 |
| ------------------------------------------------ | --------------------------------------- | ------------ | ----------------------------------------------- |
| `navigateToAgent(agentId, tab?)`                 | `dashboard/src/lib/panel-navigation.ts` | `agents`     | selected agent + optional pending tab           |
| `navigateToRouting(target?)`                     | `dashboard/src/lib/panel-navigation.ts` | `routing`    | agent filter or channel/account simulator input |
| `navigateToChannel(channelId)`                   | `dashboard/src/lib/panel-navigation.ts` | `channels`   | selected channel                                |
| `navigateToChannelAccess(channelId, accountId?)` | `dashboard/src/lib/panel-navigation.ts` | `channels`   | selected channel + pending access target        |
| `navigateToPlugin(pluginId?)`                    | `dashboard/src/lib/panel-navigation.ts` | `plugins`    | selected plugin                                 |
| `navigateToSession(sessionKey)`                  | `dashboard/src/lib/panel-navigation.ts` | `sessions`   | selected session                                |
| `navigateToSubagents()`                          | `dashboard/src/lib/panel-navigation.ts` | `subagents`  | none                                            |

## Restoration rule

The restored frontend must not lose these handoffs by flattening navigation into
local component state.

If a panel interaction depends on one of these functions today, the restored
frontend must provide an equivalent navigation transfer that preserves the same
selection/context payload.

## Execution note

This artifact is the authoritative cross-panel workflow map.

When a panel folder contains internal local navigation helpers, but
`panel-navigation.ts` exposes a shared cross-panel entrypoint, the shared
entrypoint wins.
