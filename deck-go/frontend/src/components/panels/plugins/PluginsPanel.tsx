import { useEffect, useMemo, useState } from "react";
import type {
  DeckGoChannelsStatusResponse,
  DeckGoPluginActionCapabilities,
  DeckGoPluginInventoryEntry,
  DeckGoPluginsListResponse,
} from "../../../../../contracts/generated/ts/deck-api.generated";
import {
  fetchChannels,
  fetchPluginsWithCapability,
  type DeckGoPluginCapability,
} from "../../../api";
import {
  navigateToChannel,
  navigateToChannelAccess,
  navigateToRouting,
} from "../../../deck-ui/panel-navigation";
import { useDeckUI } from "../../../deck-ui/ui-store";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";

type PanelState = "idle" | "loading" | "ready";

function formatList(values: string[] | undefined) {
  return values?.length ? values.join(", ") : "none";
}

function formatDeckActions(capabilities: DeckGoPluginActionCapabilities | undefined) {
  if (!capabilities) {
    return "none";
  }
  return (
    Object.entries(capabilities)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name)
      .join(", ") || "none"
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function channelIdSet(payload: DeckGoChannelsStatusResponse | null) {
  const ordered = payload?.channelOrder ?? [];
  const fromChannels = Object.keys(asRecord(payload?.channels));
  return new Set([...ordered, ...fromChannels]);
}

function accessChannelIdSet(payload: DeckGoChannelsStatusResponse | null) {
  const ids = new Set<string>();
  if (payload?.channelOrder?.includes("wecom")) {
    ids.add("wecom");
  }
  for (const entry of payload?.channelMeta ?? []) {
    if (entry.id === "wecom" || entry.pluginId === "wecom") {
      ids.add(entry.id);
    }
  }
  return ids;
}

function readPluginNavigationTarget() {
  if (typeof window === "undefined") {
    return { pluginId: "" };
  }
  return {
    pluginId: new URL(window.location.href).searchParams.get("pluginId")?.trim() ?? "",
  };
}

export function PluginsPanel() {
  const ui = useDeckUI();
  const [navigationTarget] = useState(readPluginNavigationTarget);
  const [payload, setPayload] = useState<DeckGoPluginsListResponse | null>(null);
  const [channelsPayload, setChannelsPayload] = useState<DeckGoChannelsStatusResponse | null>(null);
  const [capability, setCapability] = useState<DeckGoPluginCapability>("channel");
  const [selectedPluginId, setSelectedPluginId] = useState("");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [error, setError] = useState("");
  const [handoffMessage, setHandoffMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    void Promise.all([fetchPluginsWithCapability(capability), fetchChannels().catch(() => null)])
      .then(([next, nextChannels]) => {
        if (cancelled) {
          return;
        }
        setPayload(next);
        setChannelsPayload(nextChannels);
        setLoadState("ready");
        setError("");
        const targetId = navigationTarget.pluginId;
        const targetExists = Boolean(
          targetId && next.plugins?.some((plugin) => plugin.id === targetId),
        );
        const firstId = targetExists ? targetId : (next.plugins?.[0]?.id ?? "");
        setSelectedPluginId((current) =>
          current && next.plugins?.some((plugin) => plugin.id === current) ? current : firstId,
        );
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }
        setLoadState("idle");
        setError(loadError instanceof Error ? loadError.message : "failed to load plugins");
      });
    return () => {
      cancelled = true;
    };
  }, [capability]);

  const plugins = payload?.plugins ?? [];
  const availableChannels = useMemo(() => channelIdSet(channelsPayload), [channelsPayload]);
  const accessChannels = useMemo(() => accessChannelIdSet(channelsPayload), [channelsPayload]);
  const selectedPlugin =
    plugins.find((plugin) => plugin.id === selectedPluginId) ?? plugins[0] ?? null;
  const enabledCount = useMemo(
    () => plugins.filter((plugin) => plugin.enabled !== false).length,
    [plugins],
  );
  const statusSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const plugin of plugins) {
      const key = plugin.status?.trim() || "unknown";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([status, count]) => `${status}: ${count}`)
      .join(" · ");
  }, [plugins]);

  return (
    <section className="deckgo-panel-workspace deck-ui-plugins">
      <div className="deckgo-column deck-ui-plugins-column">
        <article className="deckgo-card is-float deck-ui-plugins-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Plugin inventory</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Plugin capability inventory is backed by the live `deck.plugins.list` contract.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-plugins-body">
            <div className="deckgo-pill-row deck-ui-plugins-status-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Inventory {loadState}
              </span>
              <span className="deckgo-pill">scope: {payload?.scope || "unknown"}</span>
              <span className="deckgo-pill">capability: {capability}</span>
            </div>
            <div className="deckgo-grid deckgo-grid-3 deck-ui-plugins-stats">
              <ShellStat label="plugins" value={plugins.length} />
              <ShellStat label="enabled" value={enabledCount} />
              <ShellStat label="statuses" value={statusSummary || "none"} />
            </div>
            <div className="deckgo-actions deck-ui-plugins-actions">
              <button
                className={`deckgo-button deck-ui-plugins-button ${capability === "channel" ? "is-primary" : ""}`}
                type="button"
                onClick={() => setCapability("channel")}
                disabled={loadState === "loading"}
              >
                Channel plugins
              </button>
              <button
                className={`deckgo-button deck-ui-plugins-button ${capability === "all" ? "is-primary" : ""}`}
                type="button"
                onClick={() => setCapability("all")}
                disabled={loadState === "loading"}
              >
                All plugins
              </button>
            </div>
            {error ? <p className="deckgo-note deck-ui-plugins-error">{error}</p> : null}
            {plugins.length === 0 ? (
              <p className="deckgo-note deck-ui-plugins-empty">No plugins loaded.</p>
            ) : (
              <ul className="deckgo-shell-list deck-ui-plugins-list">
                {plugins.map((plugin) => (
                  <li key={plugin.id}>
                    <button
                      type="button"
                      className={`deckgo-selectable-card deck-ui-plugins-row ${selectedPluginId === plugin.id ? "is-selected" : ""}`}
                      onClick={() => setSelectedPluginId(plugin.id)}
                    >
                      <strong>{plugin.name || plugin.id}</strong>
                      <div className="deckgo-meta">
                        id: {plugin.id} | origin: {plugin.origin || "unknown"} | status:{" "}
                        {plugin.status || "unknown"}
                      </div>
                      <div className="deckgo-meta">
                        enabled: {plugin.enabled === false ? "no" : "yes"}
                      </div>
                      <div className="deckgo-meta">
                        capabilities: {formatList(plugin.capabilityKinds)} | channels:{" "}
                        {formatList(plugin.channelIds)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-panel-main deck-ui-plugins-column">
        <article className="deckgo-card is-float deck-ui-plugins-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Selected plugin</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Plugin inventory comes from `deck.plugins.list`, with related channel visibility and
            diagnostics cross-checked against channel status.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-plugins-body">
            {selectedPlugin ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-plugins-hero">
                  <div>
                    <p className="deckgo-kicker">Plugin</p>
                    <strong>{selectedPlugin.name || selectedPlugin.id}</strong>
                    <p className="deckgo-note">scope: {payload?.scope || "unknown"}</p>
                  </div>
                  <div className="deckgo-pill-row deck-ui-plugins-status-row">
                    <span className="deckgo-pill">origin {selectedPlugin.origin || "unknown"}</span>
                    <span className="deckgo-pill">status {selectedPlugin.status || "unknown"}</span>
                  </div>
                </div>
                <RelatedChannelActions
                  accessChannels={accessChannels}
                  availableChannels={availableChannels}
                  plugin={selectedPlugin}
                  onOpenChannel={(channelId) => {
                    navigateToChannel(ui, { channelId });
                    setHandoffMessage(`Opened Channels panel; target channel: ${channelId}`);
                  }}
                  onOpenAccess={(channelId) => {
                    navigateToChannelAccess(ui, { channelId });
                    setHandoffMessage(`Opened Channels access controls for ${channelId}`);
                  }}
                  onOpenRouting={(channelId) => {
                    navigateToRouting(ui, { channelId });
                    setHandoffMessage(`Opened Routing panel; target channel: ${channelId}`);
                  }}
                />
                {handoffMessage ? (
                  <p className="deckgo-note deck-ui-plugins-handoff">{handoffMessage}</p>
                ) : null}
                <PluginDetails plugin={selectedPlugin} />
                <PluginDiagnostics plugin={selectedPlugin} />
                <JsonDetails title="Plugin payload" payload={selectedPlugin} />
              </>
            ) : (
              <p className="deckgo-note deck-ui-plugins-empty">
                Choose a plugin to inspect its payload.
              </p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

function PluginDetails(props: { plugin: DeckGoPluginInventoryEntry }) {
  return (
    <div className="deckgo-grid deckgo-grid-2 deck-ui-plugins-detail-stats">
      <ShellStat label="id" value={props.plugin.id} />
      <ShellStat label="name" value={props.plugin.name || props.plugin.id} />
      <ShellStat label="version" value={props.plugin.version || "n/a"} />
      <ShellStat label="origin" value={props.plugin.origin || "unknown"} />
      <ShellStat label="status" value={props.plugin.status || "unknown"} />
      <ShellStat label="enabled" value={props.plugin.enabled === false ? "no" : "yes"} />
      <ShellStat label="config path" value={props.plugin.configPath || "n/a"} />
      <ShellStat label="capabilities" value={formatList(props.plugin.capabilityKinds)} />
      <ShellStat label="channels" value={formatList(props.plugin.channelIds)} />
      <ShellStat label="providers" value={formatList(props.plugin.providerIds)} />
      <ShellStat label="tools" value={formatList(props.plugin.toolNames)} />
      <ShellStat
        label="deck actions"
        value={formatDeckActions(props.plugin.deckActionCapabilities)}
      />
    </div>
  );
}

function RelatedChannelActions(props: {
  accessChannels: Set<string>;
  availableChannels: Set<string>;
  plugin: DeckGoPluginInventoryEntry;
  onOpenAccess: (channelId: string) => void;
  onOpenChannel: (channelId: string) => void;
  onOpenRouting: (channelId: string) => void;
}) {
  const channelIds = props.plugin.channelIds ?? [];
  if (channelIds.length === 0) {
    return null;
  }
  const visibleChannels = channelIds.filter((channelId) => props.availableChannels.has(channelId));
  const hiddenChannels = channelIds.filter((channelId) => !props.availableChannels.has(channelId));
  const visibleAccessChannels = visibleChannels.filter((channelId) =>
    props.accessChannels.has(channelId),
  );
  const routingChannel = visibleChannels[0] ?? channelIds[0];
  return (
    <div className="deckgo-surface-tile deck-ui-plugins-surface">
      <p className="deckgo-surface-label">Related channels</p>
      <div className="deckgo-actions deck-ui-plugins-actions">
        {visibleChannels.length > 0 ? (
          visibleChannels.map((channelId) => (
            <button
              className="deckgo-button deck-ui-plugins-button"
              key={`${props.plugin.id}-${channelId}`}
              type="button"
              onClick={() => props.onOpenChannel(channelId)}
            >
              Open channel {channelId}
            </button>
          ))
        ) : (
          <span className="deckgo-pill is-muted">No visible channels in Channels yet</span>
        )}
        {routingChannel ? (
          <button
            className="deckgo-button deck-ui-plugins-button"
            type="button"
            onClick={() => props.onOpenRouting(routingChannel)}
          >
            Open routing for {routingChannel}
          </button>
        ) : null}
        {visibleAccessChannels.map((channelId) => (
          <button
            className="deckgo-button deck-ui-plugins-button"
            key={`${props.plugin.id}-${channelId}-access`}
            type="button"
            onClick={() => props.onOpenAccess(channelId)}
          >
            Open access for {channelId}
          </button>
        ))}
      </div>
      {hiddenChannels.length > 0 ? (
        <p className="deckgo-note deck-ui-plugins-empty">
          Not visible in Channels: {hiddenChannels.join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function PluginDiagnostics(props: { plugin: DeckGoPluginInventoryEntry }) {
  const diagnostics = props.plugin.diagnostics ?? [];
  const hasActivation = props.plugin.activationSource || props.plugin.activationReason;
  if (!hasActivation && diagnostics.length === 0) {
    return null;
  }
  return (
    <div className="deckgo-form-grid deck-ui-plugins-diagnostics">
      {hasActivation ? (
        <div className="deckgo-surface-tile deck-ui-plugins-surface">
          <p className="deckgo-surface-label">Activation</p>
          <p className="deckgo-note">
            source: {props.plugin.activationSource || "n/a"} | reason:{" "}
            {props.plugin.activationReason || "n/a"}
          </p>
        </div>
      ) : null}
      {diagnostics.length > 0 ? (
        <div className="deckgo-surface-tile deck-ui-plugins-surface">
          <p className="deckgo-surface-label">Diagnostics</p>
          <ul className="deckgo-shell-list deck-ui-plugins-list">
            {diagnostics.map((diagnostic, index) => (
              <li key={`${props.plugin.id}-diagnostic-${index}`}>
                <p className="deckgo-note">
                  [{diagnostic.level}] {diagnostic.message}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
