import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import type {
  DeckGoChannelsStatusResponse,
  DeckGoPluginActionCapabilities,
  DeckGoPluginDiagnostic,
  DeckGoPluginInventoryEntry,
} from "../../../../../contracts/generated/ts/deck-api.generated";
import { type DeckGoPluginCapability } from "../../../api";
import { useChannelsListQuery } from "../../../data/modules/channels";
import { usePluginsListQuery } from "../../../data/modules/plugins";
import {
  navigateToChannel,
  navigateToChannelAccess,
  navigateToRouting,
} from "../../../deck-ui/panel-navigation";
import { useDeckUI } from "../../../deck-ui/ui-store";
import {
  IconAgent,
  IconAlert,
  IconArrowL,
  IconArrowR,
  IconBolt,
  IconBook,
  IconCheck,
  IconCopy,
  IconFile,
  IconInfo,
  IconRefresh,
  IconSearch,
  IconShield,
  IconX,
} from "../../../design-system/icons";
import { useTranslations } from "../../../i18n/provider";
import "./plugins-panel.css";

type PanelState = "idle" | "loading" | "ready";
type PanelView = "list" | "detail";
type DetailTab = "overview" | "capabilities" | "diagnostics" | "activation" | "manifest" | "audit";
type CapabilityFilter = "all" | "channel" | "tool" | "agent" | "provider";
type PluginTranslator = ReturnType<typeof useTranslations>;
type PluginDialog =
  | { kind: "none" }
  | { kind: "diagnostic"; diagnostic: DeckGoPluginDiagnostic }
  | { kind: "manifest" }
  | { kind: "raw" };

const DETAIL_TABS: DetailTab[] = [
  "overview",
  "capabilities",
  "diagnostics",
  "activation",
  "manifest",
  "audit",
];

const CAPABILITY_FILTERS: CapabilityFilter[] = ["all", "channel", "tool", "agent", "provider"];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

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

