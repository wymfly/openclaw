// skills — List view
//
// Two modes (toggle on the toolbar):
//   - "installed" → DeckGoSkillsResponse inventory (default)
//   - "hub"       → DeckGoSkillHubSearchResponse marketplace search

const { useMemo: _lvMemo } = React;

function skillStatusPillClass(s) {
  if (!s) return "muted";
  if (s.status === "ready") return "ok";
  if (s.status === "needs-setup") return "warn";
  if (s.status === "disabled") return "muted";
  return "info";
}

function skillStatusLabel(s) {
  if (!s) return "—";
  if (s.status === "ready") return "Ready";
  if (s.status === "needs-setup") return "Needs setup";
  if (s.status === "disabled") return "Disabled";
  return s.status;
}

function SkillSourcePill({ source }) {
  const Icon = source === "bundled" ? IconBox : source === "managed" ? IconCloud : IconPuzzle;
  return (
    <span className={`source-pill source-pill--${source}`}>
      <Icon /> <span>{source}</span>
    </span>
  );
}

function InstalledRow({ skill, selected, onSelect }) {
  const reqCount = skill.missingRequirements?.length || 0;
  const cfgCount = Object.keys(skill.config || {}).length;
  return (
    <div
      className={`row${selected ? " row--selected" : ""}${skill.enabled ? "" : " row--muted"}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(skill.key)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(skill.key);
        }
      }}
    >
      <div className="row__glyph">
        <SkillGlyph skill={skill} size={32} />
      </div>
      <div className="row__id">
        <div className="row__id-name">
          <span className="row__id-title">{skill.name}</span>
          {!skill.enabled ? <span className="meta-pill meta-pill--off">off</span> : null}
        </div>
        <div className="row__id-meta">
          <span className="kbd kbd--small">{skill.key}</span>
          {skill.primaryEnv ? (
            <>
              <span className="muted">·</span>
              <span className="env-tag">
                <IconKey /> {skill.primaryEnv}
              </span>
            </>
          ) : null}
        </div>
      </div>
      <div className="row__desc">
        {skill.description ? (
          <span className="row__desc-text">{skill.description}</span>
        ) : (
          <span className="muted small">no description</span>
        )}
      </div>
      <div className="row__source">
        <SkillSourcePill source={skill.source} />
      </div>
      <div className="row__bins">
        {cfgCount > 0 ? (
          <span className="count">
            <IconSettings /> {cfgCount}
          </span>
        ) : (
          <span className="muted small">—</span>
        )}
      </div>
      <div className="row__req">
        {reqCount > 0 ? (
          <span className="diag-count diag-count--warn">
            <IconAlert /> {reqCount}
          </span>
        ) : (
          <span className="muted small">clean</span>
        )}
      </div>
      <div className="row__status">
        <span className={`pill pill--${skillStatusPillClass(skill)}`}>
          {skill.status === "ready" ? <IconCheck /> : null}
          {skill.status === "needs-setup" ? <IconAlert /> : null}
          {skill.status === "disabled" ? <IconX /> : null}
          <span>{skillStatusLabel(skill)}</span>
        </span>
      </div>
      <div className="row__chev">
        <IconChevronRight />
      </div>
    </div>
  );
}

function HubResultRow({ result, onInstall, onPreview }) {
  return (
    <div className="hub-row">
      <div className="hub-row__main">
        <div className="hub-row__title">
          <span className="hub-row__name">{result.displayName}</span>
          <span className="kbd kbd--small">{result.slug}</span>
          <span className="muted small">v{result.version}</span>
        </div>
        <p className="hub-row__summary">{result.summary}</p>
        <div className="hub-row__meta">
          <span className="hub-row__score">
            <IconHash /> score {result.score?.toFixed(2)}
          </span>
          <span className="muted">·</span>
          <span>updated {fmtRelativeMs(result.updatedAt)}</span>
        </div>
      </div>
      <div className="hub-row__actions">
        <button className="btn btn--ghost" type="button" onClick={() => onPreview(result.slug)}>
          <IconBookOpen /> Preview
        </button>
        <button className="btn btn--primary" type="button" onClick={() => onInstall(result.slug)}>
          <IconDownload /> Install
        </button>
      </div>
    </div>
  );
}

function fmtRelativeMs(ms, nowMs) {
  if (!ms) return "—";
  const now = nowMs || Date.now();
  const dt = (now - ms) / 1000;
  if (dt < 60) return `${Math.round(dt)}s ago`;
  if (dt < 3600) return `${Math.round(dt / 60)}m ago`;
  if (dt < 86400) return `${Math.round(dt / 3600)}h ago`;
  return `${Math.round(dt / 86400)}d ago`;
}

function SkillsKpiStrip({ installed, hubCount, asOfMs, runtimeId }) {
  const total = installed.length;
  const ready = installed.filter((s) => s.status === "ready" && s.enabled).length;
  const needsSetup = installed.filter((s) => s.status === "needs-setup").length;
  const managed = installed.filter((s) => s.source === "managed").length;
  const sinceLabel = new Date(asOfMs || Date.now()).toLocaleTimeString();
  return (
    <div className="kpi-strip">
      <div className="kpi">
        <div className="kpi__label">Installed</div>
        <div className="kpi__value">{total}</div>
        <div className="kpi__sub">{runtimeId || "deck-runtime"}</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Ready</div>
        <div className="kpi__value">
          {ready}
          <span className="kpi__suffix">/ {total}</span>
        </div>
        <div className="kpi__sub">enabled &amp; healthy</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Needs setup</div>
        <div className={`kpi__value${needsSetup > 0 ? " kpi__value--warn" : ""}`}>{needsSetup}</div>
        <div className="kpi__sub">missing requirements</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Managed</div>
        <div className="kpi__value">{managed}</div>
        <div className="kpi__sub">from hub</div>
      </div>
      <div className="kpi">
        <div className="kpi__label">Hub</div>
        <div className="kpi__value">{hubCount}</div>
        <div className="kpi__sub">searchable today</div>
      </div>
      <div className="kpi kpi--ts">
        <div className="kpi__label">As of</div>
        <div className="kpi__value-mono">{sinceLabel}</div>
        <div className="kpi__sub">last sync</div>
      </div>
    </div>
  );
}

function SkillsToolbar({
  mode,
  searchQuery,
  filter,
  source,
  onMode,
  onSearch,
  onFilter,
  onSource,
  onRefresh,
}) {
  return (
    <div className="toolbar">
      <div className="toolbar__search">
        <IconSearch />
        <input
          type="search"
          placeholder={
            mode === "installed"
              ? "Search installed skills by name, key, description, env…"
              : "Search hub: skill name, summary, owner…"
          }
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          aria-label="Search skills"
        />
        <span className="kbd-hint">⌘K</span>
      </div>
      <div className="toolbar__group">
        <div className="seg" role="tablist" aria-label="Mode">
          {[
            { id: "installed", label: "Installed", icon: IconBox },
            { id: "hub", label: "Hub", icon: IconCloud },
          ].map((o) => {
            const Icon = o.icon;
            return (
              <button
                key={o.id}
                className={`seg__btn${mode === o.id ? " seg__btn--active" : ""}`}
                type="button"
                role="tab"
                aria-selected={mode === o.id}
                onClick={() => onMode(o.id)}
              >
                <Icon />
                <span>{o.label}</span>
              </button>
            );
          })}
        </div>
        {mode === "installed" ? (
          <>
            <div className="seg" role="tablist" aria-label="Status filter">
              {[
                { id: "all", label: "All" },
                { id: "ready", label: "Ready" },
                { id: "needs-setup", label: "Needs setup" },
                { id: "disabled", label: "Disabled" },
              ].map((o) => (
                <button
                  key={o.id}
                  className={`seg__btn${filter === o.id ? " seg__btn--active" : ""}`}
                  type="button"
                  onClick={() => onFilter(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="seg" role="tablist" aria-label="Source filter">
              {[
                { id: "all", label: "Any source" },
                { id: "bundled", label: "Bundled" },
                { id: "managed", label: "Managed" },
                { id: "plugin", label: "Plugin" },
              ].map((o) => (
                <button
                  key={o.id}
                  className={`seg__btn${source === o.id ? " seg__btn--active" : ""}`}
                  type="button"
                  onClick={() => onSource(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </>
        ) : null}
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
  mode,
  installed,
  hub,
  selectedKey,
  listState,
  searchQuery,
  filter,
  source,
  asOfMs,
  runtimeId,
  onMode,
  onSearch,
  onFilter,
  onSource,
  onSelect,
  onRefresh,
  onHubInstall,
  onHubPreview,
}) {
  const filteredInstalled = _lvMemo(() => {
    let xs = installed;
    if (filter && filter !== "all") xs = xs.filter((s) => s.status === filter);
    if (source && source !== "all") xs = xs.filter((s) => s.source === source);
    const q = (searchQuery || "").trim().toLowerCase();
    if (q && mode === "installed") {
      xs = xs.filter((s) => {
        const hay = [s.key, s.name, s.description, s.primaryEnv, s.source].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    return xs;
  }, [installed, filter, source, searchQuery, mode]);

  const filteredHub = _lvMemo(() => {
    if (mode !== "hub") return [];
    const q = (searchQuery || "").trim().toLowerCase();
    if (!q) return hub;
    return hub.filter((r) =>
      [r.slug, r.displayName, r.summary].join(" ").toLowerCase().includes(q),
    );
  }, [hub, searchQuery, mode]);

  return (
    <div className="list-view">
      <header className="page-header">
        <div className="page-header__title">
          <h1>Skills</h1>
          <p>
            Skill catalog — installed inventory plus hub-searchable marketplace. Skills are reusable
            workflows surfaced via SKILL.md trigger keywords. Source-of-truth contract is{" "}
            <span className="kbd">DeckGoSkillsResponse</span> +{" "}
            <span className="kbd">DeckGoSkillHubSearchResponse</span>.
          </p>
        </div>
        <div className="page-header__hint">
          <IconKbd /> <span>⌘K</span> search · <span>⌘N</span> hub
        </div>
      </header>

      <SkillsKpiStrip
        installed={installed}
        hubCount={hub.length}
        asOfMs={asOfMs}
        runtimeId={runtimeId}
      />

      <SkillsToolbar
        mode={mode}
        searchQuery={searchQuery}
        filter={filter}
        source={source}
        onMode={onMode}
        onSearch={onSearch}
        onFilter={onFilter}
        onSource={onSource}
        onRefresh={onRefresh}
      />

      {mode === "installed" ? (
        <>
          <div className="row-head" role="row" aria-hidden="true">
            <div className="row-head__col row-head__col--glyph"></div>
            <div className="row-head__col">Skill</div>
            <div className="row-head__col">Description</div>
            <div className="row-head__col">Source</div>
            <div className="row-head__col">Config</div>
            <div className="row-head__col">Setup</div>
            <div className="row-head__col row-head__col--right">Status</div>
            <div className="row-head__col row-head__col--chev"></div>
          </div>
          {listState === "loading" ? (
            <div className="list-state list-state--loading">
              <IconRefresh className="spin" />
              <div>Loading skill inventory…</div>
            </div>
          ) : listState === "error" ? (
            <div className="list-state list-state--error">
              <IconAlert />
              <div>
                <strong>Failed to load.</strong>
                <p>BFF returned 5xx. Retry or check Gateway logs.</p>
                <button className="btn btn--primary" type="button" onClick={onRefresh}>
                  <IconRefresh /> Retry
                </button>
              </div>
            </div>
          ) : filteredInstalled.length === 0 ? (
            <div className="list-state list-state--empty">
              <IconBox />
              <div>
                <strong>No installed skills match.</strong>
                <p>Try clearing search, or switch to the Hub tab to discover more skills.</p>
              </div>
            </div>
          ) : (
            <div className="list">
              {filteredInstalled.map((s) => (
                <InstalledRow
                  key={s.key}
                  skill={s}
                  selected={s.key === selectedKey}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="hub-list">
          {filteredHub.length === 0 ? (
            <div className="list-state list-state--empty">
              <IconCloud />
              <div>
                <strong>No hub results match.</strong>
                <p>Try a broader search term.</p>
              </div>
            </div>
          ) : (
            filteredHub.map((r) => (
              <HubResultRow
                key={r.slug}
                result={r}
                onInstall={onHubInstall}
                onPreview={onHubPreview}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  ListView,
  SkillsKpiStrip,
  SkillsToolbar,
  InstalledRow,
  HubResultRow,
  SkillSourcePill,
  skillStatusPillClass,
  skillStatusLabel,
  fmtRelativeMs,
});
