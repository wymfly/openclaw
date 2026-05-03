// plugins — Detail view
//
// Hero (glyph + name + version + status + actions) + 6 tabs:
//   1. Overview     — identity, runtime activation, capability summary
//   2. Capabilities — channels / providers / tools / deck-actions
//   3. Diagnostics  — error / warn / info entries with severity grouping
//   4. Activation   — state machine (imported × enabled × activated × explicit)
//   5. Manifest     — projected manifest preview (BFF) with raw entry fallback
//   6. Audit        — activation timeline (BFF projection over config history)

const { useMemo: _dvMemo } = React;

const PLUGIN_TABS = [
  { id: "overview", label: "Overview" },
  { id: "capabilities", label: "Capabilities" },
  { id: "diagnostics", label: "Diagnostics" },
  { id: "activation", label: "Activation" },
  { id: "manifest", label: "Manifest" },
  { id: "audit", label: "Audit" },
];

function fmtRelative(ms, nowMs) {
  if (!ms) return "—";
  const now = nowMs || Date.now();
  const dt = (now - ms) / 1000;
  if (dt < 60) return `${Math.round(dt)}s ago`;
  if (dt < 3600) return `${Math.round(dt / 60)}m ago`;
  if (dt < 86400) return `${Math.round(dt / 3600)}h ago`;
  return `${Math.round(dt / 86400)}d ago`;
}

function fmtClock(ms) {
  if (!ms) return "—";
  return new Date(ms).toLocaleTimeString();
}

function DetailHero({ plugin, onBack, onViewRaw, onViewManifest }) {
  return (
    <div className="hero">
      <button className="back-btn" type="button" onClick={onBack} aria-label="Back to list">
        <IconChevronLeft /> <span>Plugins</span>
      </button>
      <div className="hero__main">
        <PluginGlyph id={plugin.id} name={plugin.name} origin={plugin.origin} size={56} />
        <div className="hero__title-stack">
          <div className="hero__title-row">
            <h1>{plugin.name || plugin.id}</h1>
            <span className={`pill pill--${pluginStatusPillClass(plugin)}`}>
              {plugin.status === "error" ? <IconErrorCircle /> : null}
              {plugin.status === "pending" || plugin.status === "degraded" ? <IconAlert /> : null}
              {plugin.status === "ready" ? <IconCheck /> : null}
              <span>{pluginStatusLabel(plugin)}</span>
            </span>
            <span className={`origin-pill origin-pill--${plugin.origin || "unknown"}`}>
              {plugin.origin === "bundled" ? <IconBundled /> : <IconExtension />}
              <span>{plugin.origin || "unknown"}</span>
            </span>
          </div>
          <div className="hero__meta">
            <span className="kbd">{plugin.id}</span>
            <span className="muted">·</span>
            <span>v{plugin.version || "—"}</span>
            <span className="muted">·</span>
            <PluginCapabilityChips kinds={plugin.capabilityKinds} />
          </div>
        </div>
      </div>
      <div className="hero__actions">
        <button className="btn btn--ghost" type="button" onClick={onViewManifest}>
          <IconBookOpen /> Manifest
        </button>
        <button className="btn btn--ghost" type="button" onClick={onViewRaw}>
          <IconCode /> Raw
        </button>
      </div>
    </div>
  );
}

