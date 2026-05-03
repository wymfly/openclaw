# Plugins Components

## Component Tree

```text
PluginsPanel
  PluginsMetric x4
  PluginInventoryList
    PluginInventoryRow
  SelectedPluginDetail
    EvidenceTile
    ActivationEvidence
    RelatedChannelActions
    PluginDiagnostics
    RawPayloadDisclosure
```

## `PluginsPanel`

Owns plugin inventory, channel support context, capability scope, selected
plugin, load state, inline error, and local handoff message.

Props: none. It is resolved by the panel registry.

## `PluginsMetric`

Props:

```ts
{
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "warning" | "danger";
}
```

Renders compact metrics for plugin count, enabled count, status summary, and
diagnostic count.

## `PluginInventoryList`

Props:

```ts
{
  plugins: DeckGoPluginInventoryEntry[];
  selectedPluginId: string;
  t: PluginTranslator;
  onSelect: (pluginId: string) => void;
}
```

Rows are single buttons. Lifecycle actions do not appear in rows because the
current contract is read-only.

## `SelectedPluginDetail`

Props:

```ts
{
  plugin: DeckGoPluginInventoryEntry;
  availableChannels: Set<string>;
  accessChannels: Set<string>;
  t: PluginTranslator;
  onOpenChannel: (channelId: string) => void;
  onOpenAccess: (channelId: string) => void;
  onOpenRouting: (channelId: string) => void;
}
```

Shows identity, status, version, config path, capability lists, channel IDs,
provider IDs, tool names, Deck actions, activation evidence, diagnostics,
lifecycle limitation copy, and raw payload.

## `RelatedChannelActions`

Shows Channels, Routing, and Access handoff buttons only for visible channel IDs.
Hidden channel IDs are rendered as warning copy.

## `PluginDiagnostics`

Shows diagnostic rows when present and an explicit empty diagnostic state when
none are present.
