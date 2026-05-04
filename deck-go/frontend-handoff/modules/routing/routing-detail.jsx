// Right card: selected binding hero + actions + JSON + simulator + activity.

const SelectedBindingHero = ({
  binding,
  index,
  total,
  conflicts,
  onUseAsSimulation,
  onMoveUp,
  onMoveDown,
  onRemove,
  busy,
}) => {
  if (!binding) {
    return (
      <section className="selected-hero selected-hero--empty">
        <div>
          <p className="muted-label">Selected binding</p>
          <h3>No binding selected</h3>
          <p className="muted small">
            Pick a binding from the queue to see its detail and run actions on it.
          </p>
        </div>
      </section>
    );
  }
  const conflictTone = conflicts.length > 0 ? "warn" : "ok";
  return (
    <section className="selected-hero">
      <div className="selected-hero__top">
        <div>
          <p className="muted-label">Selected binding</p>
          <h3>
            <AgentChip id={binding.agentId} /> via{" "}
            <span className="mono">{binding.match.channel}</span>
            {binding.match.peer && (
              <>
                {" "}
                {binding.match.peer.kind} <span className="mono">{binding.match.peer.id}</span>
              </>
            )}
          </h3>
          <p className="muted small">
            <span className="mono">{binding.id.slice(0, 12)}</span> · tier {binding.tier} · order{" "}
            {index + 1} of {total}
          </p>
        </div>
        <span className={`pill pill--${conflictTone}`}>
          {conflicts.length === 0 ? (
            <>
              <IconCheck size={11} /> no local conflict
            </>
          ) : (
            <>
              <IconAlert size={11} /> {conflicts.length} advisory
            </>
          )}
        </span>
      </div>

      {conflicts.length > 0 && (
        <ul className="conflict-list">
          {conflicts.map((c, i) => (
            <li key={i}>
              <ConflictMarker conflict={c} />
              <span className="conflict-list__detail muted small">{c.detail}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="selected-hero__actions">
        <button type="button" className="primary-btn" onClick={onUseAsSimulation} disabled={busy}>
          <IconPlay size={12} /> Use as simulation
        </button>
        <button
          type="button"
          className="ghost-btn"
          onClick={onMoveUp}
          disabled={busy || index === 0}
        >
          <IconArrowUp size={12} /> Move up
        </button>
        <button
          type="button"
          className="ghost-btn"
          onClick={onMoveDown}
          disabled={busy || index === total - 1}
        >
          <IconArrowDown size={12} /> Move down
        </button>
        <button type="button" className="danger-btn" onClick={onRemove} disabled={busy}>
          <IconTrash size={12} /> Remove
        </button>
      </div>

      <JsonView value={binding} label="DeckGoRoutingBinding" max={200} />
    </section>
  );
};

const SimulatorPanel = ({
  input,
  setInput,
  onRun,
  lastResponse,
  onOpenAgent,
  onOpenSession,
  busy,
}) => {
  const setPeerKind = (kind) => {
    if (kind === "")
      setInput({
        ...input,
        peer: undefined,
      });
    else
      setInput({
        ...input,
        peer: { kind, id: input.peer?.id || "" },
      });
  };
  const setPeerId = (id) =>
    setInput({
      ...input,
      peer: { kind: input.peer?.kind || "direct", id },
    });

  return (
    <section className="simulator-panel">
      <header className="simulator-panel__head">
        <div>
          <h3>Route simulator</h3>
          <p className="muted small">Walk the match chain without sending a real message.</p>
        </div>
        {lastResponse && (
          <span className={`pill pill--${lastResponse.matchedBy === "default" ? "warn" : "ok"}`}>
            {lastResponse.matchedBy === "default" ? (
              <>fell to default · {lastResponse.agentId}</>
            ) : (
              <>matched · {lastResponse.agentId}</>
            )}
          </span>
        )}
      </header>

      <div className="simulator-grid">
        <label>
          <span className="muted-label">Channel</span>
          <select
            className="select-input"
            value={input.channel}
            onChange={(e) => setInput({ ...input, channel: e.target.value })}
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
            value={input.accountId || ""}
            onChange={(e) => setInput({ ...input, accountId: e.target.value || undefined })}
          />
        </label>
        <label>
          <span className="muted-label">Peer kind</span>
          <select
            className="select-input"
            value={input.peer?.kind || ""}
            onChange={(e) => setPeerKind(e.target.value)}
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
            value={input.peer?.id || ""}
            onChange={(e) => setPeerId(e.target.value)}
            disabled={!input.peer?.kind}
          />
        </label>
        <label>
          <span className="muted-label">Guild id</span>
          <input
            className="text-input"
            value={input.guildId || ""}
            onChange={(e) => setInput({ ...input, guildId: e.target.value || undefined })}
          />
        </label>
        <label>
          <span className="muted-label">Roles (comma-separated)</span>
          <input
            className="text-input"
            value={input.roles || ""}
            onChange={(e) => setInput({ ...input, roles: e.target.value })}
            placeholder="admin,ops"
          />
        </label>
      </div>

      <div className="simulator-actions">
        <button type="button" className="primary-btn" onClick={onRun} disabled={busy}>
          <IconPlay size={12} /> Simulate
        </button>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => setInput({ ...SIMULATOR_DEFAULT })}
        >
          Reset
        </button>
        {lastResponse && lastResponse.matchedBy !== "default" && (
          <>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => onOpenAgent(lastResponse.agentId)}
            >
              <IconExternal size={11} /> Open agent
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => onOpenSession(lastResponse.sessionKey)}
            >
              <IconExternal size={11} /> Open session
            </button>
          </>
        )}
      </div>

      {lastResponse && (
        <ul className="tier-timeline">
          {lastResponse.tiers.map((t) => {
            const status = t.matched ? "matched" : t.checked ? "checked" : "skipped";
            return (
              <li key={t.tier} className={`tier-timeline__row tier-timeline__row--${status}`}>
                <strong className="tier-timeline__tier">
                  <TierBadge tier={t.tier} />
                </strong>
                <span
                  className={`pill mini pill--${status === "matched" ? "ok" : status === "checked" ? "neutral" : "muted"}`}
                >
                  {status === "matched" && <IconCheck size={10} />}
                  {status === "checked" && <IconCircle size={10} />}
                  {status === "skipped" && <IconX size={10} />}
                  {status}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {lastResponse && (
        <div className="simulator-footer">
          <span className="muted-label">Session key</span>
          <span className="mono">{lastResponse.sessionKey}</span>
        </div>
      )}
    </section>
  );
};

const ActivityList = ({ events, onRefresh, refreshing }) => {
  return (
    <section className="activity-panel">
      <header className="activity-panel__head">
        <div>
          <h3>Recent routing activity</h3>
          <p className="muted small">Filtered from activity events; not durable route history.</p>
        </div>
        <button type="button" className="ghost-btn" onClick={onRefresh} disabled={refreshing}>
          <IconRefresh size={12} /> {refreshing ? "…" : "Refresh"}
        </button>
      </header>
      <ul className="activity-list">
        {events.map((e) => (
          <li key={e.id} className="activity-row">
            <div className="activity-row__top">
              <span
                className={`pill mini pill--${e.type.startsWith("route.fallback") ? "warn" : "neutral"}`}
              >
                {e.type}
              </span>
              {e.agentId && <AgentChip id={e.agentId} />}
              <span className="muted small">{formatRelative(e.atMs)}</span>
            </div>
            <p className="activity-row__summary">{e.summary}</p>
            {e.bindingId && <p className="muted small mono">binding {e.bindingId.slice(0, 12)}</p>}
          </li>
        ))}
        {events.length === 0 && (
          <li className="activity-row activity-row--empty">
            <p className="muted small">No routing activity in this window.</p>
          </li>
        )}
      </ul>
    </section>
  );
};

const MutationStrip = ({ result }) => {
  if (!result) return null;
  return (
    <section className={`mutation-strip mutation-strip--${result.tone}`}>
      <div className="mutation-strip__head">
        {result.tone === "ok" && <IconCheck size={13} />}
        {result.tone === "warn" && <IconAlert size={13} />}
        <span className="mutation-strip__heading">{result.heading}</span>
        <span className="muted small">{formatRelative(result.atMs)}</span>
      </div>
      {result.detail && <p className="mutation-strip__detail">{result.detail}</p>}
      {result.newHash && (
        <div className="mutation-strip__hash-row">
          <span className="muted-label">new config hash</span>
          <span className="mono">{result.newHash}</span>
        </div>
      )}
    </section>
  );
};

const ConfirmRow = ({ pending, onCancel, onConfirm }) => {
  if (!pending) return null;
  return (
    <div className={`confirm-row ${pending.danger ? "confirm-row--danger" : ""}`}>
      <IconAlert size={13} />
      <div className="confirm-row__body">
        <strong>Confirm {pending.label}?</strong>
        <p className="muted small">{pending.hint}</p>
      </div>
      <div className="confirm-row__actions">
        <button type="button" className="ghost-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={pending.danger ? "danger-btn" : "primary-btn"}
          onClick={onConfirm}
        >
          {pending.label}
        </button>
      </div>
    </div>
  );
};

const RoutingDetail = ({
  selectedBinding,
  selectedIndex,
  totalBindings,
  conflicts,
  configHash,
  pendingAction,
  mutationResult,
  simulatorInput,
  setSimulatorInput,
  lastSimulationResponse,
  activityEvents,
  refreshingActivity,
  onUseAsSimulation,
  onMoveUp,
  onMoveDown,
  onRemove,
  onSimulate,
  onOpenAgent,
  onOpenSession,
  onRefreshActivity,
  onCancelConfirm,
  onConfirm,
  busy,
}) => {
  return (
    <article className="detail-card">
      <header className="detail-card__head">
        <div>
          <h2>Selected binding & simulator</h2>
          <p className="muted small">Inspect match dimensions, then mutate config.</p>
        </div>
        <HashChip hash={configHash} label="config hash" />
      </header>

      <ConfirmRow pending={pendingAction} onCancel={onCancelConfirm} onConfirm={onConfirm} />
      <MutationStrip result={mutationResult} />

      <SelectedBindingHero
        binding={selectedBinding}
        index={selectedIndex}
        total={totalBindings}
        conflicts={conflicts}
        onUseAsSimulation={onUseAsSimulation}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onRemove={onRemove}
        busy={busy}
      />

      <SimulatorPanel
        input={simulatorInput}
        setInput={setSimulatorInput}
        onRun={onSimulate}
        lastResponse={lastSimulationResponse}
        onOpenAgent={onOpenAgent}
        onOpenSession={onOpenSession}
        busy={busy}
      />

      <ActivityList
        events={activityEvents}
        onRefresh={onRefreshActivity}
        refreshing={refreshingActivity}
      />
    </article>
  );
};

Object.assign(window, {
  SelectedBindingHero,
  SimulatorPanel,
  ActivityList,
  MutationStrip,
  ConfirmRow,
  RoutingDetail,
});
