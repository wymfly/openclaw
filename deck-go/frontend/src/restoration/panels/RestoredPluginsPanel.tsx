import { useEffect, useMemo, useState } from "react";
import type {
  DeckGoPluginInventoryEntry,
  DeckGoPluginsListResponse,
} from "../../../../contracts/generated/ts/deck-api.generated";
import { fetchPlugins } from "../../api";
import { JsonDetails, ShellStat } from "../../shell-components";

type PanelState = "idle" | "loading" | "ready";

export function RestoredPluginsPanel() {
  const [payload, setPayload] = useState<DeckGoPluginsListResponse | null>(null);
  const [selectedPluginId, setSelectedPluginId] = useState("");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    void fetchPlugins()
      .then((next) => {
        if (cancelled) {
          return;
        }
        setPayload(next);
        setLoadState("ready");
        setError("");
        const firstId = next.plugins?.[0]?.id ?? "";
        setSelectedPluginId((current) =>
          current && next.plugins?.some((plugin) => plugin.id === current) ? current : firstId,
        );
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }
        setLoadState("idle");
        setError(loadError instanceof Error ? loadError.message : "failed to load plugins");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const plugins = payload?.plugins ?? [];
  const selectedPlugin =
    plugins.find((plugin) => plugin.id === selectedPluginId) ?? plugins[0] ?? null;
  const enabledCount = useMemo(
    () => plugins.filter((plugin) => plugin.enabled !== false).length,
    [plugins],
  );
  const statusSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const plugin of plugins) {
      const key = plugin.status?.trim() || "unknown";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([status, count]) => `${status}: ${count}`)
      .join(" · ");
  }, [plugins]);

  return (
    <section className="deckgo-restored-workspace">
      <div className="deckgo-column">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Plugin inventory</h2>
          </div>
          <p className="deckgo-card-subtitle">
            First Stage 3 Vite capability slice backed by the live `deck.plugins.list` contract.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-pill-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Inventory {loadState}
              </span>
              <span className="deckgo-pill">scope: {payload?.scope || "unknown"}</span>
            </div>
            <div className="deckgo-grid deckgo-grid-3">
              <ShellStat label="plugins" value={plugins.length} />
              <ShellStat label="enabled" value={enabledCount} />
              <ShellStat label="statuses" value={statusSummary || "none"} />
            </div>
            {error ? <p className="deckgo-note">{error}</p> : null}
            {plugins.length === 0 ? (
              <p className="deckgo-note">No plugins loaded.</p>
            ) : (
              <ul className="deckgo-shell-list">
                {plugins.map((plugin) => (
                  <li key={plugin.id}>
                    <button
                      type="button"
                      className={`deckgo-selectable-card ${selectedPluginId === plugin.id ? "is-selected" : ""}`}
                      onClick={() => setSelectedPluginId(plugin.id)}
                    >
                      <strong>{plugin.name || plugin.id}</strong>
                      <div className="deckgo-meta">
                        id: {plugin.id} | origin: {plugin.origin || "unknown"} | status:{" "}
                        {plugin.status || "unknown"}
                      </div>
                      <div className="deckgo-meta">
                        enabled: {plugin.enabled === false ? "no" : "yes"}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-restored-chat-main">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Selected plugin</h2>
          </div>
          <p className="deckgo-card-subtitle">
            This is still a bounded read-only adapter, but it moves the plugins family off the
            placeholder path and onto a real Vite-owned panel surface.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            {selectedPlugin ? (
              <>
                <div className="deckgo-restored-hero-strip">
                  <div>
                    <p className="deckgo-kicker">Plugin</p>
                    <strong>{selectedPlugin.name || selectedPlugin.id}</strong>
                    <p className="deckgo-note">scope: {payload?.scope || "unknown"}</p>
                  </div>
                  <div className="deckgo-pill-row">
                    <span className="deckgo-pill">origin {selectedPlugin.origin || "unknown"}</span>
                    <span className="deckgo-pill">status {selectedPlugin.status || "unknown"}</span>
                  </div>
                </div>
                <PluginDetails plugin={selectedPlugin} />
                <JsonDetails title="Plugin payload" payload={selectedPlugin} />
              </>
            ) : (
              <p className="deckgo-note">Choose a plugin to inspect its payload.</p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

function PluginDetails(props: { plugin: DeckGoPluginInventoryEntry }) {
  return (
    <div className="deckgo-grid deckgo-grid-2">
      <ShellStat label="id" value={props.plugin.id} />
      <ShellStat label="name" value={props.plugin.name || props.plugin.id} />
      <ShellStat label="origin" value={props.plugin.origin || "unknown"} />
      <ShellStat label="status" value={props.plugin.status || "unknown"} />
      <ShellStat label="enabled" value={props.plugin.enabled === false ? "no" : "yes"} />
    </div>
  );
}
