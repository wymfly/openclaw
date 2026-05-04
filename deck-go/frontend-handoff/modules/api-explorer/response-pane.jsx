// ResponsePane — right pane: status row + 3 tabs (body / headers / trace).
// Shows last-run result, including error path when statusCode >= 400 or
// network failure. Body is HighlightedJson read-only; copy button on each
// tab.

const RESPONSE_TABS = [
  { id: "body", label: "Body" },
  { id: "headers", label: "Headers" },
  { id: "trace", label: "Trace" },
];

const ResponsePane = ({ response, running, lastDurationMs, copiedKey, onCopy }) => {
  const [tab, setTab] = React.useState("body");

  if (running) {
    return (
      <div className="response-pane">
        <div className="response-pane__head response-pane__head--running">
          <Spinner />
          <span>Running…</span>
        </div>
        <div className="response-pane__body response-pane__body--center">
          <p className="muted small">
            Awaiting Gateway response. Click <strong>Run</strong> again to cancel.
          </p>
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="response-pane">
        <div className="response-pane__head response-pane__head--idle">
          <span className="muted">No response yet</span>
        </div>
        <div className="response-pane__body response-pane__body--center">
          <p className="muted small">
            Click <strong>Run</strong> to send the request to the gateway.
          </p>
        </div>
      </div>
    );
  }

  const ok = response.success !== false && response.statusCode < 400;

  return (
    <div className="response-pane">
      <div className={`response-pane__head response-pane__head--${ok ? "ok" : "err"}`}>
        <StatusCodeBadge statusCode={response.statusCode} />
        <span className="response-pane__status-text">
          {ok ? "Success" : response.error || "Failed"}
        </span>
        <span className="response-pane__duration">
          <IconClock />
          {lastDurationMs ? `${lastDurationMs}ms` : "—"}
        </span>
        <span className="response-pane__size muted small">
          {response.body ? formatBytes(new Blob([JSON.stringify(response.body)]).size) : "0 B"}
        </span>
      </div>

      <nav className="response-pane__tabs">
        {RESPONSE_TABS.map((t) => (
          <button
            key={t.id}
            className={`response-tab ${tab === t.id ? "response-tab--on" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <span className="response-pane__tab-spacer" />
        <button
          className="response-pane__copy"
          onClick={() =>
            onCopy(tab === "body" ? "body" : tab === "headers" ? "headers" : "trace", response)
          }
          aria-label="Copy"
        >
          <IconCopy />
          {copiedKey === tab ? "Copied" : "Copy"}
        </button>
      </nav>

      <div className="response-pane__body">
        {tab === "body" &&
          (response.error ? (
            <ErrorBlock error={response.error} body={response.body} />
          ) : (
            <HighlightedJson value={response.body} maxHeight={500} />
          ))}
        {tab === "headers" && <HeadersBlock headers={response.headers || {}} />}
        {tab === "trace" && <TraceBlock response={response} />}
      </div>
    </div>
  );
};

const ErrorBlock = ({ error, body }) => (
  <div className="error-block">
    <div className="error-block__head">
      <IconAlert />
      <code>{error}</code>
    </div>
    {body && <HighlightedJson value={body} maxHeight={300} />}
  </div>
);

const HeadersBlock = ({ headers }) => {
  const rows = Object.entries(headers);
  if (rows.length === 0) return <p className="muted small">No response headers.</p>;
  return (
    <table className="headers-table">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td>
              <code>{k}</code>
            </td>
            <td>
              <code className="muted">{v}</code>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const TraceBlock = ({ response }) => {
  const traceId = (response.headers && response.headers["x-deck-trace"]) || "—";
  const spans = response._spans || SYNTHETIC_SPANS;
  return (
    <div className="trace-block">
      <div className="trace-block__head">
        <span className="muted small">Trace id</span>
        <code>{traceId}</code>
      </div>
      <div className="trace-block__spans">
        {spans.map((s, i) => (
          <div key={i} className="trace-span">
            <span className="trace-span__name">{s.name}</span>
            <div className="trace-span__bar">
              <div
                className={`trace-span__fill trace-span__fill--${s.tone || "info"}`}
                style={{
                  marginLeft: `${(s.startMs / 200) * 100}%`,
                  width: `${(s.durMs / 200) * 100}%`,
                }}
              />
            </div>
            <span className="trace-span__dur muted small">{s.durMs}ms</span>
          </div>
        ))}
      </div>
      <p className="muted small trace-block__hint">
        Trace spans are projected from the Gateway transport — see <code>x-deck-trace</code>
        header for the full distributed trace id (production: send through OpenTelemetry).
      </p>
    </div>
  );
};

const SYNTHETIC_SPANS = [
  { name: "ws.handshake", startMs: 0, durMs: 8, tone: "info" },
  { name: "auth.verify", startMs: 8, durMs: 12, tone: "info" },
  { name: "scope.check", startMs: 20, durMs: 4, tone: "info" },
  { name: "method.resolve", startMs: 24, durMs: 3, tone: "info" },
  { name: "handler.run", startMs: 27, durMs: 96, tone: "ok" },
  { name: "result.encode", startMs: 123, durMs: 9, tone: "info" },
  { name: "ws.respond", startMs: 132, durMs: 6, tone: "info" },
];

Object.assign(window, { ResponsePane });
