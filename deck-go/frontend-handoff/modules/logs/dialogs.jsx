/* deck-go logs prototype v2 — dialogs (RawLineDialog + ExportPreviewDialog) */

function ModalShell({ title, subtitle, onClose, children, size = "md" }) {
  React.useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div
        className={`modal modal--${size}`}
        onMouseDown={(e) => e.stopPropagation()}
        role="document"
      >
        <header className="modal__head">
          <div className="modal__title">
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            <IconClose size={14} />
          </button>
        </header>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

function RawLineDialog({ entry, kind, onClose }) {
  if (!entry) return null;
  const title = kind === "tape" ? entry.id : `cursor #${entry.cursor}`;
  const subtitle = kind === "tape" ? `event=${entry.event}` : `${entry.level} · ${entry.source}`;
  const payload = kind === "tape" ? entry.json : entry;
  return (
    <ModalShell title={title} subtitle={subtitle} onClose={onClose} size="md">
      <pre className="modal__code">{JSON.stringify(payload, null, 2)}</pre>
      <div className="modal__actions">
        <button type="button" className="modal__btn" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}

function ExportPreviewDialog({ visible, query, onClose }) {
  const sample = visible.slice(0, 6);
  const filterTag = query ? ` (filter "${query}")` : "";
  const formatted = sample
    .map(
      (l) =>
        `${l.ts} [${l.level.toUpperCase()}] [${l.source}] sessionKey=${l.sessionKey}${l.correlationId ? ` cid=${l.correlationId}` : ""} | ${l.message}`,
    )
    .join("\n");

  return (
    <ModalShell
      title="Prepared export"
      subtitle={`${visible.length} filtered rows${filterTag} — preview shows first 6`}
      onClose={onClose}
      size="md"
    >
      <pre className="modal__code modal__code--export">
        {formatted || "(no rows match the current filters)"}
      </pre>
      <p className="modal__note">
        Real export wires through <code>/api/deck/logs/export</code> as a multipart download. The
        prototype only renders the preview.
      </p>
      <div className="modal__actions">
        <button type="button" className="modal__btn" onClick={onClose}>
          Close
        </button>
        <button type="button" className="modal__btn modal__btn--primary" disabled>
          Download .log
        </button>
      </div>
    </ModalShell>
  );
}

Object.assign(window, { ModalShell, RawLineDialog, ExportPreviewDialog });
