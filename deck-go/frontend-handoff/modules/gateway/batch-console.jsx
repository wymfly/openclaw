// batch-console.jsx — Recent gateway.batch invocations + a small composer.
//
// Shows: list of recent batches with per-batch summary stats, expandable to
// per-call rows. Composer lets the operator dry-run a batch in the prototype
// (3-phase wizard with simulated 8% per-call failure to exercise error path).

const { useMemo: useBatchMemo, useState: useBatchState } = React;

function BatchConsole({ recentBatches }) {
  const [expandedBatch, setExpandedBatch] = useBatchState(recentBatches[0]?.id || null);
  const [composer, setComposer] = useBatchState({ open: false });

  const summary = useBatchMemo(() => {
    const total = recentBatches.length;
    const totalCalls = recentBatches.reduce((s, b) => s + b.calls.length, 0);
    const failedCalls = recentBatches.reduce(
      (s, b) => s + b.results.filter((r) => !r.ok).length,
      0,
    );
    const avgDuration =
      total > 0
        ? Math.round(recentBatches.reduce((s, b) => s + (b.durationMs || 0), 0) / total)
        : 0;
    return { total, totalCalls, failedCalls, avgDuration };
  }, [recentBatches]);

  return (
    <article className="batch-console">
      <header className="batch-console__head">
        <div>
          <h2>Batch console</h2>
          <p className="batch-console__hint">
            Last {summary.total} batches · {summary.totalCalls} calls · {summary.failedCalls} failed
            · avg {summary.avgDuration}ms
          </p>
        </div>
        <button
          className="ds-btn ds-btn--primary"
          onClick={() => setComposer({ open: true })}
          title="Compose a batch dry-run"
        >
          <IconPlay size={12} /> Dry-run batch
        </button>
      </header>
      <div className="batch-console__list">
        {recentBatches.map((b) => (
          <BatchRow
            key={b.id}
            batch={b}
            expanded={expandedBatch === b.id}
            onToggle={() => setExpandedBatch((prev) => (prev === b.id ? null : b.id))}
          />
        ))}
      </div>
      {composer.open ? <BatchComposer onClose={() => setComposer({ open: false })} /> : null}
    </article>
  );
}

