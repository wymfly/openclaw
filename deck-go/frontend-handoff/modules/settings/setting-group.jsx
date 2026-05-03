// setting-group.jsx — Per-section curated renderers.
//
// Each section has a fixed shape, drawn from the deck-go contract. Bundled
// runtime mode forces every runtime field READ-ONLY; remote mode opens the
// URL/token/tlsVerify edit lane.

const { useState } = React;

function relativeTime(now, ts) {
  const diff = Math.max(0, now - ts);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatAbsolute(ts) {
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function GroupShell({ title, description, badge, children, footer }) {
  return (
    <article className="setting-group">
      <header className="setting-group__head">
        <div>
          <p className="setting-group__eyebrow">section</p>
          <h2 className="setting-group__title">{title}</h2>
          <p className="setting-group__hint">{description}</p>
        </div>
        {badge ? <div className="setting-group__badge">{badge}</div> : null}
      </header>
      <div className="setting-group__body">{children}</div>
      {footer ? <footer className="setting-group__footer">{footer}</footer> : null}
    </article>
  );
}

function FieldRow({ label, hint, locked, children, error }) {
  return (
    <div
      className={`setting-row${locked ? " setting-row--locked" : ""}${error ? " setting-row--error" : ""}`}
    >
      <div className="setting-row__head">
        <label className="setting-row__label">{label}</label>
        {locked ? (
          <window.StatusPill tone="iron" icon={window.IconLock}>
            read-only
          </window.StatusPill>
        ) : null}
      </div>
      {hint ? <p className="setting-row__hint">{hint}</p> : null}
      <div className="setting-row__control">{children}</div>
      {error ? <p className="setting-row__error">{error}</p> : null}
    </div>
  );
}

// ── Identity & access ─────────────────────────────────────────────────────

function IdentityGroup({ settings, onChange, locked }) {
  const [reveal, setReveal] = useState(false);
  const tokenLabel = settings.accessTokenConfigured
    ? reveal
      ? "openclaw_at_••••3a91" // never render the real token in UI
      : "•••••••••••••••••"
    : "(not configured)";

  return (
    <GroupShell
      title="Identity & access"
      description="The access token authenticates this Deck-go instance. Source 'env' means the token comes from the .env file (read-only); 'json' means it's stored in the JSON config and editable here."
      badge={<window.SourcePill source={settings.accessTokenSource} />}
    >
      <FieldRow
        label="Access token"
        hint={
          settings.accessTokenSource === "env"
            ? "Defined by ACCESS_TOKEN in .env. To rotate, edit the .env file and restart deck-go."
            : "Stored in deck-go-settings.json. Click Rotate to generate a new token."
        }
        locked={locked || settings.accessTokenSource === "env"}
      >
        <div className="token-field">
          <input
            className="ds-input ds-input--mono"
            type="text"
            value={tokenLabel}
            readOnly
            aria-label="Access token (masked)"
          />
          <button
            type="button"
            className="ds-btn ds-btn--ghost"
            onClick={() => setReveal((v) => !v)}
            aria-pressed={reveal}
            disabled={!settings.accessTokenConfigured}
          >
            {reveal ? <window.IconEyeOff size={12} /> : <window.IconEye size={12} />}
            <span>{reveal ? "Hide" : "Reveal"}</span>
          </button>
        </div>
      </FieldRow>
      {settings.accessTokenSource === "json" ? (
        <FieldRow
          label="Rotate token"
          hint="Generates a new token and writes it to deck-go-settings.json. All paired devices need to re-auth."
        >
          <button
            type="button"
            className="ds-btn ds-btn--warn"
            disabled={locked}
            onClick={() => onChange({ kind: "rotate-token" })}
          >
            <window.IconWand size={12} />
            <span>Rotate</span>
          </button>
        </FieldRow>
      ) : null}
    </GroupShell>
  );
}

// ── Runtime ───────────────────────────────────────────────────────────────

function RuntimeGroup({ runtime, endpoint, onTestEndpoint, onChangeEndpoint, dirty, locked }) {
  const isBundled = runtime.mode === "bundled";

  return (
    <GroupShell
      title="Runtime"
      description={
        isBundled
          ? "Deck-go is supervising a local Gateway process. URL, token, command, and bind are configured by the .env file at boot — they cannot be changed from here. To switch to a remote Gateway, set RUNTIME_MODE=remote in .env and restart."
          : "Deck-go is connecting to a remote Gateway. URL, token, and TLS verification can be edited here; changes write to deck-go-settings.json and override .env defaults on next start."
      }
      badge={
        <div className="runtime-badge">
          <window.ModeBadge mode={runtime.mode} />
          <window.HealthDot health={runtime.health} />
        </div>
      }
    >
      <div className="runtime-summary">
        <div className="runtime-summary__cell">
          <p className="runtime-summary__label">Status</p>
          <p className="runtime-summary__value">
            {runtime.status}
            {runtime.health ? ` · ${runtime.health}` : ""}
          </p>
        </div>
        <div className="runtime-summary__cell">
          <p className="runtime-summary__label">Latency p50</p>
          <p className="runtime-summary__value">
            {runtime.latencyP50 != null ? `${runtime.latencyP50} ms` : "—"}
          </p>
        </div>
        <div className="runtime-summary__cell">
          <p className="runtime-summary__label">{isBundled ? "Started" : "Last connected"}</p>
          <p className="runtime-summary__value">
            {isBundled
              ? runtime.startedAt
                ? new Date(runtime.startedAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })
                : "—"
              : runtime.lastConnectedAt
                ? new Date(runtime.lastConnectedAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })
                : "—"}
          </p>
        </div>
      </div>

      <FieldRow
        label="Gateway URL"
        hint={
          isBundled
            ? "Set by GATEWAY_BIND + GATEWAY_PORT in .env."
            : "Editable. Must be reachable from this host."
        }
        locked={isBundled || locked}
      >
        <input
          className="ds-input ds-input--mono"
          type="text"
          value={endpoint.url}
          onChange={(e) => onChangeEndpoint("url", e.target.value)}
          readOnly={isBundled || locked}
        />
      </FieldRow>

      <FieldRow
        label="Gateway token"
        hint={
          isBundled
            ? "Set by GATEWAY_TOKEN in .env."
            : "Stored as a secret. Required for remote authentication."
        }
        locked={isBundled || locked}
      >
        <input
          className="ds-input ds-input--mono"
          type="password"
          value={endpoint.tokenConfigured ? "••••••••••••" : ""}
          placeholder={isBundled ? "(from .env)" : "Paste token from Gateway admin"}
          readOnly={isBundled || locked}
          onChange={(e) => onChangeEndpoint("token", e.target.value)}
        />
      </FieldRow>

      <FieldRow
        label="TLS verification"
        hint={
          isBundled
            ? "Bundled runtime uses HTTP loopback; TLS verification doesn't apply."
            : "When off, accepts self-signed certs. Use only for staging environments."
        }
        locked={isBundled || locked}
      >
        <label className="ds-toggle">
          <input
            type="checkbox"
            checked={Boolean(endpoint.tlsVerify)}
            onChange={(e) => onChangeEndpoint("tlsVerify", e.target.checked)}
            disabled={isBundled || locked}
          />
          <span>{endpoint.tlsVerify ? "verify enabled" : "verify disabled"}</span>
        </label>
      </FieldRow>

      {isBundled ? (
        <FieldRow label="Auto-start at login" hint="Configured by AUTO_START in .env." locked>
          <window.StatusPill
            tone={runtime.autoStart ? "success" : "iron"}
            icon={runtime.autoStart ? window.IconCheck : null}
          >
            {runtime.autoStart ? "Enabled" : "Disabled"}
          </window.StatusPill>
        </FieldRow>
      ) : (
        <FieldRow
          label="Endpoint test"
          hint="Verifies connectivity, TLS, and Gateway version match."
        >
          <button type="button" className="ds-btn" onClick={onTestEndpoint} disabled={locked}>
            <window.IconLink size={12} />
            <span>Test connection</span>
          </button>
        </FieldRow>
      )}

      {isBundled ? (
        <div className="runtime-bundled-callout">
          <window.IconLock size={12} />
          <p>
            All runtime fields are managed by <code>.env</code>. To rotate the token, change the
            bind interface, or disable auto-start, edit <code>.env</code> and restart{" "}
            <code>deck-go</code>. Settings panel does not mutate bundled supervisor state.
          </p>
        </div>
      ) : null}

      {dirty ? (
        <div className="runtime-dirty">
          <window.StatusPill tone="warn" icon={window.IconAlert}>
            Unsaved endpoint edits
          </window.StatusPill>
        </div>
      ) : null}
    </GroupShell>
  );
}