function TabsBar({ activeTab, onTab }) {
  return (
    <div className="tabs" role="tablist" aria-label="Plugin sections">
      {PLUGIN_TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={activeTab === t.id}
          className={`tab${activeTab === t.id ? " tab--active" : ""}`}
          onClick={() => onTab(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function FieldRow({ label, value, mono, muted }) {
  return (
    <div className="field-row">
      <div className="field-row__label">{label}</div>
      <div className={`field-row__value${mono ? " mono" : ""}${muted ? " muted" : ""}`}>
        {value == null || value === "" ? <span className="muted">—</span> : value}
      </div>
    </div>
  );
}

function TabOverview({ plugin }) {
  return (
    <div className="section section--overview">
      <div className="section__head">
        <h2>Identity</h2>
      </div>
      <div className="field-grid">
        <FieldRow label="ID" value={plugin.id} mono />
        <FieldRow label="Name" value={plugin.name} />
        <FieldRow label="Version" value={`v${plugin.version || "unknown"}`} mono />
        <FieldRow label="Origin" value={plugin.origin || "unknown"} />
        <FieldRow label="Config path" value={plugin.configPath} mono />
        <FieldRow label="Activation source" value={plugin.activationSource || "—"} />
      </div>

      <div className="section__head">
        <h2>Runtime</h2>
      </div>
      <div className="field-grid">
        <FieldRow
          label="Enabled"
          value={
            <span className={`pill pill--${plugin.enabled ? "ok" : "muted"}`}>
              {plugin.enabled ? <IconCheck /> : <IconX />}
              <span>{plugin.enabled ? "Yes" : "No"}</span>
            </span>
          }
        />
        <FieldRow
          label="Activated"
          value={
            <span className={`pill pill--${plugin.activated ? "ok" : "muted"}`}>
              {plugin.activated ? <IconCheck /> : <IconX />}
              <span>{plugin.activated ? "Yes" : "No"}</span>
            </span>
          }
        />
        <FieldRow
          label="Explicit"
          value={
            <span className={`pill pill--${plugin.explicitlyEnabled ? "info" : "muted"}`}>
              {plugin.explicitlyEnabled ? "explicit" : "implicit"}
            </span>
          }
        />
        <FieldRow
          label="Imported"
          value={
            <span className={`pill pill--${plugin.imported ? "info" : "muted"}`}>
              {plugin.imported ? "yes" : "no"}
            </span>
          }
        />
        <FieldRow label="Reason" value={plugin.activationReason} />
      </div>

      <div className="section__head">
        <h2>Capabilities at a glance</h2>
      </div>
      <div className="cap-strip">
        <div className="cap-tile">
          <div className="cap-tile__icon">
            <IconChannel />
          </div>
          <div className="cap-tile__num">{plugin.channelIds?.length || 0}</div>
          <div className="cap-tile__label">Channels</div>
        </div>
        <div className="cap-tile">
          <div className="cap-tile__icon">
            <IconProvider />
          </div>
          <div className="cap-tile__num">{plugin.providerIds?.length || 0}</div>
          <div className="cap-tile__label">Providers</div>
        </div>
        <div className="cap-tile">
          <div className="cap-tile__icon">
            <IconTool />
          </div>
          <div className="cap-tile__num">{plugin.toolNames?.length || 0}</div>
          <div className="cap-tile__label">Tools</div>
        </div>
        <div className="cap-tile">
          <div className="cap-tile__icon">
            <IconShield />
          </div>
          <div className="cap-tile__num">
            {Object.values(plugin.deckActionCapabilities || {}).filter(Boolean).length}
          </div>
          <div className="cap-tile__label">Deck actions</div>
        </div>
      </div>
    </div>
  );
}

function TabCapabilities({ plugin }) {
  const channels = plugin.channelIds || [];
  const providers = plugin.providerIds || [];
  const tools = plugin.toolNames || [];
  const deckActions = plugin.deckActionCapabilities || {};
  const deckActionEntries = [
    { key: "login", label: "Login" },
    { key: "probe", label: "Probe" },
    { key: "testMessage", label: "Test message" },
    { key: "qrCodeAuth", label: "QR-code auth" },
  ];
  return (
    <div className="section section--cap">
      <div className="section__head">
        <h2>
          <IconChannel /> Channels exposed
        </h2>
        <span className="muted small">{channels.length} ids</span>
      </div>
      {channels.length === 0 ? (
        <div className="empty-block">No channels exposed by this plugin.</div>
      ) : (
        <div className="chip-list">
          {channels.map((c) => (
            <span key={c} className="chip-item chip-item--channel">
              <IconChannel /> {c}
            </span>
          ))}
        </div>
      )}

      <div className="section__head">
        <h2>
          <IconProvider /> Providers
        </h2>
        <span className="muted small">{providers.length} ids</span>
      </div>
      {providers.length === 0 ? (
        <div className="empty-block">No providers registered.</div>
      ) : (
        <div className="chip-list">
          {providers.map((p) => (
            <span key={p} className="chip-item chip-item--provider">
              <IconProvider /> {p}
            </span>
          ))}
        </div>
      )}

      <div className="section__head">
        <h2>
          <IconTool /> Tools exposed
        </h2>
        <span className="muted small">{tools.length} names</span>
      </div>
      {tools.length === 0 ? (
        <div className="empty-block">No tools exposed by this plugin.</div>
      ) : (
        <div className="tool-table">
          {tools.map((t) => (
            <div key={t} className="tool-row">
              <code className="mono">{t}</code>
              <span className="muted small">callable from agents</span>
            </div>
          ))}
        </div>
      )}

      <div className="section__head">
        <h2>
          <IconShield /> Deck-action capabilities
        </h2>
        <span className="muted small">channel-flow integrations</span>
      </div>
      <div className="deck-action-grid">
        {deckActionEntries.map((e) => {
          const ok = !!deckActions[e.key];
          return (
            <div key={e.key} className={`deck-action${ok ? " is-on" : ""}`}>
              <div className="deck-action__icon">{ok ? <IconCheck /> : <IconX />}</div>
              <div className="deck-action__label">{e.label}</div>
              <div className="deck-action__sub">{ok ? "supported" : "not supported"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TabDiagnostics({ plugin, onOpenDiagnostic }) {
  const diags = plugin.diagnostics || [];
  const grouped = _dvMemo(() => {
    const e = { error: [], warn: [], info: [] };
    diags.forEach((d) => {
      (e[d.level] || (e[d.level] = [])).push(d);
    });
    return e;
  }, [diags]);

  if (diags.length === 0) {
    return (
      <div className="section section--diag">
        <div className="empty-block empty-block--ok">
          <IconCheck /> <strong>No diagnostics reported.</strong>
          <p>Plugin reports a clean state to Gateway.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="section section--diag">
      {["error", "warn", "info"].map((level) =>
        grouped[level] && grouped[level].length > 0 ? (
          <div key={level} className={`diag-group diag-group--${level}`}>
            <div className="section__head">
              <h2>
                {level === "error" ? (
                  <IconErrorCircle />
                ) : level === "warn" ? (
                  <IconAlert />
                ) : (
                  <IconInfo />
                )}
                <span>
                  {level.charAt(0).toUpperCase() + level.slice(1)} ({grouped[level].length})
                </span>
              </h2>
            </div>
            <div className="diag-list">
              {grouped[level].map((d, i) => (
                <button
                  key={`${level}-${i}`}
                  className={`diag-row diag-row--${level}`}
                  type="button"
                  onClick={() => onOpenDiagnostic(d)}
                >
                  <span className={`pill pill--${level}`}>{level.toUpperCase()}</span>
                  <span className="diag-row__msg">{d.message}</span>
                  <IconChevronRight />
                </button>
              ))}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}

function TabActivation({ plugin }) {
  const states = [
    {
      key: "imported",
      label: "Imported",
      hint: "Plugin manifest discovered by Gateway loader",
      ok: !!plugin.imported || !!plugin.activated,
    },
    {
      key: "enabled",
      label: "Enabled",
      hint: "Configuration permits activation",
      ok: !!plugin.enabled,
    },
    {
      key: "explicit",
      label: "Explicit",
      hint: "Operator explicitly switched it on (vs implicit auto-activation)",
      ok: !!plugin.explicitlyEnabled,
    },
    {
      key: "activated",
      label: "Activated",
      hint: "Runtime registered the plugin and exposed its capabilities",
      ok: !!plugin.activated,
    },
  ];
  return (
    <div className="section section--act">
      <div className="section__head">
        <h2>State chain</h2>
      </div>
      <div className="chain">
        {states.map((s, i) => (
          <React.Fragment key={s.key}>
            <div className={`chain__node${s.ok ? " chain__node--ok" : " chain__node--off"}`}>
              <div className="chain__num">{s.ok ? <IconCheck /> : <span>{i + 1}</span>}</div>
              <div className="chain__label">{s.label}</div>
              <div className="chain__hint">{s.hint}</div>
            </div>
            {i < states.length - 1 ? <div className="chain__edge" /> : null}
          </React.Fragment>
        ))}
      </div>

      <div className="section__head">
        <h2>Source &amp; reason</h2>
      </div>
      <div className="field-grid">
        <FieldRow label="Activation source" value={plugin.activationSource} />
        <FieldRow label="Reason" value={plugin.activationReason} />
        <FieldRow label="Config path" value={plugin.configPath} mono />
      </div>

      <div className="banner banner--info">
        <IconInfo />
        <div>
          <strong>How activation is decided.</strong> Gateway resolves explicit config first (
          <span className="kbd">openclaw.json plugins.entries</span>), then implicit defaults, then
          extension-driven activation. The Deck inventory API surfaces the resolved decision but
          does not let you mutate it.
        </div>
      </div>
    </div>
  );
}

function TabManifest({ plugin, manifest, onOpen }) {
  const has = !!manifest;
  return (
    <div className="section section--manifest">
      <div className="section__head">
        <h2>Manifest projection</h2>
        <button className="btn btn--ghost" type="button" onClick={onOpen}>
          <IconBookOpen /> Open full
        </button>
      </div>
      {!has ? (
        <div className="banner banner--muted">
          <IconInfo />
          <div>
            <strong>No projected manifest available for this plugin.</strong>
            <p>
              The Deck inventory API does not expose raw manifests. BFF can project richer fields
              for selected plugins (bundled core + curated extensions). Falling back to inventory
              fields below.
            </p>
          </div>
        </div>
      ) : null}
      <div className="manifest-summary">
        <FieldRow label="ID" value={manifest?.id || plugin.id} mono />
        <FieldRow label="Author" value={manifest?.author || "—"} />
        <FieldRow label="Runtime · node" value={manifest?.runtime?.node || ">=22.14.0"} mono />
        <FieldRow label="Runtime · entry" value={manifest?.runtime?.bin || "—"} mono />
        <FieldRow
          label="Permissions"
          value={
            manifest?.permissions ? (
              <div className="chip-list">
                {manifest.permissions.map((p) => (
                  <span key={p} className="chip-item chip-item--perm">
                    <IconShield /> {p}
                  </span>
                ))}
              </div>
            ) : (
              "BFF projection only"
            )
          }
        />
        <FieldRow
          label="Config schema"
          value={
            manifest?.configSchema?.$ref ? (
              <code className="mono">{manifest.configSchema.$ref}</code>
            ) : (
              "—"
            )
          }
        />
      </div>
    </div>
  );
}

function TabAudit({ timeline }) {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="section section--audit">
        <div className="empty-block">
          <IconClock /> No activation audit projected for this plugin yet.
        </div>
      </div>
    );
  }
  const sorted = [...timeline].sort((a, b) => b.ts - a.ts);
  return (
    <div className="section section--audit">
      <div className="section__head">
        <h2>Activation timeline</h2>
        <span className="muted small">{timeline.length} events · BFF projection</span>
      </div>
      <div className="timeline">
        {sorted.map((ev, i) => (
          <div key={i} className={`timeline__row timeline__row--${ev.event}`}>
            <div className="timeline__dot" />
            <div className="timeline__main">
              <div className="timeline__title">
                <span className={`event-pill event-pill--${ev.event}`}>{ev.event}</span>
                <span className="muted small">{ev.actor}</span>
              </div>
              <div className="timeline__note">{ev.note}</div>
            </div>
            <div className="timeline__ts">
              <div className="mono">{fmtClock(ev.ts)}</div>
              <div className="muted small">{fmtRelative(ev.ts)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailView({
  plugin,
  manifest,
  timeline,
  tweaks,
  setTweak,
  onBack,
  onViewRaw,
  onViewManifest,
  onOpenDiagnostic,
}) {
  if (tweaks.detailState === "loading") {
    return (
      <div className="detail">
        <DetailHero
          plugin={plugin}
          onBack={onBack}
          onViewRaw={onViewRaw}
          onViewManifest={onViewManifest}
        />
        <div className="list-state list-state--loading">
          <IconRefresh className="spin" />
          <div>Loading plugin detail…</div>
        </div>
      </div>
    );
  }
  if (tweaks.detailState === "error") {
    return (
      <div className="detail">
        <DetailHero
          plugin={plugin}
          onBack={onBack}
          onViewRaw={onViewRaw}
          onViewManifest={onViewManifest}
        />
        <div className="list-state list-state--error">
          <IconErrorCircle />
          <div>
            <strong>Failed to load detail.</strong>
            <p>BFF projection unavailable. Inventory row still cached.</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="detail">
      <DetailHero
        plugin={plugin}
        onBack={onBack}
        onViewRaw={onViewRaw}
        onViewManifest={onViewManifest}
      />
      <TabsBar activeTab={tweaks.activeTab} onTab={(v) => setTweak("activeTab", v)} />
      <div className="detail__body">
        {tweaks.activeTab === "overview" ? <TabOverview plugin={plugin} /> : null}
        {tweaks.activeTab === "capabilities" ? <TabCapabilities plugin={plugin} /> : null}
        {tweaks.activeTab === "diagnostics" ? (
          <TabDiagnostics plugin={plugin} onOpenDiagnostic={onOpenDiagnostic} />
        ) : null}
        {tweaks.activeTab === "activation" ? <TabActivation plugin={plugin} /> : null}
        {tweaks.activeTab === "manifest" ? (
          <TabManifest plugin={plugin} manifest={manifest} onOpen={onViewManifest} />
        ) : null}
        {tweaks.activeTab === "audit" ? <TabAudit timeline={timeline} /> : null}
      </div>
    </div>
  );
}

Object.assign(window, {
  DetailView,
  DetailHero,
  TabsBar,
  TabOverview,
  TabCapabilities,
  TabDiagnostics,
  TabActivation,
  TabManifest,
  TabAudit,
  PLUGIN_TABS,
});
