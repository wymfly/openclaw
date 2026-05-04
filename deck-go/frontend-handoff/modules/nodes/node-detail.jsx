// Right pane: lifecycle hero + identity grid + pairing actions + dynamic envelope + pending work + ActionResult.

const ConfirmRow = ({ pending, onCancel, onConfirm }) => {
  if (!pending) return null;
  return (
    <div className={`confirm-row ${pending.danger ? "confirm-row--danger" : ""}`}>
      <IconAlert size={14} />
      <div className="confirm-row__body">
        <strong>Confirm {pending.label}?</strong>
        <p className="muted">{pending.hint}</p>
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

const ActionResult = ({ result }) => {
  if (!result) return null;
  return (
    <section className="action-result">
      <header className="action-result__head">
        <IconCheck size={13} />
        <span className="action-result__title">
          {result.heading} <span className="muted">{result.subhead}</span>
        </span>
        <span className="action-result__time">{formatRelative(result.atMs)}</span>
      </header>
      {result.body && <p className="action-result__body">{result.body}</p>}
      {result.payload !== undefined && <JsonView value={result.payload} copyId="result" />}
    </section>
  );
};

const PairingActions = ({ node, pending, onApprove, onReject, onRequest, onVerify, busy }) => {
  const [token, setToken] = React.useState("");
  if (pending) {
    return (
      <section className="action-card">
        <header className="action-card__head">
          <IconShield size={14} />
          <span className="action-card__label">
            {pending.isRepair ? "Repair request" : "Pairing request"}
          </span>
          <span className="action-card__sub mono">{pending.requestId}</span>
        </header>
        <p className="muted">
          Inspect the device evidence below before approving. Approving authorizes the device to use
          the operator session.
        </p>
        <div className="action-card__row">
          <button type="button" className="primary-btn" onClick={onApprove} disabled={busy}>
            <IconCheck size={13} /> Approve
          </button>
          <button type="button" className="danger-btn" onClick={onReject} disabled={busy}>
            <IconX size={13} /> Reject
          </button>
        </div>
      </section>
    );
  }
  if (!node.paired) {
    return (
      <section className="action-card">
        <header className="action-card__head">
          <IconUnlink size={14} />
          <span className="action-card__label">Unpaired</span>
        </header>
        <p className="muted">
          This device has not been paired. Send a pairing request, or paste a verification token
          minted on the device.
        </p>
        <div className="action-card__row">
          <button type="button" className="primary-btn" onClick={onRequest} disabled={busy}>
            <IconLink size={13} /> Request pairing
          </button>
        </div>
        <div className="verify-row">
          <label>
            <span className="muted-label">Verification token</span>
            <input
              type="text"
              className="text-input"
              value={token}
              placeholder="paste 6+ chars from the device"
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              if (token.trim().length >= 6) {
                onVerify(token.trim());
                setToken("");
              }
            }}
            disabled={busy || token.trim().length < 6}
          >
            <IconKey size={13} /> Verify
          </button>
        </div>
      </section>
    );
  }
  return (
    <section className="action-card action-card--idle">
      <header className="action-card__head">
        <IconShield size={14} />
        <span className="action-card__label">Trust state</span>
      </header>
      <p className="muted">Paired and connected. No pending pairing actions.</p>
    </section>
  );
};