// ── Appearance ────────────────────────────────────────────────────────────

function AppearanceGroup({ settings, onChange, locked }) {
  return (
    <GroupShell
      title="Appearance"
      description="Display preferences. Persisted in deck-go-settings.json."
    >
      <FieldRow label="Theme" hint="Inverts background + token palette." locked={locked}>
        <div className="ds-segmented" role="radiogroup" aria-label="Theme">
          {["dark", "light"].map((opt) => (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={settings.appearance.theme === opt}
              className={`ds-segmented__btn${settings.appearance.theme === opt ? " ds-segmented__btn--on" : ""}`}
              onClick={() => onChange({ kind: "appearance", path: "theme", value: opt })}
              disabled={locked}
            >
              {opt}
            </button>
          ))}
        </div>
      </FieldRow>

      <FieldRow
        label="Density"
        hint="Compact = tighter padding. Cozy = larger touch targets."
        locked={locked}
      >
        <div className="ds-segmented" role="radiogroup" aria-label="Density">
          {["compact", "cozy"].map((opt) => (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={settings.appearance.density === opt}
              className={`ds-segmented__btn${settings.appearance.density === opt ? " ds-segmented__btn--on" : ""}`}
              onClick={() => onChange({ kind: "appearance", path: "density", value: opt })}
              disabled={locked}
            >
              {opt}
            </button>
          ))}
        </div>
      </FieldRow>

      <FieldRow label="Font size" hint="Base body font size in pixels (12–18)." locked={locked}>
        <input
          className="ds-input"
          type="number"
          min={12}
          max={18}
          value={settings.appearance.fontSize}
          onChange={(e) =>
            onChange({ kind: "appearance", path: "fontSize", value: Number(e.target.value) })
          }
          disabled={locked}
        />
      </FieldRow>

      <FieldRow
        label="Reduce motion"
        hint="Respects OS-level motion preferences if enabled."
        locked={locked}
      >
        <label className="ds-toggle">
          <input
            type="checkbox"
            checked={Boolean(settings.appearance.reducedMotion)}
            onChange={(e) =>
              onChange({ kind: "appearance", path: "reducedMotion", value: e.target.checked })
            }
            disabled={locked}
          />
          <span>{settings.appearance.reducedMotion ? "Reduced" : "Full motion"}</span>
        </label>
      </FieldRow>
    </GroupShell>
  );
}

