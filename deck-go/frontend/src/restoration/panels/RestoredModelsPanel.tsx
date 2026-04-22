import { useEffect, useMemo, useState } from "react";
import type { DeckGoConfigLookupResponse } from "../../api";
import { fetchModelsConfig, lookupConfigPath, saveModelsConfig } from "../../api";
import { JsonDetails, ShellStat } from "../../shell-components";

type PanelState = "idle" | "loading" | "ready";

function parseJsonRecord(raw: string) {
  try {
    const value = JSON.parse(raw) as unknown;
    if (value && typeof value === "object") {
      return value as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

export function RestoredModelsPanel() {
  const [rawConfig, setRawConfig] = useState("");
  const [baseHash, setBaseHash] = useState("");
  const [schemaPath, setSchemaPath] = useState("models.providers");
  const [lookupResult, setLookupResult] = useState<DeckGoConfigLookupResponse | null>(null);
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<"idle" | "saving" | "lookup">("idle");
  const [error, setError] = useState("");
  const [actionResult, setActionResult] = useState<unknown>(null);

  const refresh = async () => {
    setLoadState("loading");
    try {
      const next = await fetchModelsConfig();
      setRawConfig(next.raw ?? "");
      setBaseHash(next.hash ?? "");
      setLoadState("ready");
      setError("");
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : "failed to load models config");
    }
  };

  useEffect(() => {
    void refresh();
    void lookupAction("models.providers");
  }, []);

  const parsedConfig = useMemo(() => parseJsonRecord(rawConfig), [rawConfig]);
  const modelsSection = (parsedConfig?.models as Record<string, unknown> | undefined) ?? {};
  const providers = (modelsSection.providers as Record<string, unknown> | undefined) ?? {};
  const providerEntries = Object.entries(providers).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  const lookupAction = async (nextPath = schemaPath) => {
    if (!nextPath.trim()) {
      setError("schema path is required");
      return;
    }
    setActionState("lookup");
    try {
      const result = await lookupConfigPath(nextPath.trim());
      setLookupResult(result);
      setSchemaPath(nextPath.trim());
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "schema lookup failed");
    } finally {
      setActionState("idle");
    }
  };

  const saveAction = async () => {
    setActionState("saving");
    try {
      const result = await saveModelsConfig(rawConfig, baseHash);
      setActionResult(result);
      setBaseHash(result.baseHash ?? result.hash ?? baseHash);
      setError("");
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "models config save failed");
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-restored-workspace">
      <div className="deckgo-column">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Models</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Vite-owned raw models config surface with provider inventory and schema lookup.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-pill-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Models {loadState}
              </span>
              <span className="deckgo-pill">{providerEntries.length} providers</span>
              <span className="deckgo-pill">hash {baseHash || "n/a"}</span>
            </div>
            <div className="deckgo-grid deckgo-grid-3">
              <ShellStat label="providers" value={providerEntries.length} />
              <ShellStat label="schema path" value={schemaPath} />
              <ShellStat label="hash" value={baseHash || "n/a"} />
            </div>
            <div className="deckgo-actions">
              <button className="deckgo-button" type="button" onClick={() => void refresh()}>
                Refresh models
              </button>
              <button
                className="deckgo-button is-primary"
                type="button"
                onClick={() => void saveAction()}
                disabled={actionState !== "idle"}
              >
                {actionState === "saving" ? "Saving" : "Save models config"}
              </button>
            </div>
            {error ? <p className="deckgo-note">{error}</p> : null}
            <label className="deckgo-label">
              <span>Models config</span>
              <textarea
                className="deckgo-textarea"
                rows={20}
                value={rawConfig}
                onChange={(event) => setRawConfig(event.target.value)}
              />
            </label>
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-restored-chat-main">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Models detail</h2>
          </div>
          <p className="deckgo-card-subtitle">
            This slice keeps model migration anchored on current config truth instead of restoring
            the old multi-tab model wizard in one tranche.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-surface-tile">
              <p className="deckgo-surface-label">Lookup config path</p>
              <div className="deckgo-actions">
                <input
                  className="deckgo-input"
                  value={schemaPath}
                  onChange={(event) => setSchemaPath(event.target.value)}
                  placeholder="config path"
                />
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void lookupAction()}
                  disabled={actionState !== "idle"}
                >
                  {actionState === "lookup" ? "Looking up" : "Lookup schema"}
                </button>
              </div>
            </div>
            <div className="deckgo-restored-hero-strip">
              <div>
                <p className="deckgo-kicker">Provider inventory</p>
                <strong>{providerEntries.length ? providerEntries[0][0] : "No providers"}</strong>
                <p className="deckgo-note">Current models.providers keys from raw config</p>
              </div>
              <div className="deckgo-pill-row">
                <span className="deckgo-pill">{providerEntries.length} configured</span>
                <span className="deckgo-pill">
                  {lookupResult?.children.length ?? 0} schema children
                </span>
              </div>
            </div>
            {providerEntries.length === 0 ? (
              <p className="deckgo-note">No model providers found in the current raw config.</p>
            ) : (
              <ul className="deckgo-shell-list">
                {providerEntries.map(([provider, value]) => (
                  <li key={provider}>
                    <div className="deckgo-selectable-card">
                      <strong>{provider}</strong>
                      <div className="deckgo-meta">
                        keys:{" "}
                        {Object.keys((value as Record<string, unknown>) ?? {}).join(", ") || "n/a"}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {lookupResult ? <JsonDetails title="Schema lookup" payload={lookupResult} /> : null}
            {actionResult ? <JsonDetails title="Last save result" payload={actionResult} /> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
