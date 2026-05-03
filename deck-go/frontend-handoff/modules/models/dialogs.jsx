// models — Dialogs: ProbeResult, AuthConfig, Catalog (add model from catalog).

const { useState: _dlgState, useEffect: _dlgEffect } = React;

function ModalShell({ open, title, onClose, foot, children, wide }) {
  _dlgEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (e.key === "Escape") onClose && onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="modal"
        style={wide ? { maxWidth: 720 } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal__head">
          <h2 className="modal__title">{title}</h2>
          <button className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {foot && <footer className="modal__foot">{foot}</footer>}
      </div>
    </div>
  );
}

/* ── Probe result ─────────────────────────────────────────────── */
function ProbeResultDialog({ open, model, onClose }) {
  if (!model) return null;
  const probe = window.MOCK.probe[model.id];
  return (
    <ModalShell
      open={open}
      title={`Probe ${model.displayName}`}
      onClose={onClose}
      foot={
        <button className="btn btn--primary" onClick={onClose}>
          Done
        </button>
      }
    >
      {!probe ? (
        <div className="banner">No probe history.</div>
      ) : probe.status === "ok" ? (
        <>
          <div className="tile-row" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="tile">
              <span className="tile__label">Status</span>
              <span className="tile__value">ok</span>
              <span className="tile__delta">end-to-end success</span>
            </div>
            <div className="tile">
              <span className="tile__label">Latency</span>
              <span className="tile__value">{probe.latencyMs}ms</span>
              <span className="tile__delta">round-trip</span>
            </div>
            <div className="tile">
              <span className="tile__label">Provider</span>
              <span className="tile__value" style={{ fontSize: 14 }}>
                {probe.provider}
              </span>
              <span className="tile__delta">via runtime</span>
            </div>
          </div>
        </>
      ) : (
        <div className="banner banner--warn">
          <div>
            <strong>{probe.status}</strong> — {probe.error || "no error message"}
            {probe.reasonCode && (
              <>
                {" "}
                · code <code>{probe.reasonCode}</code>
              </>
            )}
          </div>
        </div>
      )}
      <p className="form__hint">
        Triggered via `deck.auth.probe`. Probe is cached briefly; re-run from this dialog to bypass
        cache.
      </p>
    </ModalShell>
  );
}

/* ── Auth config ──────────────────────────────────────────────── */
function AuthConfigDialog({ open, provider, onClose }) {
  const [authType, setAuthType] = _dlgState("apiKey");
  const [keyValue, setKeyValue] = _dlgState("");
  const [profileId, setProfileId] = _dlgState("");
  _dlgEffect(() => {
    if (open) {
      setKeyValue("");
      setProfileId("");
    }
  }, [open, provider]);
  if (!provider) return null;
  return (
    <ModalShell
      open={open}
      title={`Configure auth · ${authProviderDisplay(provider)}`}
      onClose={onClose}
      foot={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={onClose}>
            <IconCheck /> Save
          </button>
        </>
      }
    >
      <div className="form" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
        <div className="form__row">
          <label className="form__label">Auth type</label>
          <div className="toolbar__filter">
            {["apiKey", "oauth", "profile", "none"].map((t) => (
              <button
                key={t}
                type="button"
                className={authType === t ? "is-active" : ""}
                onClick={() => setAuthType(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <span className="form__hint">Provider may not support all types — see catalog.</span>
        </div>
        {authType === "apiKey" && (
          <div className="form__row">
            <label className="form__label" htmlFor="key">
              API key
            </label>
            <input
              id="key"
              type="password"
              className="input"
              placeholder="sk-… / sess-…"
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              autoFocus
            />
            <span className="form__hint">
              Stored in `openclaw.json` (never logged). Prefer environment variables when feasible.
            </span>
          </div>
        )}
        {authType === "profile" && (
          <div className="form__row">
            <label className="form__label" htmlFor="prof">
              Profile id
            </label>
            <input
              id="prof"
              className="input"
              placeholder="ops"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
            />
            <span className="form__hint">Resolves to a credential lookup at runtime.</span>
          </div>
        )}
        {authType === "oauth" && (
          <div className="banner">
            OAuth setup runs through the provider's vendor flow. Click <strong>Save</strong> to open
            the consent screen.
          </div>
        )}
        {authType === "none" && (
          <div className="banner banner--warn">
            <strong>No auth</strong> — the provider must accept anonymous calls (e.g. local Ollama).
          </div>
        )}
      </div>
    </ModalShell>
  );
}

/* ── Catalog (add model) ──────────────────────────────────────── */
function CatalogDialog({ open, onClose, onAdd }) {
  const [providerId, setProviderId] = _dlgState("anthropic");
  const [modelId, setModelId] = _dlgState("");
  _dlgEffect(() => {
    if (open) {
      setProviderId("anthropic");
      setModelId("");
    }
  }, [open]);
  const providers = window.MOCK.catalogProviders;
  const provider = providers.find((p) => p.id === providerId);
  const fmtCtx = (n) => (n >= 1000 ? `${(n / 1000).toFixed(0)}k` : `${n}`);
  return (
    <ModalShell
      open={open}
      wide
      title="Add model from catalog"
      onClose={onClose}
      foot={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn--primary"
            disabled={!modelId}
            onClick={() => onAdd && onAdd(modelId)}
          >
            <IconPlus /> Add to runtime
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 18 }}>
        <div style={{ display: "grid", gap: 4 }}>
          {providers.map((p) => (
            <button
              key={p.id}
              type="button"
              className={"row " + (providerId === p.id ? "is-default" : "")}
              style={{
                gridTemplateColumns: "auto 1fr",
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid var(--ds-border)",
              }}
              onClick={() => {
                setProviderId(p.id);
                setModelId("");
              }}
            >
              <ProviderGlyph id={p.id} size={20} />
              <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
                <span style={{ fontWeight: 500 }}>{p.displayName}</span>
                <small
                  style={{
                    color: "var(--ds-text-3)",
                    fontFamily: "var(--ds-font-mono)",
                    fontSize: 11,
                  }}
                >
                  {p.modelCount} models · {p.authType}
                </small>
              </span>
            </button>
          ))}
        </div>
        <div>
          {!provider ? (
            <div className="empty">Pick a provider</div>
          ) : provider.models.length === 0 ? (
            <div className="empty">
              <strong>{provider.displayName} has no listed models</strong>
              Models are discovered at runtime via the provider API.
            </div>
          ) : (
            <div className="catalog-grid" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
              {provider.models.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={"catalog-card"}
                  style={{
                    textAlign: "left",
                    borderColor: modelId === m.id ? "var(--ds-accent)" : undefined,
                    cursor: "pointer",
                  }}
                  onClick={() => setModelId(m.id)}
                >
                  <div className="catalog-card__head">
                    <ProviderGlyph id={provider.id} size={24} />
                    <span className="catalog-card__name">{m.name || m.id}</span>
                    {modelId === m.id && <IconCheck />}
                  </div>
                  <span className="catalog-card__meta">
                    {m.id} · context {fmtCtx(m.contextWindow || 0)} · max {fmtCtx(m.maxTokens || 0)}
                    {m.reasoning && " · reasoning"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

Object.assign(window, { ProbeResultDialog, AuthConfigDialog, CatalogDialog });
