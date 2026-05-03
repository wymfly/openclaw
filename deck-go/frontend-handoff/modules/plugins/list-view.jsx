// plugins — List view
//
// Header strip (KPIs) + toolbar (search + capability + status + source + scope) +
// 7-col rows. Source is the dimension we lead with — bundled vs extension is
// the most diagnostic question for ops on a deck-go install.

const { useMemo: _lvMemo } = React;

const PLUGIN_CAPABILITY_LABELS = {
  channel: "Channel",
  tool: "Tool",
  agent: "Agent",
  provider: "Provider",
};

function pluginStatusPillClass(p) {
  if (!p) return "muted";
  if (p.status === "error") return "err";
  if (p.status === "pending") return "warn";
  if (p.status === "degraded") return "warn";
  if (p.status === "disabled") return "muted";
  return "ok";
}

function pluginStatusLabel(p) {
  if (!p) return "—";
  if (p.status === "error") return "Error";
  if (p.status === "pending") return "Pending";
  if (p.status === "degraded") return "Degraded";
  if (p.status === "disabled") return "Disabled";
  if (p.status === "ready") return "Ready";
  return p.status || "Unknown";
}

function pluginPrimaryCapability(p) {
  const kinds = p?.capabilityKinds || [];
  if (kinds.includes("channel")) return "channel";
  if (kinds.includes("tool")) return "tool";
  if (kinds.includes("agent")) return "agent";
  if (kinds.includes("provider")) return "provider";
  return null;
}

function PluginCapabilityChips({ kinds }) {
  if (!kinds || kinds.length === 0) {
    return <span className="muted small">no capability</span>;
  }
  return (
    <div className="cap-chips">
      {kinds.map((k) => {
        const Icon =
          k === "channel"
            ? IconChannel
            : k === "tool"
              ? IconTool
              : k === "agent"
                ? IconAgent
                : IconProvider;
        return (
          <span key={k} className={`cap-chip cap-chip--${k}`}>
            <Icon /> <span>{PLUGIN_CAPABILITY_LABELS[k] || k}</span>
          </span>
        );
      })}
    </div>
  );
}

