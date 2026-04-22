import { useEffect, useMemo, useState } from "react";
import type { DeckGoConfigLookupResponse } from "../../api";
import { applyDeckConfig, fetchDeckConfig, lookupConfigPath } from "../../api";
import { JsonDetails, ShellStat } from "../../shell-components";

type PanelState = "idle" | "loading" | "ready";

function summarizeTopLevelKeys(rawConfig: string) {
  try {
    const parsed = JSON.parse(rawConfig) as unknown;
    if (parsed && typeof parsed === "object") {
      return Object.keys(parsed as Record<string, unknown>).toSorted((left, right) =>
        left.localeCompare(right),
      );
    }
  } catch {
    return [];
  }
  return [];
}

export function RestoredConfigPanel() {
  const [rawConfig, setRawConfig] = useState("");
  const [baseHash, setBaseHash] = useState("");
  const [schemaPath, setSchemaPath] = useState("agents.defaults");
  const [lookupResult, setLookupResult] = useState<DeckGoConfigLookupResponse | null>(null);
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<"idle" | "saving" | "lookup">("idle");
  const [error, setError] = useState("");
  const [actionResult, setActionResult] = useState<unknown>(null);

  const refresh = async () => {
    setLoadState("loading");
    try {
      const next = await fetchDeckConfig();
      const nextRaw =
        typeof next.raw === "string" ? next.raw : JSON.stringify(next.config ?? {}, null, 2);
      setRawConfig(nextRaw);
      setBaseHash(next.hash ?? "");
      setLoadState("ready");
      setError("");
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : "failed to load config");
    }
  };

  useEffect(() => {
    void refresh();
    void lookupAction("agents.defaults");
  }, []);

  const topLevelKeys = useMemo(() => summarizeTopLevelKeys(rawConfig), [rawConfig]);

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
      setError(actionError instanceof Error ? actionError.message : "config schema lookup failed");
    } finally {
      setActionState("idle");
    }
  };

  const saveAction = async () => {
    setActionState("saving");
    try {
      const result = await applyDeckConfig(rawConfig, baseHash);
      setActionResult(result);
      setBaseHash(result.baseHash ?? result.hash ?? baseHash);
      setError("");
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "config apply failed");
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-restored-workspace">
      <div className="deckgo-column">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Config</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Vite-owned raw config editor over deck-go config get/apply plus targeted schema lookup.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-pill-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Config {loadState}
              </span>
              <span className="deckgo-pill">{topLevelKeys.length} top-level keys</span>
              <span className="deckgo-pill">hash {baseHash || "n/a"}</span>
            </div>
            <div className="deckgo-grid deckgo-grid-3">
              <ShellStat label="keys" value={topLevelKeys.length} />
              <ShellStat label="schema path" value={schemaPath} />
              <ShellStat label="hash" value={baseHash || "n/a"} />
            </div>
            <div className="deckgo-actions">
              <button className="deckgo-button" type="button" onClick={() => void refresh()}>
                Refresh config
              </button>
              <button
                className="deckgo-button is-primary"
                type="button"
                onClick={() => void saveAction()}
                disabled={actionState !== "idle"}
              >
                {actionState === "saving" ? "Saving" : "Apply config"}
              </button>
            </div>
            {error ? <p className="deckgo-note">{error}</p> : null}
            <label className="deckgo-label">
              <span>Raw config</span>
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
            <h2 className="deckgo-card-title">Config detail</h2>
          </div>
          <p className="deckgo-card-subtitle">
            This tranche keeps configuration migration grounded on raw truth and schema assistance
            instead of restoring the old structured editor before the host cutover is finished.
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
                <p className="deckgo-kicker">Top-level sections</p>
                <strong>{topLevelKeys[0] || "No config keys"}</strong>
                <p className="deckgo-note">Current keys from the deck-go config snapshot</p>
              </div>
              <div className="deckgo-pill-row">
                <span className="deckgo-pill">{topLevelKeys.length} sections</span>
                <span className="deckgo-pill">
                  {lookupResult?.children.length ?? 0} schema children
                </span>
              </div>
            </div>
            {topLevelKeys.length === 0 ? (
              <p className="deckgo-note">The current config snapshot has no top-level keys.</p>
            ) : (
              <ul className="deckgo-shell-list">
                {topLevelKeys.map((key) => (
                  <li key={key}>
                    <div className="deckgo-selectable-card">
                      <strong>{key}</strong>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {lookupResult ? <JsonDetails title="Schema lookup" payload={lookupResult} /> : null}
            {actionResult ? <JsonDetails title="Last apply result" payload={actionResult} /> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
