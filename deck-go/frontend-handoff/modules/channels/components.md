# channels - components

## Production ownership

- `frontend-new/src/components/panels/channels/ChannelsPanel.tsx`
- `frontend-new/src/components/panels/channels/ChannelSettingsEditor.tsx`
- `frontend-new/src/components/panels/channels/AccountDmPolicyEditor.tsx`
- `frontend-new/src/components/panels/channels/WecomAccessControls.tsx`
- `frontend-new/src/components/panels/channels/WecomRoutingSummary.tsx`

## Layout tree

```txt
ChannelsPanel
  ChannelsHeader
  ChannelsMetrics
  ChannelsWorkbench
    ChannelInventoryColumn
      ChannelInventoryCard
      ChannelRow[]
    ChannelDetailColumn
      SelectedChannelHero
      ThroughputSurface
      ProbeResultSurface
      ChannelSettingsSurface
      AccountDiagnosticsSurface
      WeComAccessSurface?
      RoutingSummarySurface?
      EvidenceSurface
```

## Local molecules

### Channel metric tile

Compact KPI tile for channels, accounts, alerts, throughput, and selected
channel. Same rhythm as agents/routing/subagents/logs/settings/sessions metric
tiles, but kept local until promoted separately.

### Channel inventory row

Selectable row containing label, channel id, plugin/account detail, account
count, alert count, and health badge.

### Selected-channel hero

Dense identity/status surface with channel label, detail label, default account,
enabled state, alert count, and channel id.

### Account diagnostic card

Account health row/card with display name, account id, diagnostic title,
description, next step, and optional DM policy controls.

### Throughput strip

Compact chart-like row list for in/out buckets. It may use native progress bars
or CSS-only bars locally; do not promote to `SparklineChart` inside this change.

### Config patch form

Generic channel settings form and JSON patch seam. Production must preserve the
existing payload semantics.

### WeCom access card

Provider-specific policy card for bot/agent/dynamic/routing settings. Keep
styling consistent with generic surfaces but keep behavior scoped to WeCom.

### Routing handoff strip

Small surface summarizing WeCom routing bindings and exposing "open routing"
with channel/account context.

## Class naming

Production should replace `deck-ui-channels*` with module-local classes:

- `.channels-panel`
- `.channels-metrics`
- `.channels-workbench`
- `.channels-column`
- `.channels-card`
- `.channels-surface`
- `.channels-inventory-row`
- `.channels-account-row`
- `.channels-throughput-row`
- `.channels-field`
- `.channels-actions`
- `.channels-code`

Legacy shared `deckgo-*` classes may remain only where still owned by global
shell infrastructure outside this module.
