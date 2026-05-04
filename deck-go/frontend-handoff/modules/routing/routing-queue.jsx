// Left card: metric strip + filters + DM scope panel + binding list + add-binding draft drawer.

const MetricStrip = ({ bindings, head, conflictsCount, lastSimulationAgentId }) => {
  return (
    <section className="metric-strip" aria-label="Routing metrics">
      <div className="metric-card">
        <span className="metric-card__label">Bindings</span>
        <strong className="metric-card__value">{bindings.length} active</strong>
      </div>
      <div className="metric-card">
        <span className="metric-card__label">Default agent</span>
        <strong className="metric-card__value">
          <AgentChip id={head.defaultAgentId} />
        </strong>
      </div>
      <div className="metric-card">
        <span className="metric-card__label">DM scope</span>
        <strong className="metric-card__value mono-value">{head.dmScope}</strong>
      </div>
      <div className={`metric-card ${conflictsCount > 0 ? "metric-card--warn" : ""}`}>
        <span className="metric-card__label">Advisory conflicts</span>
        <strong className="metric-card__value">{conflictsCount}</strong>
      </div>
      <div className="metric-card">
        <span className="metric-card__label">Last simulation</span>
        <strong className="metric-card__value">
          {lastSimulationAgentId ? <AgentChip id={lastSimulationAgentId} /> : "—"}
        </strong>
      </div>
    </section>
  );
};

const FilterRow = ({ filters, onChange, onApply, onClear }) => {
  return (
    <div className="filter-row">
      <label className="filter-field">
        <span className="filter-label">agent</span>
        <input
          className="text-input"
          value={filters.agentId}
          placeholder="any agent"
          onChange={(e) => onChange({ ...filters, agentId: e.target.value })}
          aria-label="agent id filter"
        />
      </label>
      <label className="filter-field">
        <span className="filter-label">channel</span>
        <input
          className="text-input"
          value={filters.channel}
          placeholder="any channel"
          onChange={(e) => onChange({ ...filters, channel: e.target.value })}
          aria-label="channel filter"
        />
      </label>
      <label className="filter-field">
        <span className="filter-label">account</span>
        <input
          className="text-input"
          value={filters.accountId}
          placeholder="any account"
          onChange={(e) => onChange({ ...filters, accountId: e.target.value })}
          aria-label="account filter"
        />
      </label>
      <button type="button" className="ghost-btn" onClick={onApply}>
        <IconFilter size={12} /> Apply
      </button>
      <button type="button" className="ghost-btn" onClick={onClear}>
        Clear
      </button>
    </div>
  );
};

