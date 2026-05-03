// alerts — Detail view
//
// Hero (entity glyph + name + action pill + actions) + 4 tabs:
//   1. Overview — identity + enabled toggle + cooldown + lastFired
//   2. Conditions — condition DSL + threshold + action with explanation
//   3. Recent fires — BFF projection over alert.fire activity events
//   4. Audit — BFF projection of CRUD history

const ALERT_TABS = [
  { id: "overview", label: "Overview" },
  { id: "conditions", label: "Conditions" },
  { id: "fires", label: "Recent fires" },
  { id: "audit", label: "Audit" },
];

function fmtClock(ms) {
  return ms ? new Date(ms).toLocaleTimeString() : "—";
}
function fmtDate(ms) {
  return ms ? new Date(ms).toLocaleDateString() : "—";
}

function DetailHero({ rule, onBack, onEdit, onDelete, onTestFire, onToggleEnabled }) {
  return (
    <div className="hero">
      <button className="back-btn" type="button" onClick={onBack} aria-label="Back to list">
        <IconChevronLeft /> <span>Alerts</span>
      </button>
      <div className="hero__main">
        <EntityGlyph entityType={rule.entityType} size={48} />
        <div className="hero__title-stack">
          <div className="hero__title-row">
            <h1>{rule.name}</h1>
            <span className={`pill pill--${rule.enabled ? "ok" : "muted"}`}>
              {rule.enabled ? <IconCheck /> : <IconX />}
              <span>{rule.enabled ? "enabled" : "disabled"}</span>
            </span>
            <ActionPill action={rule.action} />
          </div>
          <div className="hero__meta">
            <span className="kbd">{rule.id}</span>
            <span className="muted">·</span>
            <span>{rule.entityType}</span>
            <span className="muted">·</span>
            <span className="time-mono">
              <IconClock /> cooldown {(rule.cooldownMs / 60000).toFixed(0)}m
            </span>
            {rule.lastFiredAt ? (
              <>
                <span className="muted">·</span>
                <span>last fired {fmtRel(rule.lastFiredAt)}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>
      <div className="hero__actions">
        <button className="btn btn--ghost" type="button" onClick={onTestFire}>
          <IconBell /> Test fire
        </button>
        <button className="btn btn--ghost" type="button" onClick={onToggleEnabled}>
          <IconPower /> {rule.enabled ? "Disable" : "Enable"}
        </button>
        <button className="btn btn--ghost" type="button" onClick={onEdit}>
          Edit
        </button>
        <button className="btn btn--danger-ghost" type="button" onClick={onDelete}>
          <IconTrash /> Delete
        </button>
      </div>
    </div>
  );
}

function TabsBar({ activeTab, onTab }) {
  return (
    <div className="tabs" role="tablist" aria-label="Rule sections">
      {ALERT_TABS.map((t) => (
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

function TabOverview({ rule }) {
  return (
    <div className="section">
      <div className="section__head">
        <h2>Identity</h2>
      </div>
      <div className="field-grid">
        <FieldRow label="ID" value={rule.id} mono />
        <FieldRow label="Name" value={rule.name} />
        <FieldRow label="Entity type" value={rule.entityType} />
        <FieldRow
          label="Enabled"
          value={
            <span className={`pill pill--${rule.enabled ? "ok" : "muted"}`}>
              {rule.enabled ? <IconCheck /> : <IconX />}
              <span>{rule.enabled ? "Yes" : "No"}</span>
            </span>
          }
        />
      </div>
      <div className="section__head">
        <h2>Lifecycle</h2>
      </div>
      <div className="field-grid">
        <FieldRow
          label="Created"
          value={`${fmtClock(Date.parse(rule.createdAt))} · ${fmtDate(Date.parse(rule.createdAt))}`}
        />
        <FieldRow
          label="Updated"
          value={`${fmtClock(Date.parse(rule.updatedAt))} · ${fmtDate(Date.parse(rule.updatedAt))}`}
        />
        <FieldRow
          label="Last fired"
          value={
            rule.lastFiredAt
              ? `${fmtClock(Date.parse(rule.lastFiredAt))} · ${fmtRel(rule.lastFiredAt)}`
              : null
          }
        />
        <FieldRow label="Cooldown" value={`${(rule.cooldownMs / 60000).toFixed(0)}m`} mono />
      </div>
    </div>
  );
}

function TabConditions({ rule }) {
  return (
    <div className="section">
      <div className="section__head">
        <h2>Condition</h2>
      </div>
      <div className="condition-card">
        <div className="condition-card__expr">
          <code className="mono">{rule.condition}</code>
        </div>
        <div className="condition-card__threshold">
          <IconThreshold />
          <span>threshold = </span>
          <code className="mono">{String(rule.threshold)}</code>
        </div>
      </div>
      <div className="banner banner--info">
        <IconInfo />
        <div>
          <strong>How it evaluates.</strong>
          <p>
            Backend pulls the named metric from the activity firehose, compares against{" "}
            <span className="kbd">threshold</span>, and fires when the comparison is true. The
            cooldown window deduplicates per (rule × entityId).
          </p>
        </div>
      </div>
      <div className="section__head">
        <h2>Action</h2>
      </div>
      <div className="action-explainer">
        <ActionPill action={rule.action} />
        <p>
          {rule.action === "toast"
            ? "Surfaces a transient banner in deck-go for any operator with the panel open. Suitable for low-volume, attention-required alerts."
            : rule.action === "activity"
              ? "Appends an alert.fire event to the activity feed only — quietest action, useful for trend tracking."
              : "POSTs the rule + observed value to a registered webhook URL. Suitable for routing into Slack, PagerDuty, or custom systems."}
        </p>
      </div>
    </div>
  );
}

function TabFires({ fires }) {
  if (!fires || fires.length === 0) {
    return (
      <div className="section">
        <div className="empty-block">
          <IconBell /> No recent fires for this rule.
        </div>
      </div>
    );
  }
  const sorted = [...fires].sort((a, b) => b.ts - a.ts);
  return (
    <div className="section">
      <div className="section__head">
        <h2>Recent fires</h2>
        <span className="muted small">{fires.length} fires · BFF projection</span>
      </div>
      <div className="timeline">
        {sorted.map((f, i) => (
          <div key={i} className="timeline__row timeline__row--fire">
            <div className="timeline__dot" />
            <div className="timeline__main">
              <div className="timeline__title">
                <span className="event-pill event-pill--fire">fired</span>
                <span className="kbd kbd--small">{f.entityId}</span>
              </div>
              <div className="timeline__note">{f.note}</div>
            </div>
            <div className="timeline__ts">
              <div className="mono">{fmtClock(f.ts)}</div>
              <div className="muted small">{fmtRel(f.ts)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabAudit({ audit }) {
  if (!audit || audit.length === 0) {
    return (
      <div className="section">
        <div className="empty-block">
          <IconClock /> No audit projected for this rule yet.
        </div>
      </div>
    );
  }
  const sorted = [...audit].sort((a, b) => b.ts - a.ts);
  return (
    <div className="section">
      <div className="section__head">
        <h2>Rule audit</h2>
        <span className="muted small">{audit.length} events · BFF projection</span>
      </div>
      <div className="timeline">
        {sorted.map((ev, i) => (
          <div key={i} className={`timeline__row timeline__row--${ev.action}`}>
            <div className="timeline__dot" />
            <div className="timeline__main">
              <div className="timeline__title">
                <span className={`event-pill event-pill--${ev.action}`}>{ev.action}</span>
                <span className="muted small">{ev.actor}</span>
              </div>
              {ev.note ? <div className="timeline__note">{ev.note}</div> : null}
            </div>
            <div className="timeline__ts">
              <div className="mono">{fmtClock(ev.ts)}</div>
              <div className="muted small">{fmtRel(ev.ts)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailView({
  rule,
  fires,
  audit,
  tweaks,
  setTweak,
  onBack,
  onEdit,
  onDelete,
  onTestFire,
  onToggleEnabled,
}) {
  if (tweaks.detailState === "loading") {
    return (
      <div className="detail">
        <DetailHero
          rule={rule}
          onBack={onBack}
          onEdit={onEdit}
          onDelete={onDelete}
          onTestFire={onTestFire}
          onToggleEnabled={onToggleEnabled}
        />
        <div className="list-state list-state--loading">
          <IconRefresh className="spin" />
          <div>Loading rule detail…</div>
        </div>
      </div>
    );
  }
  return (
    <div className="detail">
      <DetailHero
        rule={rule}
        onBack={onBack}
        onEdit={onEdit}
        onDelete={onDelete}
        onTestFire={onTestFire}
        onToggleEnabled={onToggleEnabled}
      />
      <TabsBar activeTab={tweaks.activeTab} onTab={(v) => setTweak("activeTab", v)} />
      <div className="detail__body">
        {tweaks.activeTab === "overview" ? <TabOverview rule={rule} /> : null}
        {tweaks.activeTab === "conditions" ? <TabConditions rule={rule} /> : null}
        {tweaks.activeTab === "fires" ? <TabFires fires={fires} /> : null}
        {tweaks.activeTab === "audit" ? <TabAudit audit={audit} /> : null}
      </div>
    </div>
  );
}

Object.assign(window, {
  DetailView,
  DetailHero,
  TabsBar,
  TabOverview,
  TabConditions,
  TabFires,
  TabAudit,
  ALERT_TABS,
});
