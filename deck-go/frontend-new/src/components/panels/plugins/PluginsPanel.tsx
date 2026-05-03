import { useCallback, useEffect, useMemo, useState } from "react";
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
import { PluginsMetric } from "./PluginsMetric";
import "./plugins-panel.css";

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

function statusSummary(plugins: DeckGoPluginInventoryEntry[], unknownLabel: string) {
  const counts = new Map<string, number>();
  for (const plugin of plugins) {
    const key = plugin.status?.trim() || unknownLabel;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return (
    Array.from(counts.entries())
      .map(([status, count]) => `${status}: ${count}`)
      .join(" · ") || unknownLabel
  );
}

function diagnosticCount(plugins: DeckGoPluginInventoryEntry[]) {
  return plugins.reduce((count, plugin) => count + (plugin.diagnostics?.length ?? 0), 0);
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

  const loadPlugins = useCallback(
    async (preferredPluginId?: string) => {
      setLoadState("loading");
      try {
        const [next, nextChannels] = await Promise.all([
          fetchPluginsWithCapability(capability),
          fetchChannels().catch(() => null),
        ]);
        const nextPlugins = next.plugins ?? [];
        setPayload(next);
        setChannelsPayload(nextChannels);
        setLoadState("ready");
        setError("");
        const targetId = navigationTarget.pluginId;
        const targetExists = Boolean(
          targetId && nextPlugins.some((plugin) => plugin.id === targetId),
        );
        setSelectedPluginId((current) => {
          const preferred = preferredPluginId || (targetExists ? targetId : current);
          return preferred && nextPlugins.some((plugin) => plugin.id === preferred)
            ? preferred
            : (nextPlugins[0]?.id ?? "");
        });
      } catch (loadError) {
        setLoadState("idle");
        setError(loadError instanceof Error ? loadError.message : t("loadFailed"));
      }
    },
    [capability, navigationTarget.pluginId, t],
  );

  useEffect(() => {
    void loadPlugins();
  }, [loadPlugins]);

  const plugins = payload?.plugins ?? [];
  const selectedPlugin = useMemo(
    () => plugins.find((plugin) => plugin.id === selectedPluginId) ?? null,
    [plugins, selectedPluginId],
  );
  const availableChannels = useMemo(() => channelIdSet(channelsPayload), [channelsPayload]);
  const accessChannels = useMemo(() => accessChannelIdSet(channelsPayload), [channelsPayload]);
  const enabledCount = useMemo(
    () => plugins.filter((plugin) => plugin.enabled !== false).length,
    [plugins],
  );
  const statusText = useMemo(() => statusSummary(plugins, t("unknown")), [plugins, t]);
  const scopeLabel =
    payload?.scope === "channel" ? t("scopeChannel") : (payload?.scope ?? t("unknown"));

  return (
    <section className="plugins-panel" data-testid="plugins-panel">
      <header className="plugins-panel__header">
        <div className="plugins-panel__title-stack">
          <p className="plugins-panel__eyebrow">{t("eyebrow")}</p>
          <h2 className="plugins-panel__title">{t("title")}</h2>
          <p className="plugins-panel__description">{t("description")}</p>
          <p className="plugins-panel__meta">
            {t("scope")}: {scopeLabel}
          </p>
        </div>

        <div className="plugins-panel__header-actions">
          <button
            className="plugins-panel__button"
            disabled={loadState === "loading"}
            type="button"
            onClick={() => void loadPlugins(selectedPluginId)}
          >
            {t("refresh")}
          </button>
          <div className="plugins-panel__segmented" aria-label={t("capabilityScope")}>
            <button
              className={`plugins-panel__button ${capability === "channel" ? "is-primary" : ""}`}
              disabled={loadState === "loading"}
              type="button"
              aria-pressed={capability === "channel"}
              onClick={() => setCapability("channel")}
            >
              {t("channelPlugins")}
            </button>
            <button
              className={`plugins-panel__button ${capability === "all" ? "is-primary" : ""}`}
              disabled={loadState === "loading"}
              type="button"
              aria-pressed={capability === "all"}
              onClick={() => setCapability("all")}
            >
              {t("allPlugins")}
            </button>
          </div>
        </div>
      </header>

      <div className="plugins-panel__metrics">
        <PluginsMetric label={t("plugins")} value={String(plugins.length)} />
        <PluginsMetric label={t("enabled")} value={String(enabledCount)} tone="positive" />
        <PluginsMetric label={t("statuses")} value={statusText} />
        <PluginsMetric
          label={t("diagnostics")}
          value={String(diagnosticCount(plugins))}
          tone={diagnosticCount(plugins) > 0 ? "warning" : "neutral"}
        />
      </div>

      {error ? <p className="plugins-panel__error">{error}</p> : null}
      {handoffMessage ? <p className="plugins-panel__note">{handoffMessage}</p> : null}

      <div className="plugins-panel__workspace">
        <aside className="plugins-panel__card">
          <div className="plugins-panel__card-head">
            <div>
              <h3 className="plugins-panel__card-title">{t("inventory")}</h3>
              <p className="plugins-panel__meta">
                {loadState === "loading" ? tc("loading") : t(loadState)}
              </p>
            </div>
            <div className="plugins-panel__pill-row">
              <span className={`plugins-panel__pill ${loadState === "ready" ? "is-positive" : ""}`}>
                {loadState === "loading" ? tc("loading") : t(loadState)}
              </span>
              <span className="plugins-panel__pill">
                {t("pluginCount", { count: plugins.length })}
              </span>
            </div>
          </div>
          <div className="plugins-panel__body">
            {loadState === "loading" && plugins.length === 0 ? (
              <p className="plugins-panel__empty">{tc("loading")}</p>
            ) : (
              <PluginInventoryList
                plugins={plugins}
                selectedPluginId={selectedPluginId}
                t={t}
                onSelect={setSelectedPluginId}
              />
            )}
          </div>
        </aside>

        <main className="plugins-panel__column">
          <section className="plugins-panel__card">
            <div className="plugins-panel__card-head">
              <div>
                <h3 className="plugins-panel__card-title">{t("selectedPlugin")}</h3>
                <p className="plugins-panel__meta">
                  {selectedPlugin ? t("selectedPluginEvidence") : t("selectPluginHint")}
                </p>
              </div>
              <span className="plugins-panel__pill is-muted">{t("readOnly")}</span>
            </div>
            <div className="plugins-panel__body">
              {selectedPlugin ? (
                <SelectedPluginDetail
                  accessChannels={accessChannels}
                  availableChannels={availableChannels}
                  plugin={selectedPlugin}
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
                />
              ) : (
                <div className="plugins-panel__surface">
                  <h3 className="plugins-panel__card-title">{t("empty")}</h3>
                  <p className="plugins-panel__note">{t("selectPluginHint")}</p>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </section>
  );
}

function PluginInventoryList(props: {
  plugins: DeckGoPluginInventoryEntry[];
  selectedPluginId: string;
  t: PluginTranslator;
  onSelect: (pluginId: string) => void;
}) {
  if (props.plugins.length === 0) {
    return <p className="plugins-panel__empty">{props.t("empty")}</p>;
  }
  return (
    <div className="plugins-panel__catalog">
      {props.plugins.map((plugin) => (
        <button
          className={`plugins-panel__row ${props.selectedPluginId === plugin.id ? "is-selected" : ""}`}
          key={plugin.id}
          type="button"
          aria-pressed={props.selectedPluginId === plugin.id}
          onClick={() => props.onSelect(plugin.id)}
        >
          <span className="plugins-panel__row-head">
            <span>
              <strong>{plugin.name || plugin.id}</strong>
              <span className="plugins-panel__meta">{plugin.id}</span>
            </span>
            <span className="plugins-panel__pill-row">
              <span className="plugins-panel__pill">{plugin.origin || props.t("unknown")}</span>
              <span
                className={
                  plugin.enabled === false
                    ? "plugins-panel__pill is-muted"
                    : "plugins-panel__pill is-positive"
                }
              >
                {plugin.enabled === false ? props.t("no") : props.t("yes")}
              </span>
            </span>
          </span>
          <span className="plugins-panel__meta">
            {props.t("status")}: {plugin.status || props.t("unknown")} · {props.t("capabilities")}:{" "}
            {formatList(plugin.capabilityKinds, props.t("none"))}
          </span>
          <span className="plugins-panel__meta">
            {props.t("channels")}: {formatList(plugin.channelIds, props.t("none"))} ·{" "}
            {props.t("diagnostics")}: {plugin.diagnostics?.length ?? 0}
          </span>
        </button>
      ))}
    </div>
  );
}

function SelectedPluginDetail(props: {
  accessChannels: Set<string>;
  availableChannels: Set<string>;
  plugin: DeckGoPluginInventoryEntry;
  t: PluginTranslator;
  onOpenAccess: (channelId: string) => void;
  onOpenChannel: (channelId: string) => void;
  onOpenRouting: (channelId: string) => void;
}) {
  const t = props.t;
  const noneLabel = t("none");
  return (
    <div className="plugins-panel__detail-stack">
      <div className="plugins-panel__hero">
        <div>
          <p className="plugins-panel__eyebrow">{t("selected")}</p>
          <strong>{props.plugin.name || props.plugin.id}</strong>
          <p className="plugins-panel__meta">{props.plugin.id}</p>
        </div>
        <div className="plugins-panel__pill-row">
          <span className="plugins-panel__pill">{props.plugin.origin || t("unknown")}</span>
          <span className="plugins-panel__pill">{props.plugin.status || t("unknown")}</span>
          <span
            className={
              props.plugin.enabled === false
                ? "plugins-panel__pill is-muted"
                : "plugins-panel__pill is-positive"
            }
          >
            {props.plugin.enabled === false ? t("no") : t("yes")}
          </span>
        </div>
      </div>

      <div className="plugins-panel__field-grid">
        <EvidenceTile label={t("version")} value={props.plugin.version || "n/a"} />
        <EvidenceTile label={t("configPath")} value={props.plugin.configPath || "n/a"} />
        <EvidenceTile
          label={t("capabilities")}
          value={formatList(props.plugin.capabilityKinds, noneLabel)}
        />
        <EvidenceTile
          label={t("channels")}
          value={formatList(props.plugin.channelIds, noneLabel)}
        />
        <EvidenceTile
          label={t("providers")}
          value={formatList(props.plugin.providerIds, noneLabel)}
        />
        <EvidenceTile label={t("tools")} value={formatList(props.plugin.toolNames, noneLabel)} />
        <EvidenceTile
          label={t("deckActions")}
          value={formatDeckActions(props.plugin.deckActionCapabilities, noneLabel)}
        />
        <EvidenceTile label={t("statuses")} value={props.plugin.status || t("unknown")} />
      </div>

      <ActivationEvidence plugin={props.plugin} t={t} />
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

      <div className="plugins-panel__surface">
        <p className="plugins-panel__label">{t("lifecycleLimit")}</p>
        <p className="plugins-panel__note">{t("lifecycleLimitDescription")}</p>
      </div>

      <details className="plugins-panel__raw">
        <summary>{t("pluginPayload")}</summary>
        <pre>{JSON.stringify(props.plugin, null, 2)}</pre>
      </details>
    </div>
  );
}

function EvidenceTile(props: { label: string; value: string }) {
  return (
    <div className="plugins-panel__surface">
      <p className="plugins-panel__label">{props.label}</p>
      <strong>{props.value}</strong>
    </div>
  );
}

function ActivationEvidence(props: { plugin: DeckGoPluginInventoryEntry; t: PluginTranslator }) {
  const hasActivation = props.plugin.activationSource || props.plugin.activationReason;
  return (
    <div className="plugins-panel__surface">
      <p className="plugins-panel__label">{props.t("activation")}</p>
      {hasActivation ? (
        <p className="plugins-panel__note">
          {props.t("activationSource")}: {props.plugin.activationSource || "n/a"} ·{" "}
          {props.t("activationReason")}: {props.plugin.activationReason || "n/a"}
        </p>
      ) : (
        <p className="plugins-panel__note">{props.t("activationUnavailable")}</p>
      )}
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
  const routingChannel = visibleChannels[0];

  return (
    <div className="plugins-panel__surface">
      <p className="plugins-panel__label">{props.t("relatedChannels")}</p>
      <div className="plugins-panel__actions">
        {visibleChannels.length > 0 ? (
          visibleChannels.map((channelId) => (
            <button
              className="plugins-panel__button"
              key={`${props.plugin.id}-${channelId}`}
              type="button"
              onClick={() => props.onOpenChannel(channelId)}
            >
              {props.t("openChannel", { channel: channelId })}
            </button>
          ))
        ) : (
          <span className="plugins-panel__pill is-muted">{props.t("noVisibleChannels")}</span>
        )}
        {routingChannel ? (
          <button
            className="plugins-panel__button"
            type="button"
            onClick={() => props.onOpenRouting(routingChannel)}
          >
            {props.t("openRouting", { channel: routingChannel })}
          </button>
        ) : null}
        {visibleAccessChannels.map((channelId) => (
          <button
            className="plugins-panel__button"
            key={`${props.plugin.id}-${channelId}-access`}
            type="button"
            onClick={() => props.onOpenAccess(channelId)}
          >
            {props.t("openAccess", { channel: channelId })}
          </button>
        ))}
      </div>
      {hiddenChannels.length > 0 ? (
        <p className="plugins-panel__note is-warning">
          {props.t("channelVisibilityWarning", { channels: hiddenChannels.join(", ") })}
        </p>
      ) : null}
    </div>
  );
}

function PluginDiagnostics(props: { plugin: DeckGoPluginInventoryEntry; t: PluginTranslator }) {
  const diagnostics = props.plugin.diagnostics ?? [];
  return (
    <div className="plugins-panel__surface">
      <p className="plugins-panel__label">{props.t("diagnostics")}</p>
      {diagnostics.length === 0 ? (
        <p className="plugins-panel__note">{props.t("noDiagnostics")}</p>
      ) : (
        <div className="plugins-panel__diagnostics">
          {diagnostics.map((diagnostic, index) => (
            <p className="plugins-panel__note" key={`${props.plugin.id}-diagnostic-${index}`}>
              [{diagnostic.level}] {diagnostic.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