function pluginSearchText(plugin: DeckGoPluginInventoryEntry) {
  return [
    plugin.id,
    plugin.name,
    plugin.origin,
    plugin.status,
    plugin.version,
    plugin.configPath,
    plugin.activationSource,
    plugin.activationReason,
    ...(plugin.capabilityKinds ?? []),
    ...(plugin.channelIds ?? []),
    ...(plugin.providerIds ?? []),
    ...(plugin.toolNames ?? []),
    ...(plugin.diagnostics?.map((diagnostic) => `${diagnostic.level} ${diagnostic.message}`) ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function statusTone(status: string | undefined) {
  const normalized = status?.toLowerCase();
  if (normalized === "ready" || normalized === "active" || normalized === "loaded") {
    return "ok";
  }
  if (normalized === "error" || normalized === "failed") {
    return "err";
  }
  if (normalized === "degraded" || normalized === "pending" || normalized === "warn") {
    return "warn";
  }
  return "muted";
}

function diagnosticTone(level: string | undefined) {
  const normalized = level?.toLowerCase();
  if (normalized === "error") {
    return "err";
  }
  if (normalized === "warn" || normalized === "warning") {
    return "warn";
  }
  return "info";
}

function diagnosticCounts(plugin: DeckGoPluginInventoryEntry) {
  return (plugin.diagnostics ?? []).reduce(
    (counts, diagnostic) => {
      const tone = diagnosticTone(diagnostic.level);
      if (tone === "err") {
        counts.errors += 1;
      } else if (tone === "warn") {
        counts.warnings += 1;
      }
      return counts;
    },
    { errors: 0, warnings: 0 },
  );
}

function allOrigins(plugins: DeckGoPluginInventoryEntry[], unknownLabel: string) {
  return Array.from(
    new Set(plugins.map((plugin) => plugin.origin?.trim() || unknownLabel)),
  ).toSorted();
}

function syntheticManifest(plugin: DeckGoPluginInventoryEntry) {
  return {
    id: plugin.id,
    name: plugin.name ?? plugin.id,
    version: plugin.version ?? null,
    origin: plugin.origin ?? null,
    capabilityKinds: plugin.capabilityKinds ?? [],
    channelIds: plugin.channelIds ?? [],
    providerIds: plugin.providerIds ?? [],
    toolNames: plugin.toolNames ?? [],
    deckActions: plugin.deckActionCapabilities ?? {},
    note: "No dedicated manifest route exists; this is derived from DeckGoPluginInventoryEntry.",
  };
}

function pluginGlyphLabel(plugin: DeckGoPluginInventoryEntry) {
  return (plugin.name || plugin.id || "P").trim().slice(0, 1).toUpperCase();
}

function countPluginsWithCapability(plugins: DeckGoPluginInventoryEntry[], capability: string) {
  return plugins.filter((plugin) => (plugin.capabilityKinds ?? []).includes(capability)).length;
}

function activatedCount(plugins: DeckGoPluginInventoryEntry[]) {
  return plugins.filter((plugin) => plugin.status === "ready" && plugin.activated !== false).length;
}

function totalDiagnostics(plugins: DeckGoPluginInventoryEntry[]) {
  return plugins.reduce((count, plugin) => count + (plugin.diagnostics?.length ?? 0), 0);
}

export function PluginsPanel() {
  const t = useTranslations("pluginsInventory");
  const tc = useTranslations("common");
  const ui = useDeckUI();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [navigationTarget] = useState(readPluginNavigationTarget);
  const [capability, setCapability] = useState<DeckGoPluginCapability>("channel");
  const [selectedPluginId, setSelectedPluginId] = useState("");
  const [handoffMessage, setHandoffMessage] = useState("");
  const [query, setQuery] = useState("");
  const [originFilter, setOriginFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState<CapabilityFilter>("all");
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [view, setView] = useState<PanelView>("list");
  const [dialog, setDialog] = useState<PluginDialog>({ kind: "none" });
  const pluginsQuery = usePluginsListQuery(capability);
  const channelsQuery = useChannelsListQuery();

  const payload = pluginsQuery.data ?? null;
  const channelsPayload = channelsQuery.data ?? null;
  const plugins = payload?.plugins ?? [];
  const loadState: PanelState = pluginsQuery.isLoading ? "loading" : payload ? "ready" : "idle";
  const error =
    pluginsQuery.error instanceof Error
      ? pluginsQuery.error.message
      : pluginsQuery.error
        ? t("loadFailed")
        : "";

  useEffect(() => {
    const targetId = navigationTarget.pluginId;
    const targetExists = Boolean(targetId && plugins.some((plugin) => plugin.id === targetId));
    setSelectedPluginId((current) => {
      const preferred = targetExists ? targetId : current;
      return preferred && plugins.some((plugin) => plugin.id === preferred)
        ? preferred
        : (plugins[0]?.id ?? "");
    });
  }, [navigationTarget.pluginId, plugins]);

  const refresh = useCallback(() => {
    void pluginsQuery.refetch();
    void channelsQuery.refetch();
  }, [channelsQuery, pluginsQuery]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (meta && event.key.toLowerCase() === "r") {
        event.preventDefault();
        refresh();
      }
      if (event.key === "Escape" && view === "detail" && dialog.kind === "none") {
        event.preventDefault();
        setView("list");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialog.kind, refresh, view]);

  const origins = useMemo(() => allOrigins(plugins, t("unknown")), [plugins, t]);
  const availableChannels = useMemo(() => channelIdSet(channelsPayload), [channelsPayload]);
  const accessChannels = useMemo(() => accessChannelIdSet(channelsPayload), [channelsPayload]);
  const filteredPlugins = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return plugins.filter((plugin) => {
      const origin = plugin.origin?.trim() || t("unknown");
      if (originFilter !== "all" && origin !== originFilter) {
        return false;
      }
      if (kindFilter !== "all" && !(plugin.capabilityKinds ?? []).includes(kindFilter)) {
        return false;
      }
      return needle ? pluginSearchText(plugin).includes(needle) : true;
    });
  }, [kindFilter, originFilter, plugins, query, t]);
  const selectedPlugin = useMemo(
    () =>
      plugins.find((plugin) => plugin.id === selectedPluginId) ??
      filteredPlugins[0] ??
      plugins[0] ??
      null,
    [filteredPlugins, plugins, selectedPluginId],
  );
  const scopeLabel =
    payload?.scope === "channel" ? t("scopeChannel") : (payload?.scope ?? t("unknown"));
  const noRows =
    loadState !== "loading" &&
    (plugins.length === 0 ||
      filteredPlugins.length === 0 ||
      (Boolean(error) && plugins.length === 0));

  const handleScope = (nextCapability: DeckGoPluginCapability) => {
    if (nextCapability !== capability) {
      setCapability(nextCapability);
      setQuery("");
      setOriginFilter("all");
      setKindFilter("all");
      setView("list");
      setDetailTab("overview");
    }
  };

  const openDetail = (pluginId: string) => {
    setSelectedPluginId(pluginId);
    setView("detail");
    setDetailTab("overview");
    setDialog({ kind: "none" });
  };

  return (
    <section className="plugins-panel" data-testid="plugins-panel">
      {view === "detail" && selectedPlugin ? (
        <PluginsDetailView
          accessChannels={accessChannels}
          availableChannels={availableChannels}
          detailTab={detailTab}
          handoffMessage={handoffMessage}
          plugin={selectedPlugin}
          t={t}
          onBack={() => setView("list")}
          onOpenAccess={(channelId) => {
            navigateToChannelAccess(ui, { channelId });
            setHandoffMessage(t("openedAccess", { channel: channelId }));
          }}
          onOpenChannel={(channelId) => {
            navigateToChannel(ui, { channelId });
            setHandoffMessage(t("openedChannel", { channel: channelId }));
          }}
          onOpenDiagnostic={(diagnostic) => setDialog({ kind: "diagnostic", diagnostic })}
          onOpenManifest={() => setDialog({ kind: "manifest" })}
          onOpenRaw={() => setDialog({ kind: "raw" })}
          onOpenRouting={(channelId) => {
            navigateToRouting(ui, { channelId });
            setHandoffMessage(t("openedRouting", { channel: channelId }));
          }}
          onTab={setDetailTab}
        />
      ) : (
        <PluginsListView
          capability={capability}
          error={error}
          filteredPlugins={filteredPlugins}
          kindFilter={kindFilter}
          loadState={loadState}
          noRows={noRows}
          originFilter={originFilter}
          origins={origins}
          plugins={plugins}
          query={query}
          scopeLabel={scopeLabel}
          searchRef={searchRef}
          selectedPluginId={selectedPlugin?.id ?? ""}
          t={t}
          tc={tc}
          onCapabilityFilter={setKindFilter}
          onOpenDetail={openDetail}
          onOriginFilter={setOriginFilter}
          onQuery={setQuery}
          onRefresh={refresh}
          onScope={handleScope}
        />
      )}

      {selectedPlugin ? (
        <PluginDialogs
          dialog={dialog}
          plugin={selectedPlugin}
          t={t}
          onClose={() => setDialog({ kind: "none" })}
        />
      ) : null}
    </section>
  );
}

function PluginsListView(props: {
  capability: DeckGoPluginCapability;
  error: string;
  filteredPlugins: DeckGoPluginInventoryEntry[];
  kindFilter: CapabilityFilter;
  loadState: PanelState;
  noRows: boolean;
  originFilter: string;
  origins: string[];
  plugins: DeckGoPluginInventoryEntry[];
  query: string;
  scopeLabel: string;
  searchRef: RefObject<HTMLInputElement | null>;
  selectedPluginId: string;
  t: PluginTranslator;
  tc: PluginTranslator;
  onCapabilityFilter: (filter: CapabilityFilter) => void;
  onOpenDetail: (pluginId: string) => void;
  onOriginFilter: (origin: string) => void;
  onQuery: (query: string) => void;
  onRefresh: () => void;
  onScope: (capability: DeckGoPluginCapability) => void;
}) {
  const t = props.t;
  return (
    <div className="list-view">
      <header className="page-header">
        <div className="page-header__title">
          <h2>{t("title")}</h2>
          <p>{t("description")}</p>
          <p className="page-header__meta">
            {t("scope")}: {props.scopeLabel}
          </p>
        </div>
        <div className="page-header__hint">{t("keyboardHint")}</div>
      </header>

      <PluginsKpiStrip plugins={props.plugins} t={t} />

      {props.error ? <p className="list-state list-state--error">{props.error}</p> : null}

      <div className="toolbar">
        <label className="toolbar__search">
          <IconSearch size={16} />
          <input
            ref={props.searchRef}
            aria-label={t("search")}
            placeholder={t("searchPlaceholderLong")}
            type="search"
            value={props.query}
            onChange={(event) => props.onQuery(event.target.value)}
          />
          <span className="kbd-hint">{t("searchShortcut")}</span>
        </label>

        <div className="toolbar__group">
          <SegmentedControl
            ariaLabel={t("capabilityFilter")}
            items={CAPABILITY_FILTERS.map((filter) => ({
              id: filter,
              label: t(`capability.${filter}`),
            }))}
            value={props.kindFilter}
            onChange={(value) => props.onCapabilityFilter(value as CapabilityFilter)}
          />
          <SegmentedControl
            ariaLabel={t("origin")}
            items={[
              { id: "all", label: t("allOrigins") },
              ...props.origins.map((origin) => ({ id: origin, label: origin })),
            ]}
            value={props.originFilter}
            onChange={props.onOriginFilter}
          />
          <SegmentedControl
            ariaLabel={t("capabilityScope")}
            items={[
              { id: "all", label: t("scopeAllShort") },
              { id: "channel", label: t("scopeChannelShort") },
            ]}
            value={props.capability}
            onChange={(value) => props.onScope(value as DeckGoPluginCapability)}
          />
        </div>

        <button
          className="btn btn--ghost"
          disabled={props.loadState === "loading"}
          type="button"
          onClick={props.onRefresh}
        >
          <IconRefresh size={15} />
          {t("refresh")}
        </button>
      </div>

      <div className="row-head" role="row" aria-hidden="true">
        <div className="row-head__col row-head__col--glyph" />
        <div className="row-head__col">{t("plugin")}</div>
        <div className="row-head__col">{t("capabilityColumn")}</div>
        <div className="row-head__col">{t("exposes")}</div>
        <div className="row-head__col">{t("source")}</div>
        <div className="row-head__col">{t("diagnostics")}</div>
        <div className="row-head__col row-head__col--right">{t("status")}</div>
        <div className="row-head__col row-head__col--chev" />
      </div>

      {props.loadState === "loading" ? (
        <div className="list-state list-state--loading" aria-live="polite">
          <IconRefresh className="spin" size={18} />
          <div>{props.tc("loading")}</div>
        </div>
      ) : props.noRows ? (
        <div className="list-state list-state--empty" aria-live="polite">
          <IconFile size={22} />
          <div>
            <strong>{t("emptyFilteredTitle")}</strong>
            <p>{props.plugins.length === 0 ? t("empty") : t("emptyFilteredHint")}</p>
          </div>
        </div>
      ) : (
        <div className="list">
          {props.filteredPlugins.map((plugin) => (
            <PluginListRow
              key={plugin.id}
              plugin={plugin}
              selected={plugin.id === props.selectedPluginId}
              t={t}
              onSelect={props.onOpenDetail}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PluginsKpiStrip({
  plugins,
  t,
}: {
  plugins: DeckGoPluginInventoryEntry[];
  t: PluginTranslator;
}) {
  return (
    <div className="kpi-strip">
      <KpiTile label={t("plugins")} sub={t("runtimeInventory")} value={String(plugins.length)} />
      <KpiTile
        label={t("activated")}
        sub={t("statusReadyActivated")}
        value={`${activatedCount(plugins)} / ${plugins.length}`}
      />
      <KpiTile
        label={t("withDiagnostics")}
        sub={t("requiresAttention")}
        tone={totalDiagnostics(plugins) > 0 ? "err" : undefined}
        value={String(totalDiagnostics(plugins))}
      />
      <KpiTile
        label={t("channelCapable")}
        sub={t("routedByChannels")}
        value={String(countPluginsWithCapability(plugins, "channel"))}
      />
      <KpiTile
        label={t("toolCapable")}
        sub={t("exposedToAgents")}
        value={String(countPluginsWithCapability(plugins, "tool"))}
      />
      <KpiTile label={t("asOf")} sub={t("lastDescribe")} value={new Date().toLocaleTimeString()} />
    </div>
  );
}

function KpiTile(props: { label: string; sub: string; tone?: "err"; value: string }) {
  return (
    <div className="kpi">
      <div className="kpi__label">{props.label}</div>
      <div className={`kpi__value${props.tone ? ` kpi__value--${props.tone}` : ""}`}>
        {props.value}
      </div>
      <div className="kpi__sub">{props.sub}</div>
    </div>
  );
}

function SegmentedControl(props: {
  ariaLabel: string;
  items: Array<{ id: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="seg" role="tablist" aria-label={props.ariaLabel}>
      {props.items.map((item) => (
        <button
          key={item.id}
          className={`seg__btn${props.value === item.id ? " seg__btn--active" : ""}`}
          type="button"
          role="tab"
          aria-selected={props.value === item.id}
          onClick={() => props.onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function PluginListRow(props: {
  plugin: DeckGoPluginInventoryEntry;
  selected: boolean;
  t: PluginTranslator;
  onSelect: (pluginId: string) => void;
}) {
  const plugin = props.plugin;
  const counts = {
    channels: plugin.channelIds?.length ?? 0,
    providers: plugin.providerIds?.length ?? 0,
    tools: plugin.toolNames?.length ?? 0,
  };
  const diagnostics = diagnosticCounts(plugin);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      props.onSelect(plugin.id);
    }
  };

  return (
    <div
      className={`row${props.selected ? " row--selected" : ""}${plugin.enabled === false ? " row--muted" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => props.onSelect(plugin.id)}
      onKeyDown={onKeyDown}
    >
      <div className={`plugin-glyph plugin-glyph--${plugin.origin || "unknown"}`}>
        {pluginGlyphLabel(plugin)}
      </div>
      <div className="row__id">
        <div className="row__id-name">
          <span className="row__id-title">{plugin.name || plugin.id}</span>
          {plugin.activationSource === "implicit" ? (
            <span className="meta-pill meta-pill--implicit">{props.t("implicit")}</span>
          ) : null}
        </div>
        <div className="row__id-meta">
          <span className="kbd kbd--small">{plugin.id}</span>
          <span>{props.t("versionPrefix", { version: plugin.version || "n/a" })}</span>
        </div>
      </div>
      <PluginCapabilityChips
        kinds={plugin.capabilityKinds}
        noneLabel={props.t("none")}
        t={props.t}
      />
      <div className="row__counts">
        {counts.channels > 0 ? <CountPill icon="channel" value={counts.channels} /> : null}
        {counts.providers > 0 ? <CountPill icon="provider" value={counts.providers} /> : null}
        {counts.tools > 0 ? <CountPill icon="tool" value={counts.tools} /> : null}
        {counts.channels + counts.providers + counts.tools === 0 ? (
          <span className="muted small">{props.t("none")}</span>
        ) : null}
      </div>
      <span className={`origin-pill origin-pill--${plugin.origin || "unknown"}`}>
        {plugin.origin || props.t("unknown")}
      </span>
      <div className="row__diag">
        {diagnostics.errors > 0 ? (
          <span className="diag-count diag-count--err">
            <IconAlert size={13} />
            {diagnostics.errors}
          </span>
        ) : null}
        {diagnostics.warnings > 0 ? (
          <span className="diag-count diag-count--warn">
            <IconInfo size={13} />
            {diagnostics.warnings}
          </span>
        ) : null}
        {diagnostics.errors + diagnostics.warnings === 0 ? (
          <span className="muted small">{props.t("clean")}</span>
        ) : null}
      </div>
      <span className={`pill pill--${statusTone(plugin.status)}`}>
        {plugin.status || props.t("unknown")}
      </span>
      <div className="row__chev">
        <IconArrowR size={16} />
      </div>
    </div>
  );
}

function PluginCapabilityChips(props: {
  kinds?: string[];
  noneLabel: string;
  t: PluginTranslator;
}) {
  if (!props.kinds?.length) {
    return <span className="muted small">{props.noneLabel}</span>;
  }
  return (
    <div className="cap-chips">
      {props.kinds.map((kind) => (
        <span key={kind} className={`cap-chip cap-chip--${kind}`}>
          {capabilityIcon(kind)}
          <span>{capabilityLabel(kind, props.t)}</span>
        </span>
      ))}
    </div>
  );
}

function capabilityLabel(kind: string, t: PluginTranslator) {
  const key = `capability.${kind}`;
  return t.has(key) ? t(key) : kind;
}

function capabilityIcon(kind: string) {
  if (kind === "channel") {
    return <IconFile size={13} />;
  }
  if (kind === "tool") {
    return <IconBolt size={13} />;
  }
  if (kind === "agent") {
    return <IconAgent size={13} />;
  }
  return <IconShield size={13} />;
}

function CountPill({ icon, value }: { icon: "channel" | "provider" | "tool"; value: number }) {
  return (
    <span className="count">
      {capabilityIcon(icon)}
      {value}
    </span>
  );
}

function PluginsDetailView(props: {
  accessChannels: Set<string>;
  availableChannels: Set<string>;
  detailTab: DetailTab;
  handoffMessage: string;
  plugin: DeckGoPluginInventoryEntry;
  t: PluginTranslator;
  onBack: () => void;
  onOpenAccess: (channelId: string) => void;
  onOpenChannel: (channelId: string) => void;
  onOpenDiagnostic: (diagnostic: DeckGoPluginDiagnostic) => void;
  onOpenManifest: () => void;
  onOpenRaw: () => void;
  onOpenRouting: (channelId: string) => void;
  onTab: (tab: DetailTab) => void;
}) {
  const t = props.t;
  return (
    <div className="detail">
      <header className="hero">
        <button className="back-btn" type="button" onClick={props.onBack}>
          <IconArrowL size={15} />
          {t("backToPlugins")}
        </button>
        <div className="hero__main">
          <div
            className={`plugin-glyph plugin-glyph--large plugin-glyph--${props.plugin.origin || "unknown"}`}
          >
            {pluginGlyphLabel(props.plugin)}
          </div>
          <div className="hero__title-stack">
            <div className="hero__title-row">
              <h2>{props.plugin.name || props.plugin.id}</h2>
              <span className={`pill pill--${statusTone(props.plugin.status)}`}>
                {props.plugin.status || t("unknown")}
              </span>
              <span className={`origin-pill origin-pill--${props.plugin.origin || "unknown"}`}>
                {props.plugin.origin || t("unknown")}
              </span>
            </div>
            <div className="hero__meta">
              <span className="kbd">{props.plugin.id}</span>
              <span>{t("versionPrefix", { version: props.plugin.version || "n/a" })}</span>
              <PluginCapabilityChips
                kinds={props.plugin.capabilityKinds}
                noneLabel={t("none")}
                t={t}
              />
            </div>
          </div>
        </div>
        <div className="hero__actions">
          <button className="btn btn--ghost" type="button" onClick={props.onOpenManifest}>
            <IconBook size={15} />
            {t("manifest")}
          </button>
          <button className="btn btn--ghost" type="button" onClick={props.onOpenRaw}>
            <IconFile size={15} />
            {t("raw")}
          </button>
        </div>
      </header>

      {props.handoffMessage ? <p className="banner banner--info">{props.handoffMessage}</p> : null}

      <div className="tabs" role="tablist" aria-label={t("detailTabs")}>
        {DETAIL_TABS.map((tab) => (
          <button
            key={tab}
            className={`tab${props.detailTab === tab ? " tab--active" : ""}`}
            type="button"
            role="tab"
            aria-selected={props.detailTab === tab}
            onClick={() => props.onTab(tab)}
          >
            {t(`tab.${tab}`)}
          </button>
        ))}
      </div>

      <div className="detail__body">
        {props.detailTab === "overview" ? (
          <OverviewTab
            accessChannels={props.accessChannels}
            availableChannels={props.availableChannels}
            plugin={props.plugin}
            t={t}
            onOpenAccess={props.onOpenAccess}
            onOpenChannel={props.onOpenChannel}
            onOpenRouting={props.onOpenRouting}
          />
        ) : null}
        {props.detailTab === "capabilities" ? (
          <CapabilitiesTab plugin={props.plugin} t={t} />
        ) : null}
        {props.detailTab === "diagnostics" ? (
          <DiagnosticsTab plugin={props.plugin} t={t} onOpenDiagnostic={props.onOpenDiagnostic} />
        ) : null}
        {props.detailTab === "activation" ? <ActivationTab plugin={props.plugin} t={t} /> : null}
        {props.detailTab === "manifest" ? <ManifestTab plugin={props.plugin} t={t} /> : null}
        {props.detailTab === "audit" ? <AuditTab plugin={props.plugin} t={t} /> : null}
      </div>
    </div>
  );
}

function FieldRow(props: { label: string; mono?: boolean; value: ReactNode }) {
  return (
    <div className="field-row">
      <div className="field-row__label">{props.label}</div>
      <div className={`field-row__value${props.mono ? " mono" : ""}`}>{props.value}</div>
    </div>
  );
}

function OverviewTab(props: {
  accessChannels: Set<string>;
  availableChannels: Set<string>;
  plugin: DeckGoPluginInventoryEntry;
  t: PluginTranslator;
  onOpenAccess: (channelId: string) => void;
  onOpenChannel: (channelId: string) => void;
  onOpenRouting: (channelId: string) => void;
}) {
  const t = props.t;
  return (
    <div className="section section--overview">
      <div className="section__head">
        <h3>{t("identity")}</h3>
      </div>
      <div className="field-grid">
        <FieldRow label={t("id")} mono value={props.plugin.id} />
        <FieldRow label={t("name")} value={props.plugin.name || props.plugin.id} />
        <FieldRow label={t("version")} mono value={props.plugin.version || "n/a"} />
        <FieldRow label={t("origin")} value={props.plugin.origin || t("unknown")} />
        <FieldRow label={t("configPath")} mono value={props.plugin.configPath || "n/a"} />
        <FieldRow label={t("activationSource")} value={props.plugin.activationSource || "n/a"} />
      </div>

      <div className="section__head">
        <h3>{t("runtime")}</h3>
      </div>
      <div className="field-grid">
        <FieldRow
          label={t("enabled")}
          value={<StatePill enabled={props.plugin.enabled !== false} t={t} />}
        />
        <FieldRow
          label={t("activated")}
          value={<StatePill enabled={props.plugin.activated !== false} t={t} />}
        />
        <FieldRow
          label={t("explicit")}
          value={props.plugin.explicitlyEnabled ? t("explicit") : t("implicit")}
        />
        <FieldRow
          label={t("imported")}
          value={props.plugin.imported === false ? t("no") : t("yes")}
        />
        <FieldRow label={t("activationReason")} value={props.plugin.activationReason || "n/a"} />
      </div>

      <div className="section__head">
        <h3>{t("capabilitiesAtGlance")}</h3>
      </div>
      <div className="cap-strip">
        <CapabilityTile label={t("channels")} value={props.plugin.channelIds?.length ?? 0} />
        <CapabilityTile label={t("providers")} value={props.plugin.providerIds?.length ?? 0} />
        <CapabilityTile label={t("tools")} value={props.plugin.toolNames?.length ?? 0} />
        <CapabilityTile
          label={t("deckActions")}
          value={Object.values(props.plugin.deckActionCapabilities ?? {}).filter(Boolean).length}
        />
      </div>

      <RelatedChannelActions
        accessChannels={props.accessChannels}
        availableChannels={props.availableChannels}
        plugin={props.plugin}
        t={t}
        onOpenAccess={props.onOpenAccess}
        onOpenChannel={props.onOpenChannel}
        onOpenRouting={props.onOpenRouting}
      />
    </div>
  );
}

function StatePill({ enabled, t }: { enabled: boolean; t: PluginTranslator }) {
  return (
    <span className={`pill pill--${enabled ? "ok" : "muted"}`}>
      {enabled ? <IconCheck size={13} /> : <IconX size={13} />}
      {enabled ? t("yes") : t("no")}
    </span>
  );
}

function CapabilityTile(props: { label: string; value: number }) {
  return (
    <div className="cap-tile">
      <div className="cap-tile__num">{props.value}</div>
      <div className="cap-tile__label">{props.label}</div>
    </div>
  );
}

function CapabilitiesTab(props: { plugin: DeckGoPluginInventoryEntry; t: PluginTranslator }) {
  const t = props.t;
  const noneLabel = t("none");
  const deckActions = props.plugin.deckActionCapabilities ?? {};
  const actionEntries: Array<keyof DeckGoPluginActionCapabilities> = [
    "login",
    "probe",
    "testMessage",
    "qrCodeAuth",
  ];
  return (
    <div className="section section--cap">
      <ChipSection
        icon="channel"
        label={t("channelsExposed")}
        values={props.plugin.channelIds}
        t={t}
      />
      <ChipSection icon="provider" label={t("providers")} values={props.plugin.providerIds} t={t} />
      <ChipSection icon="tool" label={t("toolsExposed")} values={props.plugin.toolNames} t={t} />
      <div className="section__head">
        <h3>{t("deckActions")}</h3>
        <span className="muted small">{t("channelFlowIntegrations")}</span>
      </div>
      <div className="deck-action-grid">
        {actionEntries.map((action) => {
          const enabled = Boolean(deckActions[action]);
          return (
            <div className={`deck-action${enabled ? " is-on" : ""}`} key={action}>
              <div className="deck-action__icon">
                {enabled ? <IconCheck size={15} /> : <IconX size={15} />}
              </div>
              <div className="deck-action__label">{action}</div>
              <div className="deck-action__sub">{enabled ? t("supported") : t("notSupported")}</div>
            </div>
          );
        })}
      </div>
      <div className="banner banner--muted">
        <IconInfo size={15} />
        {t("lifecycleLimit")}: {t("lifecycleLimitDescription")}
      </div>
      <FieldRow
        label={t("capabilities")}
        value={formatList(props.plugin.capabilityKinds, noneLabel)}
      />
      <FieldRow label={t("deckActions")} value={formatDeckActions(deckActions, noneLabel)} />
    </div>
  );
}

function ChipSection(props: {
  icon: "channel" | "provider" | "tool";
  label: string;
  values?: string[];
  t: PluginTranslator;
}) {
  return (
    <>
      <div className="section__head">
        <h3>{props.label}</h3>
        <span className="muted small">{props.values?.length ?? 0}</span>
      </div>
      {props.values?.length ? (
        <div className="chip-list">
          {props.values.map((value) => (
            <span className={`chip-item chip-item--${props.icon}`} key={value}>
              {capabilityIcon(props.icon)}
              {value}
            </span>
          ))}
        </div>
      ) : (
        <div className="empty-block">{props.t("none")}</div>
      )}
    </>
  );
}

function DiagnosticsTab(props: {
  plugin: DeckGoPluginInventoryEntry;
  t: PluginTranslator;
  onOpenDiagnostic: (diagnostic: DeckGoPluginDiagnostic) => void;
}) {
  const diagnostics = props.plugin.diagnostics ?? [];
  if (diagnostics.length === 0) {
    return (
      <div className="section section--diag">
        <div className="empty-block empty-block--ok">
          <IconCheck size={16} />
          <strong>{props.t("noDiagnostics")}</strong>
          <p>{props.t("noDiagnosticsBody")}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="section section--diag">
      <div className="diag-list">
        {diagnostics.map((diagnostic, index) => {
          const tone = diagnosticTone(diagnostic.level);
          return (
            <button
              className={`diag-row diag-row--${tone}`}
              key={`${props.plugin.id}-diagnostic-${index}`}
              type="button"
              onClick={() => props.onOpenDiagnostic(diagnostic)}
            >
              <span className={`pill pill--${tone}`}>{diagnostic.level}</span>
              <span className="diag-row__msg">{diagnostic.message}</span>
              <IconArrowR size={15} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ActivationTab(props: { plugin: DeckGoPluginInventoryEntry; t: PluginTranslator }) {
  const t = props.t;
  const states = [
    {
      key: "imported",
      label: t("imported"),
      hint: t("importedHint"),
      ok: props.plugin.imported !== false || props.plugin.activated !== false,
    },
    {
      key: "enabled",
      label: t("enabled"),
      hint: t("enabledHint"),
      ok: props.plugin.enabled !== false,
    },
    {
      key: "explicit",
      label: t("explicit"),
      hint: t("explicitHint"),
      ok: Boolean(props.plugin.explicitlyEnabled),
    },
    {
      key: "activated",
      label: t("activated"),
      hint: t("activatedHint"),
      ok: props.plugin.activated !== false,
    },
  ];
  return (
    <div className="section section--act">
      <div className="section__head">
        <h3>{t("stateChain")}</h3>
      </div>
      <div className="chain">
        {states.map((state, index) => (
          <div
            className={`chain__node${state.ok ? " chain__node--ok" : " chain__node--off"}`}
            key={state.key}
          >
            <div className="chain__num">{state.ok ? <IconCheck size={14} /> : index + 1}</div>
            <div className="chain__label">{state.label}</div>
            <div className="chain__hint">{state.hint}</div>
          </div>
        ))}
      </div>
      <div className="section__head">
        <h3>{t("sourceAndReason")}</h3>
      </div>
      <div className="field-grid">
        <FieldRow label={t("activationSource")} value={props.plugin.activationSource || "n/a"} />
        <FieldRow label={t("activationReason")} value={props.plugin.activationReason || "n/a"} />
        <FieldRow label={t("configPath")} mono value={props.plugin.configPath || "n/a"} />
      </div>
      <div className="banner banner--info">
        <IconInfo size={15} />
        {t("activationExplanation")}
      </div>
    </div>
  );
}

function ManifestTab(props: { plugin: DeckGoPluginInventoryEntry; t: PluginTranslator }) {
  return (
    <div className="section section--manifest">
      <div className="section__head">
        <h3>{props.t("manifestProjection")}</h3>
      </div>
      <div className="banner banner--muted">
        <IconInfo size={15} />
        {props.t("manifestProjectionDescription")}
      </div>
      <JsonCode value={syntheticManifest(props.plugin)} />
    </div>
  );
}

function AuditTab(props: { plugin: DeckGoPluginInventoryEntry; t: PluginTranslator }) {
  const hasActivation = props.plugin.activationSource || props.plugin.activationReason;
  return (
    <div className="section section--audit">
      <div className="section__head">
        <h3>{props.t("activationAudit")}</h3>
        <span className="muted small">{props.t("projectionOnly")}</span>
      </div>
      {hasActivation ? (
        <div className="timeline">
          <div className="timeline__row timeline__row--activated">
            <div className="timeline__dot" />
            <div className="timeline__main">
              <div className="timeline__title">
                <span className="event-pill event-pill--activated">
                  {props.plugin.activationSource || props.t("unknown")}
                </span>
              </div>
              <div className="timeline__note">
                {props.plugin.activationReason || props.t("activationUnavailable")}
              </div>
            </div>
            <div className="timeline__ts">{props.t("inventorySnapshot")}</div>
          </div>
        </div>
      ) : (
        <div className="empty-block">{props.t("noActivationAudit")}</div>
      )}
      <div className="banner banner--muted">
        <IconInfo size={15} />
        {props.t("auditProjectionDescription")}
      </div>
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
    return (
      <div className="banner banner--muted">
        <IconInfo size={15} />
        {props.t("noRelatedChannels")}
      </div>
    );
  }
  const visibleChannels = channelIds.filter((channelId) => props.availableChannels.has(channelId));
  const hiddenChannels = channelIds.filter((channelId) => !props.availableChannels.has(channelId));
  const visibleAccessChannels = visibleChannels.filter((channelId) =>
    props.accessChannels.has(channelId),
  );
  const routingChannel = visibleChannels[0];
  return (
    <div className="section">
      <div className="section__head">
        <h3>{props.t("relatedChannels")}</h3>
      </div>
      <div className="actions">
        {visibleChannels.length > 0 ? (
          visibleChannels.map((channelId) => (
            <button
              className="btn btn--ghost"
              key={`${props.plugin.id}-${channelId}`}
              type="button"
              onClick={() => props.onOpenChannel(channelId)}
            >
              {props.t("openChannel", { channel: channelId })}
            </button>
          ))
        ) : (
          <span className="pill pill--muted">{props.t("noVisibleChannels")}</span>
        )}
        {routingChannel ? (
          <button
            className="btn btn--ghost"
            type="button"
            onClick={() => props.onOpenRouting(routingChannel)}
          >
            {props.t("openRouting", { channel: routingChannel })}
          </button>
        ) : null}
        {visibleAccessChannels.map((channelId) => (
          <button
            className="btn btn--ghost"
            key={`${props.plugin.id}-${channelId}-access`}
            type="button"
            onClick={() => props.onOpenAccess(channelId)}
          >
            {props.t("openAccess", { channel: channelId })}
          </button>
        ))}
      </div>
      {hiddenChannels.length > 0 ? (
        <p className="banner banner--warn">
          {props.t("channelVisibilityWarning", { channels: hiddenChannels.join(", ") })}
        </p>
      ) : null}
    </div>
  );
}

function JsonCode({ value }: { value: unknown }) {
  return (
    <pre className="code-block">
      <code>{JSON.stringify(value, null, 2)}</code>
    </pre>
  );
}

function PluginDialogs(props: {
  dialog: PluginDialog;
  plugin: DeckGoPluginInventoryEntry;
  t: PluginTranslator;
  onClose: () => void;
}) {
  if (props.dialog.kind === "none") {
    return null;
  }
  if (props.dialog.kind === "diagnostic") {
    return (
      <DiagnosticDialog
        diagnostic={props.dialog.diagnostic}
        plugin={props.plugin}
        t={props.t}
        onClose={props.onClose}
      />
    );
  }
  if (props.dialog.kind === "manifest") {
    return (
      <JsonDialog
        label={props.t("manifestPreview")}
        value={syntheticManifest(props.plugin)}
        t={props.t}
        onClose={props.onClose}
      />
    );
  }
  return (
    <JsonDialog
      label={props.t("rawInventoryEntry")}
      value={props.plugin}
      t={props.t}
      onClose={props.onClose}
    />
  );
}

function DiagnosticDialog(props: {
  diagnostic: DeckGoPluginDiagnostic;
  plugin: DeckGoPluginInventoryEntry;
  t: PluginTranslator;
  onClose: () => void;
}) {
  const tone = diagnosticTone(props.diagnostic.level);
  const hint =
    tone === "err"
      ? props.t("diagRemediationError")
      : tone === "warn"
        ? props.t("diagRemediationWarn")
        : props.t("diagRemediationInfo");
  return (
    <div className="modal-backdrop" role="presentation" onClick={props.onClose}>
      <div
        className="modal modal--diag"
        role="dialog"
        aria-modal="true"
        aria-label={props.t("diagnosticDetail")}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__head">
          <span className={`pill pill--${tone}`}>{props.diagnostic.level}</span>
          <span className="modal__label">{props.t("diagnosticDetail")}</span>
          <h3>{props.plugin.name || props.plugin.id}</h3>
          <button
            className="icon-btn"
            type="button"
            aria-label={props.t("close")}
            onClick={props.onClose}
          >
            <IconX size={16} />
          </button>
        </div>
        <div className="modal__body">
          <FieldRow label={props.t("message")} value={props.diagnostic.message} />
          <FieldRow
            label={props.t("source")}
            value={`${props.plugin.id} / ${props.plugin.version || "n/a"} / ${props.plugin.origin || props.t("unknown")}`}
          />
          <FieldRow label={props.t("remediationHint")} value={hint} />
        </div>
        <div className="modal__foot">
          <button className="btn btn--ghost" type="button" onClick={props.onClose}>
            {props.t("close")}
          </button>
          <button className="btn btn--primary" type="button" onClick={props.onClose}>
            <IconRefresh size={15} />
            {props.t("recheckNextSync")}
          </button>
        </div>
      </div>
    </div>
  );
}

function JsonDialog(props: {
  label: string;
  value: unknown;
  t: PluginTranslator;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(props.value, null, 2);
  const copy = async () => {
    await navigator.clipboard?.writeText(json).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div className="modal-backdrop" role="presentation" onClick={props.onClose}>
      <div
        className="modal modal--raw"
        role="dialog"
        aria-modal="true"
        aria-label={props.label}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__head">
          <span className="pill pill--info">{props.label}</span>
          <button
            className="icon-btn"
            type="button"
            aria-label={props.t("close")}
            onClick={props.onClose}
          >
            <IconX size={16} />
          </button>
        </div>
        <div className="modal__body modal__body--code">
          <div className="banner banner--muted">
            <IconInfo size={15} />
            {props.t("manifestFallbackNotice")}
          </div>
          <JsonCode value={props.value} />
        </div>
        <div className="modal__foot">
          <button className="btn btn--ghost" type="button" onClick={() => void copy()}>
            <IconCopy size={15} />
            {copied ? props.t("copied") : props.t("copyJson")}
          </button>
          <button className="btn btn--primary" type="button" onClick={props.onClose}>
            {props.t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
