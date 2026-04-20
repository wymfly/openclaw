import { useEffect, useEffectEvent, useState } from "react";
import type {
  DeckGoSettings,
  DeckGoSettingsResponse,
} from "../../../../contracts/generated/ts/deck-api.generated";
import { fetchSettings, persistAccessToken, saveSettings } from "../../api";
import { JsonDetails } from "../../shell-components";
import { useRestorationUI } from "../ui-store";

function normalizeSettings(result: DeckGoSettingsResponse): DeckGoSettings {
  return {
    accessToken: result.settings.accessToken ?? "",
    managedGateway: {
      mode: result.settings.managedGateway?.mode ?? "managed",
      command: result.settings.managedGateway?.command ?? "",
      args: result.settings.managedGateway?.args ?? [],
      workingDir: result.settings.managedGateway?.workingDir ?? "",
      bindHost: result.settings.managedGateway?.bindHost ?? "127.0.0.1",
      bindPort: result.settings.managedGateway?.bindPort ?? 18789,
      gatewayToken: result.settings.managedGateway?.gatewayToken ?? "",
      autoStart: result.settings.managedGateway?.autoStart ?? true,
      env: result.settings.managedGateway?.env ?? {},
    },
  };
}

export function RestoredSettingsPanel() {
  const { bootstrap, runtime, refreshRuntimeSummary } = useRestorationUI();
  const [settings, setSettings] = useState<DeckGoSettings>({
    accessToken: "",
    managedGateway: {
      mode: "managed",
      command: "",
      args: [],
      workingDir: "",
      bindHost: "127.0.0.1",
      bindPort: 18789,
      gatewayToken: "",
      autoStart: true,
      env: {},
    },
  });
  const [settingsPath, setSettingsPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastSaved, setLastSaved] = useState<unknown>(null);

  const refreshSettings = useEffectEvent(async () => {
    setLoading(true);
    try {
      const result = await fetchSettings();
      setSettings(normalizeSettings(result));
      setSettingsPath(result.path);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "failed to load settings");
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);

  const updateManagedGateway = (patch: Partial<NonNullable<DeckGoSettings["managedGateway"]>>) => {
    setSettings((current) => ({
      ...current,
      managedGateway: {
        ...current.managedGateway,
        ...patch,
      },
    }));
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const result = await saveSettings(settings);
      persistAccessToken(settings.accessToken ?? "");
      setLastSaved(result);
      await refreshSettings();
      await refreshRuntimeSummary();
      setError("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const activeRuntimeUrl = runtime?.runtime.gatewayUrl || "(not resolved)";

  return (
    <section className="deckgo-restored-workspace">
      <div className="deckgo-column deckgo-restored-chat-main">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Deck-go local settings</h2>
          </div>
          <p className="deckgo-card-subtitle">
            This panel owns deck-go local access and managed Gateway launch settings, so chat no
            longer needs to carry them.
          </p>
          <div className="deckgo-card-body deckgo-form-grid">
            <div className="deckgo-pill-row">
              <span className={`deckgo-pill ${loading ? "is-muted" : "is-positive"}`}>
                Settings {loading ? "loading" : "ready"}
              </span>
              <span
                className={`deckgo-pill ${bootstrap?.gateway.connected ? "is-positive" : "is-muted"}`}
              >
                Gateway {bootstrap?.gateway.connected ? "linked" : "pending"}
              </span>
              <span className="deckgo-pill">Runtime {runtime?.runtime.status || "idle"}</span>
            </div>

            <label className="deckgo-label">
              <span>Deck access token</span>
              <input
                className="deckgo-input"
                value={settings.accessToken ?? ""}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, accessToken: event.target.value }))
                }
              />
            </label>

            <div className="deckgo-form-row">
              <label className="deckgo-label">
                <span>Managed Gateway command</span>
                <input
                  className="deckgo-input"
                  value={settings.managedGateway?.command ?? ""}
                  onChange={(event) => updateManagedGateway({ command: event.target.value })}
                />
              </label>
              <label className="deckgo-label">
                <span>Working dir</span>
                <input
                  className="deckgo-input"
                  value={settings.managedGateway?.workingDir ?? ""}
                  onChange={(event) => updateManagedGateway({ workingDir: event.target.value })}
                />
              </label>
              <label className="deckgo-label">
                <span>Gateway token</span>
                <input
                  className="deckgo-input"
                  value={settings.managedGateway?.gatewayToken ?? ""}
                  onChange={(event) => updateManagedGateway({ gatewayToken: event.target.value })}
                />
              </label>
            </div>

            <div className="deckgo-form-row">
              <label className="deckgo-label">
                <span>Bind host</span>
                <input
                  className="deckgo-input"
                  value={settings.managedGateway?.bindHost ?? ""}
                  onChange={(event) => updateManagedGateway({ bindHost: event.target.value })}
                />
              </label>
              <label className="deckgo-label">
                <span>Bind port</span>
                <input
                  className="deckgo-input"
                  type="number"
                  value={settings.managedGateway?.bindPort ?? 18789}
                  onChange={(event) =>
                    updateManagedGateway({ bindPort: Number(event.target.value) || 18789 })
                  }
                />
              </label>
              <label className="deckgo-label">
                <span>Runtime endpoint</span>
                <input className="deckgo-input" value={activeRuntimeUrl} readOnly />
              </label>
            </div>

            <label className="deckgo-label">
              <span>Startup args</span>
              <input
                className="deckgo-input"
                value={(settings.managedGateway?.args ?? []).join(" ")}
                onChange={(event) =>
                  updateManagedGateway({
                    args: event.target.value
                      .split(/\s+/)
                      .map((part) => part.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>

            <div className="deckgo-actions">
              <button
                className="deckgo-button is-primary"
                type="button"
                onClick={() => void onSave()}
              >
                {saving ? "Saving..." : "Save settings"}
              </button>
              <button
                className="deckgo-button"
                type="button"
                onClick={() => void refreshSettings()}
              >
                Refresh settings
              </button>
              <button
                className="deckgo-button"
                type="button"
                onClick={() => void refreshRuntimeSummary()}
              >
                Refresh runtime
              </button>
            </div>

            <div className="deckgo-surface-tile">
              <p className="deckgo-surface-label">Settings file</p>
              <strong>{settingsPath || "(not loaded yet)"}</strong>
              <p className="deckgo-note">
                autoStart: {settings.managedGateway?.autoStart ? "true" : "false"} | managed mode:{" "}
                {settings.managedGateway?.mode || "managed"}
              </p>
            </div>

            {error ? (
              <p className="deckgo-note" style={{ color: "var(--danger)" }}>
                {error}
              </p>
            ) : null}
          </div>
        </article>
      </div>

      <aside className="deckgo-column">
        <article className="deckgo-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Settings summary</h2>
          </div>
          <div className="deckgo-card-body">
            <p className="deckgo-note">
              accessToken configured: {settings.accessToken ? "yes" : "no"}
            </p>
            <p className="deckgo-note">
              command configured: {settings.managedGateway?.command ? "yes" : "no"}
            </p>
            <p className="deckgo-note">
              gateway token configured: {settings.managedGateway?.gatewayToken ? "yes" : "no"}
            </p>
            <p className="deckgo-note">runtime url: {activeRuntimeUrl}</p>
          </div>
        </article>

        {lastSaved ? (
          <article className="deckgo-card">
            <div className="deckgo-card-header">
              <h2 className="deckgo-card-title">Last save result</h2>
            </div>
            <div className="deckgo-card-body">
              <JsonDetails title="Settings save result" payload={lastSaved} />
            </div>
          </article>
        ) : null}
      </aside>
    </section>
  );
}
