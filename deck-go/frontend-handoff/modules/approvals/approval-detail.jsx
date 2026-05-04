// ApprovalDetail — right pane: hero (countdown + actor) + tabs (Overview /
// Argv / Plan / Activity) + DecisionBar at bottom.

const TABS_EXEC = ["overview", "argv", "plan", "activity"];
const TABS_PLUGIN = ["overview", "scopes", "source", "activity"];

const ApprovalDetail = ({ entry, recentDecisions, onDecide }) => {
  const [tab, setTab] = React.useState("overview");
  React.useEffect(() => {
    setTab("overview");
  }, [entry?.id]);

  if (!entry) {
    return (
      <div className="approval-detail approval-detail--empty">
        <div className="approval-detail__empty-card">
          <IconShield />
          <p>Pick a pending approval from the queue.</p>
          <p className="muted">Decisions are auditable. Auto-allowed entries surface here too.</p>
        </div>
      </div>
    );
  }

  const tabs = entry.__kind === "plugin" ? TABS_PLUGIN : TABS_EXEC;
  const sameAgentDecisions = recentDecisions
    .filter((d) => (entry.__kind === "exec" ? d.agentId === entry.agentId : d.kind === "plugin"))
    .slice(0, 6);

  return (
    <div className="approval-detail">
      <div className="approval-detail__hero">
        <div className="approval-detail__hero-head">
          <KindBadge kind={entry.__kind} />
          <code className="approval-detail__id">{entry.id}</code>
          <CountdownTimer expiresAtMs={entry.expiresAtMs} />
        </div>
        <h2 className="approval-detail__title">
          {entry.__kind === "exec" ? entry.command : entry.pluginName || entry.pluginId}
        </h2>
        <div className="approval-detail__hero-meta">
          {entry.__kind === "exec" ? (
            <>
              <span className="approval-detail__meta-cell">
                <IconUser />
                {entry.agentId || "—"}
              </span>
              <span className="approval-detail__meta-cell">
                <IconTerminal />
                {entry.cwd || "—"}
              </span>
              <span className="approval-detail__meta-cell">
                <IconHistory />
                {entry.runId}
              </span>
              <span className="approval-detail__meta-cell">
                <IconClock />
                {formatRelative(entry.createdAtMs)}
              </span>
            </>
          ) : (
            <>
              <span className="approval-detail__meta-cell">
                <IconPlug />
                {entry.pluginId}
              </span>
              <span className="approval-detail__meta-cell">
                <IconUser />
                {entry.requester}
              </span>
              <span className="approval-detail__meta-cell">
                <IconBolt />
                {entry.capabilityKind}
              </span>
              <span className="approval-detail__meta-cell">
                <IconClock />
                {formatRelative(entry.createdAtMs)}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="approval-detail__tabs" role="tablist" aria-label="Approval detail tabs">
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`approval-detail__tab ${tab === t ? "approval-detail__tab--on" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="approval-detail__body">
        {tab === "overview" && <DetailOverview entry={entry} />}
        {tab === "argv" && entry.__kind === "exec" && <DetailArgv entry={entry} />}
        {tab === "plan" && entry.__kind === "exec" && <DetailPlan entry={entry} />}
        {tab === "scopes" && entry.__kind === "plugin" && <DetailScopes entry={entry} />}
        {tab === "source" && entry.__kind === "plugin" && <DetailSource entry={entry} />}
        {tab === "activity" && <DetailActivity recent={sameAgentDecisions} />}
      </div>

      <DecisionBar entry={entry} onDecide={onDecide} />
    </div>
  );
};

const DetailOverview = ({ entry }) => (
  <div className="detail-section">
    <h4 className="detail-section__title">Why operator was asked</h4>
    {entry.__kind === "exec" ? (
      <ul className="detail-list">
        <li>
          Command not in allowlist (
          <code>{entry.commandArgv?.[0] || entry.command.split(" ")[0]}</code>)
        </li>
        <li>
          Agent <code>{entry.agentId}</code> policy requires explicit ask
        </li>
        <li>
          Run id <code>{entry.runId}</code> reached approval gate
        </li>
      </ul>
    ) : (
      <ul className="detail-list">
        <li>
          Plugin <code>{entry.pluginId}</code> requesting capability{" "}
          <code>{entry.capabilityKind}</code>
        </li>
        <li>
          Requested scopes: <code>{(entry.requestedScopes || []).join(", ")}</code>
        </li>
        <li>
          Origin: <code>{entry.origin}</code> (auto-allow disabled for extensions)
        </li>
      </ul>
    )}
    <h4 className="detail-section__title">Risk surface</h4>
    <p className="detail-section__body">
      {entry.__kind === "exec"
        ? "Exec approval grants single-shot or persistent access to run the command via the agent's runtime. Allow once is safest; allow always extends the policy allowlist permanently."
        : "Plugin approval grants the plugin its declared scopes globally for this deck. Plugins from extensions are not auto-allowed by default."}
    </p>
  </div>
);

const DetailArgv = ({ entry }) => (
  <div className="detail-section">
    <h4 className="detail-section__title">Parsed argv</h4>
    <pre className="json-block">{JSON.stringify(entry.commandArgv || [], null, 2)}</pre>
    <h4 className="detail-section__title">Working directory</h4>
    <code className="detail-mono">{entry.cwd || "—"}</code>
  </div>
);

const DetailPlan = ({ entry }) => (
  <div className="detail-section">
    <h4 className="detail-section__title">Approval plan</h4>
    <p className="muted small">
      Upstream <code>SystemRunApprovalPlan</code> is null for this entry — most exec approvals do
      not carry a plan.
    </p>
    <pre className="json-block">
      {JSON.stringify(
        {
          systemRunBinding: null,
          systemRunPlan: null,
          effectiveDecisionScope: entry.agentId ? `agent:${entry.agentId}` : "global",
        },
        null,
        2,
      )}
    </pre>
  </div>
);

const DetailScopes = ({ entry }) => (
  <div className="detail-section">
    <h4 className="detail-section__title">Requested scopes</h4>
    <ul className="detail-list">
      {(entry.requestedScopes || []).map((s) => (
        <li key={s}>
          <code>{s}</code>
        </li>
      ))}
    </ul>
    <h4 className="detail-section__title">Capability kind</h4>
    <code className="detail-mono">{entry.capabilityKind}</code>
  </div>
);

const DetailSource = ({ entry }) => (
  <div className="detail-section">
    <h4 className="detail-section__title">Plugin source</h4>
    <ul className="detail-list">
      <li>
        Plugin id: <code>{entry.pluginId}</code>
      </li>
      <li>
        Origin: <code>{entry.origin}</code>
      </li>
      <li>
        Source URL: <code>{entry.sourceUrl}</code>
      </li>
      <li>
        Requester: <code>{entry.requester}</code>
      </li>
    </ul>
  </div>
);

const DetailActivity = ({ recent }) => (
  <div className="detail-section">
    <h4 className="detail-section__title">Recent decisions on this scope</h4>
    {recent.length === 0 ? (
      <p className="muted">No prior decisions in audit window.</p>
    ) : (
      <ul className="detail-activity">
        {recent.map((d) => (
          <li key={d.id}>
            <DecisionBadge decision={d.decision} />
            <CommandTag command={d.command} />
            <span className="muted small">{d.actor}</span>
            <span className="muted small">{formatRelative(d.decidedAtMs)}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

// -- DecisionBar ----------------------------------------------------------

const DecisionBar = ({ entry, onDecide }) => {
  const [reason, setReason] = React.useState("");
  const [phase, setPhase] = React.useState("idle"); // idle | submitting | done
  const handle = (decision) => {
    setPhase("submitting");
    setTimeout(() => {
      onDecide(entry.id, decision, reason);
      setPhase("done");
      setTimeout(() => {
        setPhase("idle");
        setReason("");
      }, 600);
    }, 480);
  };
  const locked = phase !== "idle";
  return (
    <div className="decision-bar">
      <input
        type="text"
        className="decision-bar__reason"
        placeholder="Reason (optional, recorded in audit)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={locked}
      />
      <div className="decision-bar__actions">
        <button
          className="decision-bar__btn decision-bar__btn--deny"
          onClick={() => handle("deny")}
          disabled={locked}
        >
          <IconClose />
          Deny
        </button>
        <button
          className="decision-bar__btn decision-bar__btn--allow"
          onClick={() => handle("allow_once")}
          disabled={locked}
        >
          <IconCheck />
          Allow once
        </button>
        <button
          className="decision-bar__btn decision-bar__btn--allow-strong"
          onClick={() => handle("allow_always")}
          disabled={locked}
        >
          <IconShield />
          Allow always
        </button>
      </div>
      {phase === "submitting" && (
        <div className="decision-bar__phase decision-bar__phase--running" role="status">
          Submitting decision…
        </div>
      )}
      {phase === "done" && (
        <div className="decision-bar__phase decision-bar__phase--done">
          <IconCheck />
          Decision recorded.
        </div>
      )}
    </div>
  );
};

Object.assign(window, { ApprovalDetail });