function PluginListRow({ plugin, selected, onSelect }) {
  const counts = {
    channels: plugin.channelIds?.length || 0,
    tools: plugin.toolNames?.length || 0,
    providers: plugin.providerIds?.length || 0,
  };
  const errCount = plugin.diagnostics?.filter((d) => d.level === "error").length || 0;
  const warnCount = plugin.diagnostics?.filter((d) => d.level === "warn").length || 0;
  return (
    <div
      className={`row${selected ? " row--selected" : ""}${plugin.enabled ? "" : " row--muted"}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(plugin.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(plugin.id);
        }
      }}
    >
      <div className="row__glyph">
        <PluginGlyph id={plugin.id} name={plugin.name} origin={plugin.origin} size={32} />
      </div>
      <div className="row__id">
        <div className="row__id-name">
          <span className="row__id-title">{plugin.name || plugin.id}</span>
          {plugin.activationSource === "implicit" ? (
            <span className="meta-pill meta-pill--implicit">implicit</span>
          ) : null}
        </div>
        <div className="row__id-meta">
          <span className="kbd kbd--small">{plugin.id}</span>
          <span className="muted">·</span>
          <span>v{plugin.version || "—"}</span>
        </div>
      </div>
      <div className="row__cap">
        <PluginCapabilityChips kinds={plugin.capabilityKinds} />
      </div>
      <div className="row__counts">
        {counts.channels > 0 ? (
          <span className="count">
            <IconChannel /> {counts.channels}
          </span>
        ) : null}
        {counts.tools > 0 ? (
          <span className="count">
            <IconTool /> {counts.tools}
          </span>
        ) : null}
        {counts.providers > 0 ? (
          <span className="count">
            <IconProvider /> {counts.providers}
          </span>
        ) : null}
        {counts.channels === 0 && counts.tools === 0 && counts.providers === 0 ? (
          <span className="muted small">—</span>
        ) : null}
      </div>
      <div className="row__source">
        <span className={`origin-pill origin-pill--${plugin.origin || "unknown"}`}>
          {plugin.origin === "bundled" ? <IconBundled /> : <IconExtension />}
          <span>{plugin.origin || "unknown"}</span>
        </span>
      </div>
      <div className="row__diag">
        {errCount > 0 ? (
          <span className="diag-count diag-count--err">
            <IconErrorCircle /> {errCount}
          </span>
        ) : null}
        {warnCount > 0 ? (
          <span className="diag-count diag-count--warn">
            <IconAlert /> {warnCount}
          </span>
        ) : null}
        {errCount === 0 && warnCount === 0 ? <span className="muted small">clean</span> : null}
      </div>
      <div className="row__status">
        <span className={`pill pill--${pluginStatusPillClass(plugin)}`}>
          {plugin.status === "error" ? <IconErrorCircle /> : null}
          {plugin.status === "pending" || plugin.status === "degraded" ? <IconAlert /> : null}
          {plugin.status === "ready" ? <IconCheck /> : null}
          <span>{pluginStatusLabel(plugin)}</span>
        </span>
      </div>
      <div className="row__chev">
        <IconChevronRight />
      </div>
    </div>
  );
}

function PluginsKpiStrip({ plugins, asOfMs, runtimeId }) {
  const total = plugins.length;
  const ready = plugins.filter((p) => p.status === "ready" && p.activated).length;
  const errored = plugins.filter((p) => p.status === "error").length;
  const channelCount = plugins.filter((p) => (p.capabilityKinds || []).includes("channel")).length;
  const toolCount = plugins.filter((p) => (p.capabilityKinds || []).includes("tool")).length;
  const sinceLabel = new Date(asOfMs || Date.now()).toLocaleTimeString();
  return (
    <div className="kpi-strip">
      <div className="kpi">
        <div className="kpi__label">Plugins</div>
        <div className="kpi__value">{total}</div>
        <div className="kpi__sub">{runtimeId || "deck-runtime"}</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Activated</div>
        <div className="kpi__value">
          {ready}
          <span className="kpi__suffix">/ {total}</span>
        </div>
        <div className="kpi__sub">status=ready &amp; activated</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">With errors</div>
        <div className={`kpi__value${errored > 0 ? " kpi__value--err" : ""}`}>{errored}</div>
        <div className="kpi__sub">requires attention</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Channel-capable</div>
        <div className="kpi__value">{channelCount}</div>
        <div className="kpi__sub">routed by channels</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Tool-capable</div>
        <div className="kpi__value">{toolCount}</div>
        <div className="kpi__sub">exposed to agents</div>
      </div>
      <div className="kpi kpi--ts">
        <div className="kpi__label">As of</div>
        <div className="kpi__value-mono">{sinceLabel}</div>
        <div className="kpi__sub">last describe()</div>
      </div>
    </div>
  );
}

function PluginsToolbar({
  searchQuery,
  filter,
  scope,
  origin,
  onSearch,
  onFilter,
  onScope,
  onOrigin,
  onRefresh,
}) {
  return (
    <div className="toolbar">
      <div className="toolbar__search">
        <IconSearch />
        <input
          type="search"
          placeholder="Search plugins by id, name, capability, channel, tool…"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          aria-label="Search plugins"
        />
        <span className="kbd-hint">⌘K</span>
      </div>
      <div className="toolbar__group">
        <div className="seg" role="tablist" aria-label="Capability filter">
          {[
            { id: "all", label: "All" },
            { id: "channel", label: "Channels" },
            { id: "tool", label: "Tools" },
            { id: "agent", label: "Agents" },
            { id: "provider", label: "Providers" },
          ].map((o) => (
            <button
              key={o.id}
              className={`seg__btn${filter === o.id ? " seg__btn--active" : ""}`}
              type="button"
              role="tab"
              aria-selected={filter === o.id}
              onClick={() => onFilter(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="seg" role="tablist" aria-label="Origin filter">
          {[
            { id: "all", label: "Any source" },
            { id: "bundled", label: "Bundled" },
            { id: "extension", label: "Extension" },
          ].map((o) => (
            <button
              key={o.id}
              className={`seg__btn${origin === o.id ? " seg__btn--active" : ""}`}
              type="button"
              onClick={() => onOrigin(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="seg" role="tablist" aria-label="API scope">
          {[
            { id: "all", label: "scope=all" },
            { id: "channel", label: "scope=channel" },
          ].map((o) => (
            <button
              key={o.id}
              className={`seg__btn${scope === o.id ? " seg__btn--active" : ""}`}
              type="button"
              title={
                o.id === "channel"
                  ? "Default Deck call (capability=channel)"
                  : "capability=all (full inventory)"
              }
              onClick={() => onScope(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="toolbar__actions">
        <button className="btn btn--ghost" type="button" onClick={onRefresh}>
          <IconRefresh /> Refresh
        </button>
      </div>
    </div>
  );
}

function ListView({
  plugins,
  selectedId,
  listState,
  searchQuery,
  filter,
  scope,
  origin,
  asOfMs,
  runtimeId,
  onSearch,
  onFilter,
  onScope,
  onOrigin,
  onSelect,
  onRefresh,
}) {
  const filtered = _lvMemo(() => {
    let xs = plugins;
    if (filter && filter !== "all") {
      xs = xs.filter((p) => (p.capabilityKinds || []).includes(filter));
    }
    if (origin && origin !== "all") {
      xs = xs.filter((p) => p.origin === origin);
    }
    const q = (searchQuery || "").trim().toLowerCase();
    if (q) {
      xs = xs.filter((p) => {
        const hay = [
          p.id,
          p.name,
          p.origin,
          p.activationSource,
          ...(p.capabilityKinds || []),
          ...(p.channelIds || []),
          ...(p.providerIds || []),
          ...(p.toolNames || []),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return xs;
  }, [plugins, filter, searchQuery, origin]);

  return (
    <div className="list-view">
      <header className="page-header">
        <div className="page-header__title">
          <h1>Plugins</h1>
          <p>
            Read-only inventory across bundled extensions and external plugins. Channel routing,
            tool exposure, and runtime activation are derived from{" "}
            <span className="kbd">deck.plugins.list</span>.
          </p>
        </div>
        <div className="page-header__hint">
          <IconKbd /> <span>⌘K</span> search · <span>⌘R</span> refresh
        </div>
      </header>

      <PluginsKpiStrip plugins={plugins} asOfMs={asOfMs} runtimeId={runtimeId} />

      <PluginsToolbar
        searchQuery={searchQuery}
        filter={filter}
        scope={scope}
        origin={origin}
        onSearch={onSearch}
        onFilter={onFilter}
        onScope={onScope}
        onOrigin={onOrigin}
        onRefresh={onRefresh}
      />

      <div className="row-head" role="row" aria-hidden="true">
        <div className="row-head__col row-head__col--glyph"></div>
        <div className="row-head__col">Plugin</div>
        <div className="row-head__col">Capability</div>
        <div className="row-head__col">Exposes</div>
        <div className="row-head__col">Source</div>
        <div className="row-head__col">Diagnostics</div>
        <div className="row-head__col row-head__col--right">Status</div>
        <div className="row-head__col row-head__col--chev"></div>
      </div>

      {listState === "loading" ? (
        <div className="list-state list-state--loading">
          <IconRefresh className="spin" />
          <div>Loading plugin inventory…</div>
        </div>
      ) : listState === "error" ? (
        <div className="list-state list-state--error">
          <IconErrorCircle />
          <div>
            <strong>Failed to load plugin inventory.</strong>
            <p>BFF returned 5xx. Retry or check Gateway logs.</p>
            <button className="btn btn--primary" type="button" onClick={onRefresh}>
              <IconRefresh /> Retry
            </button>
          </div>
        </div>
      ) : listState === "empty" || filtered.length === 0 ? (
        <div className="list-state list-state--empty">
          <IconExtension />
          <div>
            <strong>No plugins match this filter.</strong>
            <p>Try clearing search, switching capability, or expanding scope.</p>
          </div>
        </div>
      ) : (
        <div className="list">
          {filtered.map((p) => (
            <PluginListRow
              key={p.id}
              plugin={p}
              selected={p.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  ListView,
  PluginsKpiStrip,
  PluginsToolbar,
  PluginListRow,
  PluginCapabilityChips,
  pluginStatusLabel,
  pluginStatusPillClass,
  pluginPrimaryCapability,
});
