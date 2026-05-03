// plugins — dialogs
//
// Read-only domain → no install/uninstall wizard. The three dialogs are:
//   - DiagnosticDetailDialog (full message + level + remediation hint)
//   - ManifestPreviewDialog (BFF-projected manifest JSON, copyable)
//   - RawJsonDialog (view raw DeckGoPluginInventoryEntry, debug-shaped)

const { useState: _dlgState, useEffect: _dlgEffect } = React;

function DiagnosticDetailDialog({ open, plugin, diagnostic, onClose }) {
  if (!open || !plugin || !diagnostic) return null;
  const Icon =
    diagnostic.level === "error"
      ? IconErrorCircle
      : diagnostic.level === "warn"
        ? IconAlert
        : IconInfo;
  const remediation =
    diagnostic.level === "error"
      ? "Check runtime logs and restart Gateway. Common causes: missing binary, blocked port, expired credentials."
      : diagnostic.level === "warn"
        ? "Plugin is running but may degrade. Investigate when convenient — does not block deck-go startup."
        : "Informational. No action required unless behavior diverges from expected.";
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal--diag"
        role="dialog"
        aria-modal="true"
        aria-label="Diagnostic detail"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <div className={`pill pill--${diagnostic.level}`}>
            <Icon /> <span>{diagnostic.level.toUpperCase()}</span>
          </div>
          <h3>{plugin.name || plugin.id}</h3>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}>
            <IconX />
          </button>
        </div>
        <div className="modal__body">
          <div className="diag-block">
            <div className="diag-block__label">Message</div>
            <pre className="diag-block__pre">{diagnostic.message}</pre>
          </div>
          <div className="diag-block">
            <div className="diag-block__label">Source</div>
            <div className="diag-block__row">
              <span className="kbd">{plugin.id}</span>
              <span className="muted">·</span>
              <span>v{plugin.version || "unknown"}</span>
              <span className="muted">·</span>
              <span>{plugin.origin || "unknown"}</span>
            </div>
          </div>
          <div className="diag-block">
            <div className="diag-block__label">Remediation hint</div>
            <p>{remediation}</p>
          </div>
        </div>
        <div className="modal__foot">
          <button className="btn btn--ghost" type="button" onClick={onClose}>
            Close
          </button>
          <button className="btn btn--primary" type="button" onClick={onClose}>
            <IconRefresh /> Re-check on next sync
          </button>
        </div>
      </div>
    </div>
  );
}

function ManifestPreviewDialog({ open, plugin, manifest, onClose }) {
  const [copied, setCopied] = _dlgState(false);
  _dlgEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(t);
  }, [copied]);
  if (!open || !plugin) return null;
  const isProjected = !!manifest;
  const body = manifest || {
    id: plugin.id,
    name: plugin.name,
    version: plugin.version,
    origin: plugin.origin,
    capabilityKinds: plugin.capabilityKinds || [],
    channelIds: plugin.channelIds || [],
    providerIds: plugin.providerIds || [],
    toolNames: plugin.toolNames || [],
    deckActions: plugin.deckActionCapabilities || {},
    note: "BFF could not project a richer manifest; falling back to plugins.list fields.",
  };
  const json = JSON.stringify(body, null, 2);
  const onCopy = () => {
    navigator.clipboard?.writeText(json).catch(() => {});
    setCopied(true);
  };
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal--manifest"
        role="dialog"
        aria-modal="true"
        aria-label="Manifest preview"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <div className="pill pill--info">
            <IconBookOpen /> <span>MANIFEST</span>
          </div>
          <h3>{plugin.name || plugin.id}</h3>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}>
            <IconX />
          </button>
        </div>
        <div className="modal__body modal__body--code">
          {!isProjected ? (
            <div className="banner banner--muted">
              <IconInfo /> BFF returned no projected manifest for this plugin. Showing inventory
              fields as a fallback.
            </div>
          ) : null}
          <pre className="code-block">
            <code>{json}</code>
          </pre>
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

function RawJsonDialog({ open, plugin, onClose }) {
  const [copied, setCopied] = _dlgState(false);
  _dlgEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(t);
  }, [copied]);
  if (!open || !plugin) return null;
  const json = JSON.stringify(plugin, null, 2);
  const onCopy = () => {
    navigator.clipboard?.writeText(json).catch(() => {});
    setCopied(true);
  };
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal--raw"
        role="dialog"
        aria-modal="true"
        aria-label="Raw inventory entry"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <div className="pill pill--muted">
            <IconCode /> <span>RAW</span>
          </div>
          <h3>DeckGoPluginInventoryEntry</h3>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}>
            <IconX />
          </button>
        </div>
        <div className="modal__body modal__body--code">
          <pre className="code-block">
            <code>{json}</code>
          </pre>
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

Object.assign(window, { DiagnosticDetailDialog, ManifestPreviewDialog, RawJsonDialog });
