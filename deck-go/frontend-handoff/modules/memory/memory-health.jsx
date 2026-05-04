// MemoryHealth — Health tab. Per-agent embedding status table from
// DeckGoMemoryHealthResponse.entries.

const STATUS_LABELS = { ok: "OK", error: "Error", unknown: "Unknown" };

const StatusCell = ({ status, error }) => {
  const Icon = status === "ok" ? IconCheck : status === "error" ? IconAlert : IconQuestion;
  return (
    <span className={`memory-health__status memory-health__status--${status}`}>
      <Icon />
      <span>{STATUS_LABELS[status] || status}</span>
      {error && <span className="memory-health__status-detail muted small">— {error}</span>}
    </span>
  );
};

const MemoryHealth = () => {
  const okCount = HEALTH.entries.filter((e) => e.embeddingStatus === "ok").length;
  const errCount = HEALTH.entries.filter((e) => e.embeddingStatus === "error").length;
  const unkCount = HEALTH.entries.filter((e) => e.embeddingStatus === "unknown").length;

  return (
    <div className="memory-health">
      <div className="memory-health__summary">
        <div
          className={`memory-health__kpi memory-health__kpi--${HEALTH.lanceDbEnabled ? "ok" : "warn"}`}
        >
          <span className="memory-health__kpi-label muted small">LanceDB</span>
          <span className="memory-health__kpi-value">
            {HEALTH.lanceDbEnabled ? (
              <>
                <IconCheck /> enabled
              </>
            ) : (
              <>
                <IconAlert /> disabled
              </>
            )}
          </span>
        </div>
        <div className="memory-health__kpi">
          <span className="memory-health__kpi-label muted small">Total agents</span>
          <span className="memory-health__kpi-value">{HEALTH.entries.length}</span>
        </div>
        <div className="memory-health__kpi memory-health__kpi--ok">
          <span className="memory-health__kpi-label muted small">Healthy</span>
          <span className="memory-health__kpi-value">{okCount}</span>
        </div>
        <div className={`memory-health__kpi ${errCount > 0 ? "memory-health__kpi--err" : ""}`}>
          <span className="memory-health__kpi-label muted small">Errors</span>
          <span className="memory-health__kpi-value">{errCount}</span>
        </div>
        <div className={`memory-health__kpi ${unkCount > 0 ? "memory-health__kpi--warn" : ""}`}>
          <span className="memory-health__kpi-label muted small">Unknown</span>
          <span className="memory-health__kpi-value">{unkCount}</span>
        </div>
      </div>

      <table className="memory-health__table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Provider</th>
            <th>Embedding status</th>
          </tr>
        </thead>
        <tbody>
          {HEALTH.entries.map((entry) => (
            <tr key={entry.agentId}>
              <td>
                <AgentDot agentId={entry.agentId} />
              </td>
              <td>
                <code className="memory-health__provider">{entry.provider}</code>
              </td>
              <td>
                <StatusCell status={entry.embeddingStatus} error={entry.error} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="memory-health__hint muted small">
        Production polls <code>GET /api/memory/health</code> on a 30s interval. The error column
        surfaces the BFF-reported reason verbatim — embedding-provider rate limits, auth failures,
        and LanceDB connection drops are the typical causes.
      </p>
    </div>
  );
};

Object.assign(window, { MemoryHealth });
