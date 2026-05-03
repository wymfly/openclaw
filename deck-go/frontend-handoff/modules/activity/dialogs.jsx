// activity — dialogs
//
// Single-page feed has no list/detail split, but per-event inspection happens
// via a modal:
//   - EventDetailDialog — pretty-prints the event with copyable JSON

const { useState: _dlgState, useEffect: _dlgEffect } = React;

function EventDetailDialog({ open, event, onClose }) {
  const [copied, setCopied] = _dlgState(false);
  _dlgEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(t);
  }, [copied]);
  if (!open || !event) return null;
  const json = JSON.stringify(event, null, 2);
  const onCopy = () => {
    navigator.clipboard?.writeText(json).catch(() => {});
    setCopied(true);
  };
  const sev = eventSeverity(event.type);
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal--event"
        role="dialog"
        aria-modal="true"
        aria-label="Event detail"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <div
            className={`pill pill--${sev === "ok" ? "ok" : sev === "err" ? "err" : sev === "warn" ? "warn" : "info"}`}
          >
            <EventGlyph type={event.type} />
            <span>{event.type}</span>
          </div>
          <h3>{event.description}</h3>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}>
            <IconX />
          </button>
        </div>
        <div className="modal__body">
          <div className="diag-block">
            <div className="diag-block__label">When</div>
            <div className="meta-row">
              <span className="mono">{new Date(event.timestamp).toLocaleString()}</span>
              <span className="muted">·</span>
              <span className="kbd">{event.id}</span>
            </div>
          </div>
          {event.agentId ? (
            <div className="diag-block">
              <div className="diag-block__label">Agent</div>
              <AgentChip agentId={event.agentId} agentName={event.agentName} />
            </div>
          ) : null}
          {event.details ? (
            <div className="diag-block">
              <div className="diag-block__label">Details</div>
              <pre className="diag-block__pre">{event.details}</pre>
            </div>
          ) : null}
          <div className="diag-block">
            <div className="diag-block__label">Raw event</div>
            <pre className="code-block code-block--inline">
              <code>{json}</code>
            </pre>
          </div>
        </div>
        <div className="modal__foot">
          <button className="btn btn--ghost" type="button" onClick={onCopy}>
            <IconCopy /> {copied ? "Copied" : "Copy JSON"}
          </button>
          <button className="btn btn--primary" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { EventDetailDialog });