// ── Notifications ─────────────────────────────────────────────────────────

function NotificationsGroup({ settings, onChange, locked }) {
  return (
    <GroupShell
      title="Notifications"
      description="Alerts surface in the OS notification center when Deck-go is in the background."
    >
      <FieldRow
        label="Desktop alerts"
        hint="Show OS notifications for new messages + alert fires."
        locked={locked}
      >
        <label className="ds-toggle">
          <input
            type="checkbox"
            checked={Boolean(settings.notifications.desktop)}
            onChange={(e) =>
              onChange({ kind: "notifications", path: "desktop", value: e.target.checked })
            }
            disabled={locked}
          />
          <span>{settings.notifications.desktop ? "Enabled" : "Disabled"}</span>
        </label>
      </FieldRow>

      <FieldRow label="Sound" hint="Soft chime when a notification fires." locked={locked}>
        <label className="ds-toggle">
          <input
            type="checkbox"
            checked={Boolean(settings.notifications.sound)}
            onChange={(e) =>
              onChange({ kind: "notifications", path: "sound", value: e.target.checked })
            }
            disabled={locked}
          />
          <span>{settings.notifications.sound ? "On" : "Off"}</span>
        </label>
      </FieldRow>

      <FieldRow
        label="Quiet hours"
        hint="Suppress all notifications during this window."
        locked={locked}
      >
        <label className="ds-toggle">
          <input
            type="checkbox"
            checked={Boolean(settings.notifications.quietHoursEnabled)}
            onChange={(e) =>
              onChange({
                kind: "notifications",
                path: "quietHoursEnabled",
                value: e.target.checked,
              })
            }
            disabled={locked}
          />
          <span>{settings.notifications.quietHoursEnabled ? "Enabled" : "Disabled"}</span>
        </label>
      </FieldRow>

      {settings.notifications.quietHoursEnabled ? (
        <div className="ds-row-pair">
          <FieldRow label="Quiet from" hint="" locked={locked}>
            <input
              className="ds-input"
              type="time"
              value={settings.notifications.quietHoursStart}
              onChange={(e) =>
                onChange({ kind: "notifications", path: "quietHoursStart", value: e.target.value })
              }
              disabled={locked}
            />
          </FieldRow>
          <FieldRow label="Quiet until" hint="" locked={locked}>
            <input
              className="ds-input"
              type="time"
              value={settings.notifications.quietHoursEnd}
              onChange={(e) =>
                onChange({ kind: "notifications", path: "quietHoursEnd", value: e.target.value })
              }
              disabled={locked}
            />
          </FieldRow>
        </div>
      ) : null}
    </GroupShell>
  );
}

