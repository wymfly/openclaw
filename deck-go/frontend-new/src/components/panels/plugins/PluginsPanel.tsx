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
import { useTranslations } from "../../../i18n/provider";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";

type PanelState = "idle" | "loading" | "ready";
type PluginTranslator = ReturnType<typeof useTranslations>;

function formatList(values: string[] | undefined, noneLabel: string) {
  return values?.length ? values.join(", ") : noneLabel;
}

function formatDeckActions(
  capabilities: DeckGoPluginActionCapabilities | undefined,
  noneLabel: string,
) {
  if (!capabilities) {
    return noneLabel;
  }
  return (
    Object.entries(capabilities)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name)
      .join(", ") || noneLabel
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
  const t = useTranslations("pluginsInventory");
  const tc = useTranslations("common");
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
        setError(loadError instanceof Error ? loadError.message : t("loadFailed"));
      });
    return () => {
      cancelled = true;
    };
  }, [capability, navigationTarget.pluginId, t]);

  const plugins = payload?.plugins ?? [];
  const availableChannels = useMemo(() => channelIdSet(channelsPayload), [channelsPayload]);
  const accessChannels = useMemo(() => accessChannelIdSet(channelsPayload), [channelsPayload]);
  const enabledCount = useMemo(
    () => plugins.filter((plugin) => plugin.enabled !== false).length,
    [plugins],
  );
  const statusSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const plugin of plugins) {
      const key = plugin.status?.trim() || t("unknown");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([status, count]) => `${status}: ${count}`)
      .join(" · ");
  }, [plugins, t]);
  const scopeLabel =
    payload?.scope === "channel" ? t("scopeChannel") : (payload?.scope ?? t("unknown"));

  return (
    <section className="deck-ui-control-single deck-ui-plugins">
      <header className="deck-ui-control-topbar deck-ui-plugins-header">
        <div>
          <h2 className="deck-ui-control-section-title">{t("title")}</h2>
          <p className="deckgo-note">{t("description")}</p>
          <p className="deckgo-meta">
            {t("scope")}: {scopeLabel}
          </p>
        </div>

        <div className="deck-ui-control-topbar-actions deck-ui-plugins-actions">
          <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
            {loadState === "loading" ? tc("loading") : t(loadState)}
          </span>
          <span className="deckgo-pill">{t("pluginCount", { count: plugins.length })}</span>
          <span className="deckgo-pill">{t("enabledCount", { count: enabledCount })}</span>
          <button
            className={`deckgo-button deck-ui-plugins-button ${
              capability === "channel" ? "is-primary" : ""
            }`}
            disabled={loadState === "loading"}
            type="button"
            onClick={() => setCapability("channel")}
          >
            {t("channelPlugins")}
          </button>
          <button
            className={`deckgo-button deck-ui-plugins-button ${
              capability === "all" ? "is-primary" : ""
            }`}
            disabled={loadState === "loading"}
            type="button"
            onClick={() => setCapability("all")}
          >
            {t("allPlugins")}
          </button>
        </div>
      </header>

      <div className="deck-ui-control-panel-body deck-ui-plugins-body">
        <div className="deckgo-grid deckgo-grid-3 deck-ui-plugins-stats">
          <ShellStat label={t("plugins")} value={plugins.length} />
          <ShellStat label={t("enabled")} value={enabledCount} />
          <ShellStat label={t("statuses")} value={statusSummary || t("none")} />
        </div>

        {error ? <p className="deck-ui-control-error">{error}</p> : null}
        {handoffMessage ? (
          <p className="deckgo-note deck-ui-plugins-handoff">{handoffMessage}</p>
        ) : null}
        {loadState === "loading" && plugins.length === 0 ? (
          <p className="deck-ui-control-empty">{tc("loading")}</p>
        ) : null}
        {loadState !== "loading" && plugins.length === 0 ? (
          <div className="deck-ui-control-empty-state">
            <h3>{t("empty")}</h3>
            <p>{t("description")}</p>
          </div>
        ) : null}

        {plugins.length > 0 ? (
          <ul className="deckgo-shell-list deck-ui-plugins-list">
            {plugins.map((plugin) => (
              <li key={plugin.id}>
                <PluginCard
                  accessChannels={accessChannels}
                  availableChannels={availableChannels}
                  plugin={plugin}
                  selected={selectedPluginId === plugin.id}
                  t={t}
                  onOpenAccess={(channelId) => {
                    navigateToChannelAccess(ui, { channelId });
                    setHandoffMessage(t("openedAccess", { channel: channelId }));
                  }}
                  onOpenChannel={(channelId) => {
                    navigateToChannel(ui, { channelId });
                    setHandoffMessage(t("openedChannel", { channel: channelId }));
                  }}
                  onOpenRouting={(channelId) => {
                    navigateToRouting(ui, { channelId });
                    setHandoffMessage(t("openedRouting", { channel: channelId }));
                  }}
                  onSelect={() => setSelectedPluginId(plugin.id)}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function PluginCard(props: {
  accessChannels: Set<string>;
  availableChannels: Set<string>;
  plugin: DeckGoPluginInventoryEntry;
  selected: boolean;
  t: PluginTranslator;
  onOpenAccess: (channelId: string) => void;
  onOpenChannel: (channelId: string) => void;
  onOpenRouting: (channelId: string) => void;
  onSelect: () => void;
}) {
  const t = props.t;
  const noneLabel = t("none");

  return (
    <article
      role="button"
      tabIndex={0}
      className={`deckgo-selectable-card deck-ui-plugins-row ${
        props.selected ? "is-selected" : ""
      }`}
      onClick={props.onSelect}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        props.onSelect();
      }}
    >
      <div className="deck-ui-control-row-header">
        <div>
          <strong>{props.plugin.name || props.plugin.id}</strong>
          <p className="deckgo-meta">{props.plugin.id}</p>
        </div>
        <div className="deckgo-pill-row deck-ui-plugins-status-row">
          <span className="deckgo-pill">{props.plugin.origin || t("unknown")}</span>
          <span className="deckgo-pill">{props.plugin.status || t("unknown")}</span>
        </div>
      </div>

      <PluginDetails noneLabel={noneLabel} plugin={props.plugin} t={t} />

      <RelatedChannelActions
        accessChannels={props.accessChannels}
        availableChannels={props.availableChannels}
        plugin={props.plugin}
        t={t}
        onOpenAccess={props.onOpenAccess}
        onOpenChannel={props.onOpenChannel}
        onOpenRouting={props.onOpenRouting}
      />
      <PluginDiagnostics plugin={props.plugin} t={t} />
      {props.selected ? <JsonDetails title={t("pluginPayload")} payload={props.plugin} /> : null}
    </article>
  );
}

function PluginDetails(props: {
  noneLabel: string;
  plugin: DeckGoPluginInventoryEntry;
  t: PluginTranslator;
}) {
  const t = props.t;
  return (
    <div className="deckgo-grid deckgo-grid-2 deck-ui-plugins-detail-stats">
      <ShellStat label={t("id")} value={props.plugin.id} />
      <ShellStat label={t("name")} value={props.plugin.name || props.plugin.id} />
      <ShellStat label={t("version")} value={props.plugin.version || "n/a"} />
      <ShellStat label={t("origin")} value={props.plugin.origin || t("unknown")} />
      <ShellStat label={t("status")} value={props.plugin.status || t("unknown")} />
      <ShellStat label={t("enabled")} value={props.plugin.enabled === false ? t("no") : t("yes")} />
      <ShellStat label={t("configPath")} value={props.plugin.configPath || "n/a"} />
      <ShellStat
        label={t("capabilities")}
        value={formatList(props.plugin.capabilityKinds, props.noneLabel)}
      />
      <ShellStat
        label={t("channels")}
        value={formatList(props.plugin.channelIds, props.noneLabel)}
      />
      <ShellStat
        label={t("providers")}
        value={formatList(props.plugin.providerIds, props.noneLabel)}
      />
      <ShellStat label={t("tools")} value={formatList(props.plugin.toolNames, props.noneLabel)} />
      <ShellStat
        label={t("deckActions")}
        value={formatDeckActions(props.plugin.deckActionCapabilities, props.noneLabel)}
      />
    </div>
  );
}

function RelatedChannelActions(props: {
  accessChannels: Set<string>;
  availableChannels: Set<string>;
  plugin: DeckGoPluginInventoryEntry;
  t: PluginTranslator;
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
      <p className="deckgo-surface-label">{props.t("relatedChannels")}</p>
      <div className="deckgo-actions deck-ui-plugins-actions">
        {visibleChannels.length > 0 ? (
          visibleChannels.map((channelId) => (
            <button
              className="deckgo-button deck-ui-plugins-button"
              key={`${props.plugin.id}-${channelId}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                props.onOpenChannel(channelId);
              }}
            >
              {props.t("openChannel", { channel: channelId })}
            </button>
          ))
        ) : (
          <span className="deckgo-pill is-muted">{props.t("noVisibleChannels")}</span>
        )}
        {routingChannel ? (
          <button
            className="deckgo-button deck-ui-plugins-button"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              props.onOpenRouting(routingChannel);
            }}
          >
            {props.t("openRouting", { channel: routingChannel })}
          </button>
        ) : null}
        {visibleAccessChannels.map((channelId) => (
          <button
            className="deckgo-button deck-ui-plugins-button"
            key={`${props.plugin.id}-${channelId}-access`}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              props.onOpenAccess(channelId);
            }}
          >
            {props.t("openAccess", { channel: channelId })}
          </button>
        ))}
      </div>
      {hiddenChannels.length > 0 ? (
        <p className="deckgo-note deck-ui-plugins-empty">
          {props.t("channelVisibilityWarning", { channels: hiddenChannels.join(", ") })}
        </p>
      ) : null}
    </div>
  );
}

function PluginDiagnostics(props: { plugin: DeckGoPluginInventoryEntry; t: PluginTranslator }) {
  const diagnostics = props.plugin.diagnostics ?? [];
  const hasActivation = props.plugin.activationSource || props.plugin.activationReason;
  if (!hasActivation && diagnostics.length === 0) {
    return null;
  }
  return (
    <div className="deckgo-form-grid deck-ui-plugins-diagnostics">
      {hasActivation ? (
        <div className="deckgo-surface-tile deck-ui-plugins-surface">
          <p className="deckgo-surface-label">{props.t("activation")}</p>
          <p className="deckgo-note">
            {props.t("activationSource")}: {props.plugin.activationSource || "n/a"} |{" "}
            {props.t("activationReason")}: {props.plugin.activationReason || "n/a"}
          </p>
        </div>
      ) : null}
      {diagnostics.length > 0 ? (
        <div className="deckgo-surface-tile deck-ui-plugins-surface">
          <p className="deckgo-surface-label">{props.t("diagnostics")}</p>
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