const DmScopePanel = ({ scope, onPatch, busy, options }) => {
  const [draft, setDraft] = React.useState(scope);
  React.useEffect(() => setDraft(scope), [scope]);
  const dirty = draft !== scope;
  return (
    <section className="dm-scope-panel">
      <header className="dm-scope-panel__head">
        <div>
          <h3>DM scope strategy</h3>
          <p className="muted small">Updates require the current config hash.</p>
        </div>
        <span className="pill mini">{scope}</span>
      </header>
      <div className="dm-scope-panel__row">
        <select
          className="select-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="DM scope strategy"
        >
          {options.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="primary-btn"
          onClick={() => dirty && onPatch(draft)}
          disabled={!dirty || busy}
        >
          Patch scope
        </button>
      </div>
    </section>
  );
};

const BindingRow = ({ binding, index, total, isSelected, conflicts, onSelect }) => {
  const hasConflict = conflicts.length > 0;
  return (
    <li>
      <button
        type="button"
        className={`binding-row ${isSelected ? "binding-row--active" : ""}`}
        onClick={onSelect}
      >
        <div className="binding-row__top">
          <span className="binding-row__order">{index + 1}</span>
          <AgentChip id={binding.agentId} />
          <TierBadge tier={binding.tier} />
          {hasConflict && (
            <span className="binding-row__warn">
              <IconAlert size={11} /> {conflicts.length}
            </span>
          )}
        </div>
        <MatchChipRow match={binding.match} />
        {binding.comment && <p className="binding-row__comment muted small">{binding.comment}</p>}
        <div className="binding-row__meta">
          <span className="mono">id {binding.id.slice(0, 12)}</span>
          <span>·</span>
          <span>
            order {index + 1} of {total}
          </span>
        </div>
      </button>
    </li>
  );
};

const AddBindingDraft = ({ draft, setDraft, onValidate, onAdd, onCancel, validation, busy }) => {
  const setMatch = (patch) => setDraft({ ...draft, match: { ...draft.match, ...patch } });
  const setPeer = (patch) =>
    setDraft({
      ...draft,
      match: {
        ...draft.match,
        peer: { ...(draft.match.peer || { kind: "direct", id: "" }), ...patch },
      },
    });

  return (
    <section className="add-draft-panel">
      <header className="add-draft-panel__head">
        <div>
          <h3>Add or validate binding</h3>
          <p className="muted small">All writes require the current config hash.</p>
        </div>
        <button type="button" className="ghost-btn" onClick={onCancel}>
          <IconX size={12} /> Close
        </button>
      </header>
      <div className="add-draft-grid">
        <label>
          <span className="muted-label">Agent</span>
          <select
            className="select-input"
            value={draft.agentId}
            onChange={(e) => setDraft({ ...draft, agentId: e.target.value })}
          >
            {AGENT_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="muted-label">Tier</span>
          <select
            className="select-input"
            value={draft.tier}
            onChange={(e) => setDraft({ ...draft, tier: e.target.value })}
          >
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="muted-label">Channel</span>
          <select
            className="select-input"
            value={draft.match.channel}
            onChange={(e) => setMatch({ channel: e.target.value })}
          >
            {CHANNEL_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="muted-label">Account id</span>
          <input
            className="text-input"
            value={draft.match.accountId || ""}
            placeholder="optional"
            onChange={(e) => setMatch({ accountId: e.target.value || undefined })}
          />
        </label>
        <label>
          <span className="muted-label">Peer kind</span>
          <select
            className="select-input"
            value={draft.match.peer?.kind || ""}
            onChange={(e) => {
              if (e.target.value === "") {
                setDraft({ ...draft, match: { ...draft.match, peer: undefined } });
              } else {
                setPeer({ kind: e.target.value });
              }
            }}
          >
            <option value="">(none)</option>
            {PEER_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="muted-label">Peer id</span>
          <input
            className="text-input"
            value={draft.match.peer?.id || ""}
            placeholder="peer.id"
            onChange={(e) => setPeer({ id: e.target.value })}
            disabled={!draft.match.peer?.kind}
          />
        </label>
        <label>
          <span className="muted-label">Guild id</span>
          <input
            className="text-input"
            value={draft.match.guildId || ""}
            placeholder="optional"
            onChange={(e) => setMatch({ guildId: e.target.value || undefined })}
          />
        </label>
        <label>
          <span className="muted-label">Team id</span>
          <input
            className="text-input"
            value={draft.match.teamId || ""}
            placeholder="optional"
            onChange={(e) => setMatch({ teamId: e.target.value || undefined })}
          />
        </label>
        <label className="add-draft-grid__roles">
          <span className="muted-label">Roles (comma-separated)</span>
          <input
            className="text-input"
            value={(draft.match.roles || []).join(",")}
            placeholder="admin,ops"
            onChange={(e) =>
              setMatch({
                roles: e.target.value
                  .split(",")
                  .map((r) => r.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
        <label className="add-draft-grid__comment">
          <span className="muted-label">Comment</span>
          <textarea
            className="code-input"
            rows={2}
            value={draft.comment || ""}
            placeholder="Why this binding exists"
            onChange={(e) => setDraft({ ...draft, comment: e.target.value || undefined })}
          />
        </label>
      </div>

      {validation && (
        <div
          className={`validation-strip ${validation.ok ? "validation-strip--ok" : "validation-strip--warn"}`}
        >
          {validation.ok ? (
            <>
              <IconCheck size={12} /> Validated as <strong>{validation.tier}</strong>
            </>
          ) : (
            <>
              <IconAlert size={12} /> {validation.conflicts.length} conflict
              {validation.conflicts.length === 1 ? "" : "s"}
              {validation.conflicts.map((c, i) => (
                <span key={i} className="validation-strip__conflict">
                  · {c.type} ({c.agentId}): {c.detail}
                </span>
              ))}
            </>
          )}
        </div>
      )}

      <div className="add-draft-actions">
        <button type="button" className="ghost-btn" onClick={onValidate} disabled={busy}>
          Validate
        </button>
        <button type="button" className="primary-btn" onClick={onAdd} disabled={busy}>
          <IconPlus size={12} /> Add binding
        </button>
        <span className="muted small">
          Requires hash <span className="mono">{ROUTING_HEAD.configHash.slice(0, 8)}…</span>
        </span>
      </div>
    </section>
  );
};

const RoutingQueue = ({
  bindings,
  head,
  filters,
  onFiltersChange,
  onFiltersApply,
  onFiltersClear,
  selectedId,
  onSelect,
  conflictsByBinding,
  onRefresh,
  refreshing,
  scope,
  onPatchScope,
  showAddDraft,
  onShowAddDraft,
  onCloseAddDraft,
  draft,
  setDraft,
  onValidateDraft,
  onAddDraft,
  validation,
  busy,
}) => {
  const totalConflicts = Object.values(conflictsByBinding).reduce(
    (acc, list) => acc + list.length,
    0,
  );

  return (
    <article className="queue-card">
      <header className="queue-card__head">
        <div>
          <h2>Binding queue</h2>
          <p className="muted small">Ordered most specific → broad fallback.</p>
        </div>
        <div className="queue-card__head-actions">
          <button type="button" className="ghost-btn" onClick={onRefresh} disabled={refreshing}>
            <IconRefresh size={12} /> {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          {!showAddDraft && (
            <button type="button" className="primary-btn" onClick={onShowAddDraft}>
              <IconPlus size={12} /> Add binding…
            </button>
          )}
        </div>
      </header>

      <FilterRow
        filters={filters}
        onChange={onFiltersChange}
        onApply={onFiltersApply}
        onClear={onFiltersClear}
      />

      <DmScopePanel scope={scope} onPatch={onPatchScope} busy={busy} options={DM_SCOPE_OPTIONS} />

      {showAddDraft && (
        <AddBindingDraft
          draft={draft}
          setDraft={setDraft}
          onValidate={onValidateDraft}
          onAdd={onAddDraft}
          onCancel={onCloseAddDraft}
          validation={validation}
          busy={busy}
        />
      )}

      {bindings.length === 0 ? (
        <div className="empty-state">
          <p>No bindings match the current filters.</p>
          <p className="muted small">Adjust filters or add a new binding.</p>
        </div>
      ) : (
        <ul className="binding-list">
          {bindings.map((b, i) => (
            <BindingRow
              key={b.id}
              binding={b}
              index={i}
              total={bindings.length}
              isSelected={selectedId === b.id}
              conflicts={conflictsByBinding[b.id] || []}
              onSelect={() => onSelect(b.id)}
            />
          ))}
        </ul>
      )}

      <p className="queue-card__foot muted small">
        {bindings.length} binding{bindings.length === 1 ? "" : "s"} · {totalConflicts} advisory
        conflict{totalConflicts === 1 ? "" : "s"} · default agent {head.defaultAgentId}
      </p>
    </article>
  );
};

Object.assign(window, {
  MetricStrip,
  FilterRow,
  DmScopePanel,
  BindingRow,
  AddBindingDraft,
  RoutingQueue,
});