// ── Paired devices ────────────────────────────────────────────────────────

function DevicesGroup({ settings, now, onUnpair, locked }) {
  return (
    <GroupShell
      title="Paired devices"
      description="Sessions sharing this access token. Last-seen ≤ 5m = currently online."
    >
      <ul className="device-list">
        {settings.pairedDevices.map((d) => {
          const stale = now - d.lastSeen > 1000 * 60 * 5;
          return (
            <li key={d.id} className={`device-row${stale ? " device-row--stale" : ""}`}>
              <div className="device-row__head">
                <span className="device-row__name">{d.name}</span>
                <window.StatusPill
                  tone={stale ? "iron" : "success"}
                  icon={stale ? null : window.IconCheck}
                >
                  {stale ? `seen ${relativeTime(now, d.lastSeen)}` : "online"}
                </window.StatusPill>
              </div>
              <div className="device-row__meta">
                <span>
                  <strong>IP</strong> <code>{d.ip}</code>
                </span>
                <span>
                  <strong>Platform</strong> {d.platform}
                </span>
                <span>
                  <strong>Version</strong> {d.version}
                </span>
                <span>
                  <strong>Last seen</strong> {formatAbsolute(d.lastSeen)}
                </span>
              </div>
              <div className="device-row__actions">
                <button
                  type="button"
                  className="ds-btn ds-btn--warn"
                  onClick={() => onUnpair(d.id)}
                  disabled={locked}
                >
                  <window.IconUnlink size={12} />
                  <span>Unpair</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </GroupShell>
  );
}

// ── Version ───────────────────────────────────────────────────────────────

function VersionGroup({ version, gatewayVersion, capabilitySnapshotAvailable, schemaVersion }) {
  return (
    <GroupShell
      title="Version"
      description="Build identifiers. Mismatch between Deck and Gateway can cause schema drift."
    >
      <dl className="version-grid">
        <div className="version-grid__row">
          <dt>Deck</dt>
          <dd>
            <code>{version.deck || "—"}</code>
          </dd>
        </div>
        <div className="version-grid__row">
          <dt>Gateway (BFF reported)</dt>
          <dd>
            <code>{version.gateway || "—"}</code>
            {gatewayVersion && gatewayVersion !== version.gateway ? (
              <window.StatusPill tone="warn" icon={window.IconAlert}>
                endpoint drift: {gatewayVersion}
              </window.StatusPill>
            ) : null}
          </dd>
        </div>
        <div className="version-grid__row">
          <dt>CLI</dt>
          <dd>
            <code>{version.cli || "—"}</code>
          </dd>
        </div>
        <div className="version-grid__row">
          <dt>Capability snapshot</dt>
          <dd>
            {capabilitySnapshotAvailable ? (
              <window.StatusPill tone="success" icon={window.IconCheck}>
                available
              </window.StatusPill>
            ) : (
              <window.StatusPill tone="warn" icon={window.IconAlert}>
                missing
              </window.StatusPill>
            )}
          </dd>
        </div>
        <div className="version-grid__row">
          <dt>Schema version</dt>
          <dd>
            <code>{schemaVersion || "—"}</code>
          </dd>
        </div>
      </dl>
    </GroupShell>
  );
}

Object.assign(window, {
  IdentityGroup,
  RuntimeGroup,
  AppearanceGroup,
  NotificationsGroup,
  DevicesGroup,
  VersionGroup,
  GroupShell,
});