function BatchRow({ batch, expanded, onToggle }) {
  const failed = batch.results.filter((r) => !r.ok).length;
  const ok = batch.results.length - failed;
  const tone = failed > 0 ? "warn" : "ok";
  return (
    <div className={`batch-row batch-row--${tone} ${expanded ? "batch-row--open" : ""}`}>
      <button className="batch-row__head" onClick={onToggle} aria-expanded={expanded}>
        <span className="batch-row__chevron">
          {expanded ? <IconChevronD size={12} /> : <IconChevronR size={12} />}
        </span>
        <code className="batch-row__id">{batch.id}</code>
        <span className="batch-row__rt">
          runtime <code>{batch.runtimeId}</code>
        </span>
        <span className="batch-row__calls mono">{batch.calls.length} calls</span>
        <span className={`batch-row__stat batch-row__stat--ok mono`}>{ok} ok</span>
        {failed > 0 ? (
          <span className="batch-row__stat batch-row__stat--err mono">{failed} err</span>
        ) : null}
        <span className="batch-row__duration mono">{formatMs(batch.durationMs)}</span>
        <span className="batch-row__when">{formatRelative(batch.requestedAt)}</span>
      </button>
      {expanded ? (
        <div className="batch-row__body">
          <div className="batch-row__opts">
            <span>
              <strong>options:</strong>
            </span>
            <span>failFast={String(batch.options?.failFast ?? false)}</span>
            <span>timeoutMs={batch.options?.timeoutMs ?? "—"}</span>
          </div>
          <table className="batch-row__table">
            <thead>
              <tr>
                <th>id</th>
                <th>method</th>
                <th>params</th>
                <th>status</th>
                <th>result / error</th>
              </tr>
            </thead>
            <tbody>
              {batch.calls.map((c) => {
                const r = batch.results.find((x) => x.id === c.id);
                return (
                  <tr key={c.id}>
                    <td className="mono">{c.id}</td>
                    <td>
                      <code>{c.method}</code>
                    </td>
                    <td className="mono">{c.params ? JSON.stringify(c.params) : "—"}</td>
                    <td>
                      {r?.ok ? (
                        <span className="td-tag td-tag--ok">
                          <IconCheck size={10} /> ok
                        </span>
                      ) : (
                        <span className="td-tag td-tag--error">
                          <IconAlert size={10} /> {r?.error?.code || "err"}
                        </span>
                      )}
                    </td>
                    <td className="mono small">
                      {r?.ok
                        ? r.result
                          ? JSON.stringify(r.result)
                          : "—"
                        : (r?.error?.message || "—") +
                          (r?.error?.retryable ? ` · retryable in ${r.error.retryAfterMs}ms` : "")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function BatchComposer({ onClose }) {
  const [calls, setCalls] = useBatchState([
    { id: "c1", method: "sessions.list", params: { agentId: "main" } },
    { id: "c2", method: "channels.list", params: {} },
  ]);
  const [phase, setPhase] = useBatchState("idle"); // idle | running | done | error
  const [results, setResults] = useBatchState(null);

  const updateCall = (idx, field, value) => {
    setCalls((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };
  const removeCall = (idx) => setCalls((prev) => prev.filter((_, i) => i !== idx));
  const addCall = () =>
    setCalls((prev) => [
      ...prev,
      { id: `c${prev.length + 1}`, method: "agents.list", params: "{}" },
    ]);

  const submit = () => {
    setPhase("running");
    setTimeout(
      () => {
        const computed = calls.map((c) => {
          // 8% simulated per-call failure.
          const ok = Math.random() > 0.08;
          return ok
            ? { id: c.id, ok: true, result: { simulated: true } }
            : {
                id: c.id,
                ok: false,
                error: {
                  code: "simulated.failure",
                  message: "dry-run synthetic failure",
                  retryable: true,
                  retryAfterMs: 5_000,
                },
              };
        });
        setResults(computed);
        setPhase("done");
      },
      720 + Math.random() * 360,
    );
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Batch composer"
      onClick={onClose}
    >
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <header className="modal__head">
          <h3>Dry-run batch</h3>
          <button
            className="ds-icon-btn"
            onClick={onClose}
            aria-label="Close composer"
            disabled={phase === "running"}
          >
            <IconClose size={13} />
          </button>
        </header>
        <div className="modal__body">
          <p className="modal__hint">
            Composes a <code>gateway.batch</code> request and returns synthetic results. 8% per-call
            simulated failure.
          </p>
          {phase === "running" ? (
            <div className="phase phase--running" role="status">
              <span className="spinner" /> Submitting batch ({calls.length} calls)…
            </div>
          ) : phase === "done" ? (
            <div className="phase phase--done" role="status">
              <IconCheck size={14} /> Batch returned. {results?.filter((r) => r.ok).length} ok /{" "}
              {results?.filter((r) => !r.ok).length} err.
            </div>
          ) : null}
          <div className="composer">
            <table className="composer__table">
              <thead>
                <tr>
                  <th>id</th>
                  <th>method</th>
                  <th>params (JSON)</th>
                  <th>status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c, idx) => {
                  const r = results?.find((x) => x.id === c.id);
                  return (
                    <tr key={idx}>
                      <td className="mono">{c.id}</td>
                      <td>
                        <input
                          type="text"
                          value={c.method}
                          onChange={(e) => updateCall(idx, "method", e.target.value)}
                          disabled={phase === "running"}
                          className="composer__input mono"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={typeof c.params === "string" ? c.params : JSON.stringify(c.params)}
                          onChange={(e) => updateCall(idx, "params", e.target.value)}
                          disabled={phase === "running"}
                          className="composer__input mono"
                        />
                      </td>
                      <td>
                        {r?.ok ? (
                          <span className="td-tag td-tag--ok">ok</span>
                        ) : r ? (
                          <span className="td-tag td-tag--error">{r.error?.code}</span>
                        ) : (
                          <span className="td-tag td-tag--neutral">pending</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="ds-icon-btn"
                          onClick={() => removeCall(idx)}
                          disabled={phase === "running"}
                          aria-label={`Remove call ${c.id}`}
                        >
                          <IconClose size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button
              className="ds-btn ds-btn--ghost"
              onClick={addCall}
              disabled={phase === "running"}
            >
              + Add call
            </button>
          </div>
        </div>
        <footer className="modal__foot">
          <button className="ds-btn ds-btn--ghost" onClick={onClose} disabled={phase === "running"}>
            {phase === "done" ? "Close" : "Cancel"}
          </button>
          <button
            className="ds-btn ds-btn--primary"
            onClick={submit}
            disabled={phase === "running" || calls.length === 0}
          >
            <IconPlay size={12} /> {phase === "done" ? "Run again" : "Submit"}
          </button>
        </footer>
      </div>
    </div>
  );
}

Object.assign(window, { BatchConsole });