const InvokeForm = ({ node, onSubmit, busy }) => {
  const initialCommand = node.commands?.[0] || "";
  const [command, setCommand] = React.useState(initialCommand);
  const [timeout, setTimeout] = React.useState("15000");
  const [params, setParams] = React.useState(() => COMMAND_TEMPLATES[initialCommand] || "{}");
  const [paramsError, setParamsError] = React.useState("");

  React.useEffect(() => {
    const next = node.commands?.[0] || "";
    setCommand(next);
    setParams(COMMAND_TEMPLATES[next] || "{}");
    setParamsError("");
  }, [node.nodeId]);

  const onCommandChange = (cmd) => {
    setCommand(cmd);
    setParams(COMMAND_TEMPLATES[cmd] || "{}");
    setParamsError("");
  };

  const onParamsChange = (text) => {
    setParams(text);
    try {
      JSON.parse(text);
      setParamsError("");
    } catch (e) {
      setParamsError("Invalid JSON");
    }
  };

  const submit = () => {
    if (!command || paramsError) return;
    let parsed = {};
    try {
      parsed = JSON.parse(params);
    } catch (e) {
      setParamsError("Invalid JSON");
      return;
    }
    onSubmit({ command, params: parsed, timeoutMs: Number(timeout) || 15000 });
  };

  if (!node.commands?.length) {
    return (
      <section className="action-card action-card--idle">
        <header className="action-card__head">
          <IconPlay size={14} />
          <span className="action-card__label">Invoke command</span>
        </header>
        <p className="muted">Node advertises no commands. Nothing to invoke.</p>
      </section>
    );
  }

  return (
    <section className="action-card">
      <header className="action-card__head">
        <IconPlay size={14} />
        <span className="action-card__label">Invoke command</span>
        <span className="action-card__sub muted">node.invoke (dynamic envelope)</span>
      </header>
      <div className="invoke-grid">
        <label>
          <span className="muted-label">Command</span>
          <select
            className="select-input"
            value={command}
            onChange={(e) => onCommandChange(e.target.value)}
          >
            {node.commands.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="muted-label">Timeout (ms)</span>
          <input
            type="text"
            className="text-input"
            value={timeout}
            onChange={(e) => setTimeout(e.target.value)}
          />
        </label>
      </div>
      <label className="invoke-params">
        <span className="muted-label">Params (JSON)</span>
        <textarea
          className="code-input"
          value={params}
          onChange={(e) => onParamsChange(e.target.value)}
          spellCheck="false"
          rows={5}
        />
      </label>
      {paramsError && (
        <p className="error-line">
          <IconAlert size={12} /> {paramsError}
        </p>
      )}
      <div className="action-card__row">
        <button
          type="button"
          className="primary-btn"
          onClick={submit}
          disabled={busy || !!paramsError || !command}
        >
          <IconPlay size={13} /> Invoke…
        </button>
        <span className="muted hint-line">Confirmation required.</span>
      </div>
    </section>
  );
};

const PendingWorkForm = ({ node, onSubmit, busy }) => {
  const [type, setType] = React.useState("status.request");
  const [priority, setPriority] = React.useState("normal");
  const [wake, setWake] = React.useState(true);
  const submit = () => onSubmit({ type, priority, wake });
  return (
    <section className="action-card">
      <header className="action-card__head">
        <IconQueue size={14} />
        <span className="action-card__label">Pending work</span>
        <span className="action-card__sub muted">node.pending.enqueue</span>
      </header>
      <div className="invoke-grid">
        <label>
          <span className="muted-label">Type</span>
          <select className="select-input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="status.request">status.request</option>
            <option value="location.request">location.request</option>
          </select>
        </label>
        <label>
          <span className="muted-label">Priority</span>
          <select
            className="select-input"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="normal">normal</option>
            <option value="high">high</option>
          </select>
        </label>
      </div>
      <label className="checkbox-row">
        <input type="checkbox" checked={wake} onChange={(e) => setWake(e.target.checked)} />
        <span>Wake the device when it next checks in</span>
      </label>
      <div className="action-card__row">
        <button type="button" className="primary-btn" onClick={submit} disabled={busy}>
          <IconQueue size={13} /> Queue work…
        </button>
        <span className="muted hint-line">Confirmation required.</span>
      </div>
    </section>
  );
};

const RenameForm = ({ node, onSubmit, busy }) => {
  const [name, setName] = React.useState(node.displayName || node.nodeId);
  React.useEffect(() => {
    setName(node.displayName || node.nodeId);
  }, [node.nodeId]);
  const dirty = name.trim() !== (node.displayName || node.nodeId).trim();
  return (
    <div className="rename-row">
      <input
        type="text"
        className="text-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Rename node"
      />
      <button
        type="button"
        className="ghost-btn"
        onClick={() => dirty && onSubmit(name.trim())}
        disabled={busy || !dirty || !name.trim()}
      >
        <IconWrench size={12} /> Rename
      </button>
    </div>
  );
};

const NodeDetail = ({
  node,
  pending,
  pairingMode,
  onRename,
  onPairAction,
  onInvoke,
  onPendingEnqueue,
  pendingAction,
  onConfirm,
  onCancelConfirm,
  actionResult,
  busy,
}) => {
  if (!node && !pairingMode) {
    return (
      <main className="node-detail node-detail--empty">
        <div className="empty-card">
          <IconNode size={28} />
          <h2>Pick a node</h2>
          <p className="muted">
            Select a node or pending pairing request from the rail to see its lifecycle and remote
            actions.
          </p>
        </div>
      </main>
    );
  }

  // Orphan pairing: a pending request with no matching node.
  if (!node) {
    return (
      <main className="node-detail node-detail--orphan">
        <header className="orphan-hero">
          <div>
            <span className="muted-label">Orphan request</span>
            <h1>{pairingMode.displayName || pairingMode.nodeId}</h1>
            <p className="muted mono">{pairingMode.requestId}</p>
          </div>
          <span className="pill warn">orphan · approve or reject</span>
        </header>
        <ConfirmRow pending={pendingAction} onCancel={onCancelConfirm} onConfirm={onConfirm} />
        <ActionResult result={actionResult} />
        <section className="action-card">
          <header className="action-card__head">
            <IconShield size={14} />
            <span className="action-card__label">Pairing request</span>
            <span className="action-card__sub muted">
              {pairingMode.platform || "unknown platform"} · {formatRelative(pairingMode.ts)}
            </span>
          </header>
          <p className="muted">
            This request has no matching device in the inventory. Approve only if you can
            independently verify the device id <span className="mono">{pairingMode.nodeId}</span>.
          </p>
          <div className="action-card__row">
            <button
              type="button"
              className="primary-btn"
              onClick={() => onPairAction("approve", pairingMode)}
              disabled={busy}
            >
              <IconCheck size={13} /> Approve
            </button>
            <button
              type="button"
              className="danger-btn"
              onClick={() => onPairAction("reject", pairingMode)}
              disabled={busy}
            >
              <IconX size={13} /> Reject
            </button>
          </div>
        </section>
        <section className="action-card action-card--idle">
          <header className="action-card__head">
            <IconHash size={14} />
            <span className="action-card__label">Raw request</span>
          </header>
          <JsonView value={pairingMode} copyId="pairing.request" />
        </section>
      </main>
    );
  }

  const tone = lifecycleTone(node, pending);

  return (
    <main className="node-detail">
      <header className="detail-hero">
        <div className="detail-hero__head">
          <div className="detail-hero__id">
            <h1>{node.displayName || node.nodeId}</h1>
            <RenameForm node={node} onSubmit={onRename} busy={busy} />
          </div>
          <div className="detail-hero__pills">
            <PlatformPill platform={node.platform} />
            <span className={`pill pill--${tone.tone}`}>
              {tone.tone === "ok" && <IconWifi size={11} />}
              {tone.tone === "warn" && <IconAlert size={11} />}
              {tone.tone === "neutral" && <IconUnlink size={11} />}
              {tone.label}
            </span>
            {node.connectedAtMs && (
              <span className="pill mini">
                <IconClock size={11} /> seen {formatRelative(node.connectedAtMs)}
              </span>
            )}
          </div>
        </div>
        <div className="detail-hero__meta">
          <div>
            <span className="muted-label">Node id</span>
            <span className="mono">{node.nodeId}</span>
          </div>
          {node.modelIdentifier && (
            <div>
              <span className="muted-label">Model</span>
              <span>{node.modelIdentifier}</span>
            </div>
          )}
          {node.remoteIp && (
            <div>
              <span className="muted-label">Remote IP</span>
              <span className="mono">{node.remoteIp}</span>
            </div>
          )}
          <div>
            <span className="muted-label">Versions</span>
            <span className="mono">
              v{node.version || "—"} · core {node.coreVersion || "—"} · ui {node.uiVersion || "—"}
            </span>
          </div>
        </div>
      </header>

      <ConfirmRow pending={pendingAction} onCancel={onCancelConfirm} onConfirm={onConfirm} />
      <ActionResult result={actionResult} />

      <PairingActions
        node={node}
        pending={pending}
        onApprove={() => onPairAction("approve", pending)}
        onReject={() => onPairAction("reject", pending)}
        onRequest={() => onPairAction("request", null, node)}
        onVerify={(token) => onPairAction("verify", null, node, token)}
        busy={busy}
      />

      <section className="action-card action-card--cap">
        <header className="action-card__head">
          <IconCpu size={14} />
          <span className="action-card__label">Capabilities & commands</span>
          <span className="action-card__sub muted">
            {node.caps.length} caps · {node.commands.length} commands
          </span>
        </header>
        <div className="cap-block">
          <span className="muted-label">Capabilities</span>
          <CapsCluster caps={node.caps} max={8} />
        </div>
        <div className="cap-block">
          <span className="muted-label">Commands</span>
          {node.commands.length > 0 ? (
            <div className="caps-cluster">
              {node.commands.map((c) => (
                <span key={c} className="cap-chip cap-chip--cmd">
                  <IconTerminal size={10} /> {c}
                </span>
              ))}
            </div>
          ) : (
            <span className="muted">no commands advertised</span>
          )}
        </div>
        <div className="cap-block">
          <span className="muted-label">Permissions</span>
          <PermissionGrid permissions={node.permissions} />
        </div>
        {node.pathEnv && (
          <div className="cap-block">
            <span className="muted-label">PATH</span>
            <code className="path-env">{node.pathEnv}</code>
          </div>
        )}
      </section>

      <InvokeForm node={node} onSubmit={(args) => onInvoke(args)} busy={busy} />

      <PendingWorkForm node={node} onSubmit={(args) => onPendingEnqueue(args)} busy={busy} />

      <section className="action-card action-card--raw">
        <header className="action-card__head">
          <IconHash size={14} />
          <span className="action-card__label">Raw node summary</span>
          <span className="action-card__sub muted">DeckGoNodeSummary</span>
        </header>
        <JsonView value={node} copyId={node.nodeId} />
      </section>
    </main>
  );
};

Object.assign(window, {
  NodeDetail,
  ConfirmRow,
  ActionResult,
  PairingActions,
  InvokeForm,
  PendingWorkForm,
  RenameForm,
});
