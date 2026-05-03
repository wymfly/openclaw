/* global React, IconEdit, IconTrash, IconPower, IconAlert, IconCheck,
   DimensionPill, BudgetStatusPill, ScopeChip, PeriodChip,
   ActorChip, ThresholdMeter */
const { useMemo } = React;

const fmtRelative = (now, ts) => {
  if (!ts) return "—";
  const t = typeof ts === "string" ? Date.parse(ts) : ts;
  const d = Math.max(0, now - t);
  if (d < 60_000) return `${Math.round(d / 1000)}s ago`;
  if (d < 60 * 60_000) return `${Math.round(d / 60_000)}m ago`;
  if (d < 24 * 60 * 60_000) return `${Math.round(d / (60 * 60_000))}h ago`;
  return `${Math.round(d / (24 * 60 * 60_000))}d ago`;
};

const fmtAbsolute = (ts) => {
  if (!ts) return "—";
  const t = typeof ts === "string" ? Date.parse(ts) : ts;
  const dt = new Date(t);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  const hh = String(dt.getHours()).padStart(2, "0");
  const mn = String(dt.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mn}`;
};

const fmtValue = (n, dimension) => {
  if (n == null) return "—";
  if (dimension === "cost") {
    return `$${n.toFixed(n < 1 ? 3 : 2)}`;
  }
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
};

const RuleHeroSummary = ({ summary }) => (
  <section className="rule-summary">
    {summary.map((s) => (
      <div key={s.label} className={`rule-summary__cell rule-summary__cell--${s.tone || "iron"}`}>
        <p className="rule-summary__label">{s.label}</p>
        <strong className="rule-summary__value">{s.value}</strong>
        {s.hint ? <span className="rule-summary__hint">{s.hint}</span> : null}
      </div>
    ))}
  </section>
);

const ChangeRow = ({ entry, now }) => (
  <article className={`change-row change-row--${entry.kind}`}>
    <div className="change-row__head">
      <span className={`change-row__kind change-row__kind--${entry.kind}`}>{entry.kind}</span>
      <span className="change-row__time" title={fmtAbsolute(entry.ts)}>
        {fmtRelative(now, entry.ts)}
      </span>
    </div>
    <p className="change-row__note">{entry.note}</p>
    <div className="change-row__foot">
      <ActorChip actor={entry.actor} />
      {entry.ok ? (
        <span className="change-row__status change-row__status--ok">
          <IconCheck size={11} /> ok
        </span>
      ) : (
        <span className="change-row__status change-row__status--err">
          <IconAlert size={11} /> failed
        </span>
      )}
    </div>
  </article>
);

const RuleDetail = ({
  rule,
  evaluation,
  now,
  recentChanges,
  bootstrap,
  onEdit,
  onToggle,
  onDelete,
}) => {
  const ownChanges = useMemo(
    () => recentChanges.filter((c) => c.ruleId === rule?.id),
    [recentChanges, rule],
  );
  const locked = !bootstrap?.ok;

  if (!rule) {
    return (
      <section className="rule-detail rule-detail--empty">
        <div className="rule-detail__empty-card">
          <h2>No rule selected</h2>
          <p>
            Pick a rule from the left rail to inspect its evaluation status, thresholds, and
            history.
          </p>
        </div>
      </section>
    );
  }

  const dimension = rule.dimension;
  const summary = [
    {
      label: "Status",
      value: evaluation ? evaluation.status.toUpperCase() : "—",
      tone: evaluation?.status,
    },
    {
      label: "Current",
      value: fmtValue(evaluation?.current, dimension),
      tone: "iron",
    },
    {
      label: "Warn at",
      value: fmtValue(rule.warnThreshold, dimension),
      hint:
        rule.warnThreshold && evaluation
          ? `${Math.round((evaluation.current / rule.warnThreshold) * 100)}% of warn`
          : null,
      tone: "warn",
    },
    {
      label: "Over at",
      value: fmtValue(rule.overThreshold, dimension),
      hint:
        rule.overThreshold && evaluation
          ? `${Math.round((evaluation.current / rule.overThreshold) * 100)}% of over`
          : null,
      tone: "error",
    },
  ];

  return (
    <section className="rule-detail">
      <header className="rule-detail__hero">
        <div className="rule-detail__hero-left">
          <p className="rule-detail__eyebrow">Budget rule</p>
          <h1 className="rule-detail__title">{rule.name}</h1>
          <div className="rule-detail__hero-meta">
            <DimensionPill dimension={rule.dimension} />
            <ScopeChip scope={rule.scope} agentId={rule.agentId} taskId={rule.taskId} />
            <PeriodChip period={rule.period} />
            {rule.enabled ? (
              <span className="rule-detail__enabled-pill">enabled</span>
            ) : (
              <span className="rule-detail__disabled-pill">disabled</span>
            )}
            {evaluation ? <BudgetStatusPill status={evaluation.status} /> : null}
          </div>
          <p className="rule-detail__hero-foot">
            <span>
              id: <code>{rule.id}</code>
            </span>
            <span>
              created{" "}
              <span title={fmtAbsolute(rule.createdAt)}>{fmtRelative(now, rule.createdAt)}</span>
            </span>
            <span>
              updated{" "}
              <span title={fmtAbsolute(rule.updatedAt)}>{fmtRelative(now, rule.updatedAt)}</span>
            </span>
          </p>
        </div>
        <div className="rule-detail__hero-actions">
          <button
            type="button"
            className="ds-btn ds-btn--primary"
            onClick={onEdit}
            disabled={locked}
          >
            <IconEdit size={12} /> Edit
          </button>
          <button
            type="button"
            className={`ds-btn ds-btn--ghost ${rule.enabled ? "ds-btn--warn" : ""}`}
            onClick={onToggle}
            disabled={locked}
          >
            <IconPower size={12} /> {rule.enabled ? "Disable" : "Enable"}
          </button>
          <button
            type="button"
            className="ds-btn ds-btn--ghost ds-btn--warn"
            onClick={onDelete}
            disabled={locked}
          >
            <IconTrash size={12} /> Delete
          </button>
        </div>
      </header>

      {locked ? (
        <div className="rule-detail__banner rule-detail__banner--warn" role="alert">
          <IconAlert size={14} />
          <div>
            <strong>Bootstrap not ready.</strong>
            <p>Mutations disabled until /api/bootstrap/status returns ok=true.</p>
          </div>
        </div>
      ) : null}

      <RuleHeroSummary summary={summary} />

      <section className="rule-detail__section">
        <header className="rule-detail__section-head">
          <h2>Threshold meter</h2>
          <p className="rule-detail__section-hint">
            Current usage versus warn / over markers. Bar tints at warn (yellow) and over (red).
          </p>
        </header>
        {evaluation ? (
          <div className="threshold-card">
            <ThresholdMeter
              current={evaluation.current}
              warn={rule.warnThreshold}
              over={rule.overThreshold}
            />
            <div className="threshold-card__legend">
              <span className="threshold-card__legend-mark threshold-card__legend-mark--current">
                current {fmtValue(evaluation.current, dimension)}
              </span>
              <span className="threshold-card__legend-mark threshold-card__legend-mark--warn">
                warn {fmtValue(rule.warnThreshold, dimension)}
              </span>
              <span className="threshold-card__legend-mark threshold-card__legend-mark--over">
                over {fmtValue(rule.overThreshold, dimension)}
              </span>
            </div>
          </div>
        ) : (
          <div className="threshold-card threshold-card--empty">
            <p>No evaluation snapshot for this rule yet.</p>
          </div>
        )}
      </section>

      <section className="rule-detail__section">
        <header className="rule-detail__section-head">
          <h2>Definition</h2>
          <p className="rule-detail__section-hint">
            Server-side rule shape. Mutate via Edit; deck-go BFF persists to the budget rule store.
          </p>
        </header>
        <div className="rule-def">
          <div className="rule-def__row">
            <span className="rule-def__label">scope</span>
            <code>{rule.scope}</code>
          </div>
          <div className="rule-def__row">
            <span className="rule-def__label">agentId</span>
            <code>{rule.agentId || "—"}</code>
          </div>
          <div className="rule-def__row">
            <span className="rule-def__label">taskId</span>
            <code>{rule.taskId || "—"}</code>
          </div>
          <div className="rule-def__row">
            <span className="rule-def__label">dimension</span>
            <code>{rule.dimension}</code>
          </div>
          <div className="rule-def__row">
            <span className="rule-def__label">period</span>
            <code>{rule.period}</code>
          </div>
          <div className="rule-def__row">
            <span className="rule-def__label">warnThreshold</span>
            <code>{rule.warnThreshold ?? "—"}</code>
          </div>
          <div className="rule-def__row">
            <span className="rule-def__label">overThreshold</span>
            <code>{rule.overThreshold ?? "—"}</code>
          </div>
          <div className="rule-def__row">
            <span className="rule-def__label">enabled</span>
            <code>{String(rule.enabled)}</code>
          </div>
        </div>
      </section>

      <section className="rule-detail__section">
        <header className="rule-detail__section-head">
          <h2>Recent changes</h2>
          <p className="rule-detail__section-hint">
            Last 8 mutations scoped to this rule (BFF projection from the audit log).
          </p>
        </header>
        {ownChanges.length === 0 ? (
          <div className="change-empty">
            <p>No recent changes for this rule.</p>
          </div>
        ) : (
          <div className="change-list">
            {ownChanges.slice(0, 8).map((c, i) => (
              <ChangeRow key={i} entry={c} now={now} />
            ))}
          </div>
        )}
      </section>
    </section>
  );
};

Object.assign(window, { RuleDetail, fmtValue, fmtRelative, fmtAbsolute });
