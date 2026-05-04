// RoutingApp orchestrator: holds bindings + filters + selection + draft + simulator + mutation lifecycle.

const RoutingApp = () => {
  const [bindings, setBindings] = React.useState(window.BINDINGS);
  const [head, setHead] = React.useState({ ...window.ROUTING_HEAD });
  const [scope, setScope] = React.useState(window.ROUTING_HEAD.dmScope);
  const [filters, setFilters] = React.useState({
    agentId: "",
    channel: "",
    accountId: "",
  });
  const [appliedFilters, setAppliedFilters] = React.useState({
    agentId: "",
    channel: "",
    accountId: "",
  });
  const [selectedId, setSelectedId] = React.useState(window.BINDINGS[0]?.id || null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshingActivity, setRefreshingActivity] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState(null);
  const [mutationResult, setMutationResult] = React.useState(null);
  const [simulatorInput, setSimulatorInput] = React.useState({ ...window.SIMULATOR_DEFAULT });
  const [lastSimulationResponse, setLastSimulationResponse] = React.useState(null);
  const [showAddDraft, setShowAddDraft] = React.useState(false);
  const [draft, setDraft] = React.useState({
    agentId: "support",
    tier: "peer",
    match: { channel: "wecom", accountId: "default", peer: { kind: "group", id: "" } },
    comment: "",
  });
  const [validation, setValidation] = React.useState(null);
  const activityEvents = window.ACTIVITY_EVENTS;

  // Derived: filtered bindings.
  const filteredBindings = bindings.filter((b) => {
    if (appliedFilters.agentId && !b.agentId.includes(appliedFilters.agentId)) return false;
    if (appliedFilters.channel && b.match.channel !== appliedFilters.channel) return false;
    if (appliedFilters.accountId && (b.match.accountId || "") !== appliedFilters.accountId)
      return false;
    return true;
  });

  // Resolve selected binding (in the filtered view).
  const selectedBinding =
    filteredBindings.find((b) => b.id === selectedId) || filteredBindings[0] || null;
  const selectedIndex = selectedBinding
    ? filteredBindings.findIndex((b) => b.id === selectedBinding.id)
    : -1;

  const conflictsByBinding = window.LOCAL_CONFLICTS || {};
  const totalConflicts = Object.values(conflictsByBinding).reduce(
    (acc, list) => acc + list.length,
    0,
  );

  // ------- handlers -------

  const onSelect = (id) => {
    setSelectedId(id);
    setMutationResult(null);
    setPendingAction(null);
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 300);
  };

  const onFiltersApply = () => {
    setAppliedFilters({ ...filters });
    if (filteredBindings.length > 0 && !filteredBindings.some((b) => b.id === selectedId)) {
      setSelectedId(filteredBindings[0]?.id || null);
    }
  };
  const onFiltersClear = () => {
    setFilters({ agentId: "", channel: "", accountId: "" });
    setAppliedFilters({ agentId: "", channel: "", accountId: "" });
  };

  const onPatchScope = (next) => {
    setPendingAction({
      label: "Patch DM scope",
      hint: `Update DM scope strategy: ${scope} → ${next} (requires config hash ${head.configHash.slice(0, 8)}…)`,
      danger: false,
      kind: "scope",
      payload: { next },
    });
  };

  const onShowAddDraft = () => {
    setShowAddDraft(true);
    setValidation(null);
  };
  const onCloseAddDraft = () => {
    setShowAddDraft(false);
    setValidation(null);
  };
  const onValidateDraft = () => {
    const v = window.validateBinding(draft, bindings);
    setValidation(v);
  };
  const onAddDraft = () => {
    setPendingAction({
      label: "Add binding",
      hint: `Add ${draft.agentId} via ${draft.match.channel} (${draft.tier}) — config hash ${head.configHash.slice(0, 8)}…`,
      danger: false,
      kind: "add",
      payload: { draft },
    });
  };

  const onUseAsSimulation = () => {
    if (!selectedBinding) return;
    const m = selectedBinding.match;
    setSimulatorInput({
      channel: m.channel,
      accountId: m.accountId,
      peer: m.peer,
      guildId: m.guildId,
      roles: (m.roles || []).join(","),
    });
  };

  const onMoveUp = () => {
    if (!selectedBinding) return;
    const i = bindings.findIndex((b) => b.id === selectedBinding.id);
    if (i <= 0) return;
    setPendingAction({
      label: "Move up",
      hint: `Reorder ${selectedBinding.agentId} (${selectedBinding.tier}) — remove + add at position ${i - 1}`,
      danger: false,
      kind: "move",
      payload: { from: i, to: i - 1, binding: selectedBinding },
    });
  };
  const onMoveDown = () => {
    if (!selectedBinding) return;
    const i = bindings.findIndex((b) => b.id === selectedBinding.id);
    if (i === -1 || i >= bindings.length - 1) return;
    setPendingAction({
      label: "Move down",
      hint: `Reorder ${selectedBinding.agentId} (${selectedBinding.tier}) — remove + add at position ${i + 1}`,
      danger: false,
      kind: "move",
      payload: { from: i, to: i + 1, binding: selectedBinding },
    });
  };

  const onRemove = () => {
    if (!selectedBinding) return;
    setPendingAction({
      label: "Remove binding",
      hint: `Delete ${selectedBinding.agentId} (${selectedBinding.tier}) match. Downstream order will shift.`,
      danger: true,
      kind: "remove",
      payload: { binding: selectedBinding },
    });
  };

  const onSimulate = () => {
    setBusy(true);
    setTimeout(() => {
      const resp = window.simulateRoute(simulatorInput, bindings);
      setLastSimulationResponse(resp);
      setBusy(false);
      // Echo to mutationResult (informational, not a mutation).
      setMutationResult({
        tone: resp.matchedBy === "default" ? "warn" : "ok",
        heading:
          resp.matchedBy === "default"
            ? `Simulated → fell to default agent ${resp.agentId}`
            : `Simulated → matched binding ${resp.matchedBy.slice(0, 8)} → ${resp.agentId}`,
        detail: `Session key: ${resp.sessionKey}`,
        atMs: Date.now(),
      });
    }, 280);
  };

  const onCancelConfirm = () => setPendingAction(null);

  const onConfirm = () => {
    if (!pendingAction) return;
    setBusy(true);
    const action = pendingAction;
    setPendingAction(null);
    setTimeout(() => {
      let result = null;
      if (action.kind === "scope") {
        const resp = window.mockPatchDmScope(action.payload.next);
        setScope(resp.dmScope);
        setHead({ ...head, dmScope: resp.dmScope, configHash: resp.configHash });
        result = {
          tone: "ok",
          heading: `DM scope patched → ${resp.dmScope}`,
          detail: `Config hash advanced.`,
          atMs: Date.now(),
          newHash: resp.configHash,
        };
      } else if (action.kind === "add") {
        const resp = window.mockAddBinding(action.payload.draft);
        setBindings((cur) => [...cur, resp.binding]);
        setHead({ ...head, configHash: resp.configHash });
        setShowAddDraft(false);
        setValidation(null);
        result = {
          tone: "ok",
          heading: `Binding added → ${resp.binding.agentId} (${resp.binding.tier})`,
          detail: `Inserted at end of queue. ${resp.warnings.length === 0 ? "0 backend warnings." : `${resp.warnings.length} backend warning(s).`}`,
          atMs: Date.now(),
          newHash: resp.configHash,
        };
        setSelectedId(resp.binding.id);
      } else if (action.kind === "remove") {
        const resp = window.mockRemoveBinding(action.payload.binding);
        setBindings((cur) => cur.filter((b) => b.id !== action.payload.binding.id));
        setHead({ ...head, configHash: resp.configHash });
        result = {
          tone: "warn",
          heading: `Binding removed → ${resp.removed.agentId} (${resp.removed.tier})`,
          detail: resp.impact,
          atMs: Date.now(),
          newHash: resp.configHash,
        };
        // Reselect first remaining.
        const remaining = bindings.filter((b) => b.id !== action.payload.binding.id);
        setSelectedId(remaining[0]?.id || null);
      } else if (action.kind === "move") {
        const { from, to, binding } = action.payload;
        const next = bindings.slice();
        next.splice(from, 1);
        next.splice(to, 0, binding);
        // Two-step (remove + add) — both calls succeed in the mock; only the addResp hash matters.
        window.mockRemoveBinding(binding);
        const addResp = window.mockAddBinding(binding);
        setBindings(next);
        setHead({ ...head, configHash: addResp.configHash });
        result = {
          tone: "ok",
          heading: `Binding reordered → ${binding.agentId} now at position ${to + 1}`,
          detail: `Two-step (remove + add) completed; both Gateway calls succeeded.`,
          atMs: Date.now(),
          newHash: addResp.configHash,
        };
      }
      if (result) setMutationResult(result);
      setBusy(false);
    }, 360);
  };

  const onRefreshActivity = () => {
    setRefreshingActivity(true);
    setTimeout(() => setRefreshingActivity(false), 250);
  };

  const onOpenAgent = (id) => alert(`Mock: open agent panel for "${id}"`);
  const onOpenSession = (key) => alert(`Mock: open session "${key}"`);

  const conflictsForSelected = selectedBinding ? conflictsByBinding[selectedBinding.id] || [] : [];

  return (
    <div className="routing-app">
      <header className="routing-app__head">
        <div className="routing-app__brand">
          <IconRoute size={22} />
          <div>
            <h1>Agent route workbench</h1>
            <p className="muted small">
              Contract-led bindings, simulation, and hash-aware routing mutations.
            </p>
          </div>
        </div>
        <div className="routing-app__head-pills">
          <span className={`pill ${totalConflicts > 0 ? "pill--warn" : "pill--ok"}`}>
            {totalConflicts > 0 ? (
              <>
                <IconAlert size={11} /> {totalConflicts} advisory conflict
                {totalConflicts === 1 ? "" : "s"}
              </>
            ) : (
              <>
                <IconCheck size={11} /> ready
              </>
            )}
          </span>
        </div>
      </header>

      <MetricStrip
        bindings={bindings}
        head={{ ...head, dmScope: scope }}
        conflictsCount={totalConflicts}
        lastSimulationAgentId={lastSimulationResponse?.agentId}
      />

      <div className="routing-app__workbench">
        <RoutingQueue
          bindings={filteredBindings}
          head={{ ...head, dmScope: scope }}
          filters={filters}
          onFiltersChange={setFilters}
          onFiltersApply={onFiltersApply}
          onFiltersClear={onFiltersClear}
          selectedId={selectedBinding?.id || null}
          onSelect={onSelect}
          conflictsByBinding={conflictsByBinding}
          onRefresh={onRefresh}
          refreshing={refreshing}
          scope={scope}
          onPatchScope={onPatchScope}
          showAddDraft={showAddDraft}
          onShowAddDraft={onShowAddDraft}
          onCloseAddDraft={onCloseAddDraft}
          draft={draft}
          setDraft={setDraft}
          onValidateDraft={onValidateDraft}
          onAddDraft={onAddDraft}
          validation={validation}
          busy={busy}
        />

        <RoutingDetail
          selectedBinding={selectedBinding}
          selectedIndex={selectedIndex}
          totalBindings={filteredBindings.length}
          conflicts={conflictsForSelected}
          configHash={head.configHash}
          pendingAction={pendingAction}
          mutationResult={mutationResult}
          simulatorInput={simulatorInput}
          setSimulatorInput={setSimulatorInput}
          lastSimulationResponse={lastSimulationResponse}
          activityEvents={activityEvents}
          refreshingActivity={refreshingActivity}
          onUseAsSimulation={onUseAsSimulation}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onRemove={onRemove}
          onSimulate={onSimulate}
          onOpenAgent={onOpenAgent}
          onOpenSession={onOpenSession}
          onRefreshActivity={onRefreshActivity}
          onCancelConfirm={onCancelConfirm}
          onConfirm={onConfirm}
          busy={busy}
        />
      </div>

      <TweaksPanel />
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<RoutingApp />);
