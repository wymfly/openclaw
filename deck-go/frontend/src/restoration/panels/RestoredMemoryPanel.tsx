import { useEffect, useMemo, useState } from "react";
import type {
  DeckGoMemoryFileNode,
  DeckGoMemoryHealthEntry,
  DeckGoMemoryHealthResponse,
} from "../../api";
import { browseMemory, fetchMemoryHealth, readMemoryFile, runMemoryDreams } from "../../api";
import { JsonDetails, ShellStat } from "../../shell-components";

type PanelState = "idle" | "loading" | "ready";
type MemoryTab = "files" | "health" | "dreams";

function normalizeHealthEntries(
  response: DeckGoMemoryHealthResponse | null,
): DeckGoMemoryHealthEntry[] {
  if (!response) {
    return [];
  }
  if (Array.isArray(response.entries)) {
    return response.entries;
  }
  if (response.agentId || response.provider) {
    return [
      {
        agentId: response.agentId || "",
        provider: response.provider || "",
        embeddingStatus: response.embedding?.ok ? "ok" : response.error ? "error" : "unknown",
        error: response.embedding?.error || response.error,
      },
    ];
  }
  return [];
}

export function RestoredMemoryPanel() {
  const [agentId, setAgentId] = useState("main");
  const [tab, setTab] = useState<MemoryTab>("files");
  const [files, setFiles] = useState<DeckGoMemoryFileNode[]>([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [selectedContent, setSelectedContent] = useState("");
  const [healthResponse, setHealthResponse] = useState<DeckGoMemoryHealthResponse | null>(null);
  const [dreamsResult, setDreamsResult] = useState<unknown>(null);
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<"idle" | "dreams">("idle");
  const [error, setError] = useState("");

  const refreshFiles = async (nextPath?: string) => {
    setLoadState("loading");
    try {
      const result = await browseMemory(agentId, nextPath);
      setFiles(result.files ?? []);
      setLoadState("ready");
      setError("");
      if (nextPath) {
        const fileResult = await readMemoryFile(agentId, nextPath);
        setSelectedPath(nextPath);
        setSelectedContent(fileResult.content ?? "");
      } else {
        setSelectedPath("");
        setSelectedContent("");
      }
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : "failed to browse memory");
    }
  };

  const refreshHealth = async () => {
    setLoadState("loading");
    try {
      const result = await fetchMemoryHealth();
      setHealthResponse(result);
      setLoadState("ready");
      setError("");
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : "failed to load memory health");
    }
  };

  useEffect(() => {
    if (tab === "files") {
      void refreshFiles();
      return;
    }
    if (tab === "health") {
      void refreshHealth();
    }
  }, [agentId, tab]);

  const healthEntries = useMemo(() => normalizeHealthEntries(healthResponse), [healthResponse]);

  const dreamsAction = async (
    action: "read" | "backfill" | "reset" | "resetShortTerm" | "repair" | "dedupe",
  ) => {
    setActionState("dreams");
    try {
      const result = await runMemoryDreams(action);
      setDreamsResult(result);
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "memory dreams action failed");
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-restored-workspace">
      <div className="deckgo-column">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Memory</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Read-first Vite memory slice over browse/read, health, and dream-diary actions.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-pill-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Memory {loadState}
              </span>
              <span className="deckgo-pill">agent {agentId}</span>
            </div>
            <div className="deckgo-actions">
              <input
                className="deckgo-input"
                value={agentId}
                onChange={(event) => setAgentId(event.target.value)}
                placeholder="agent id"
              />
              <button
                className={`deckgo-button ${tab === "files" ? "is-primary" : ""}`}
                type="button"
                onClick={() => setTab("files")}
              >
                Files
              </button>
              <button
                className={`deckgo-button ${tab === "health" ? "is-primary" : ""}`}
                type="button"
                onClick={() => setTab("health")}
              >
                Health
              </button>
              <button
                className={`deckgo-button ${tab === "dreams" ? "is-primary" : ""}`}
                type="button"
                onClick={() => setTab("dreams")}
              >
                Dreams
              </button>
            </div>
            {error ? <p className="deckgo-note">{error}</p> : null}
            {tab === "files" ? (
              <>
                <div className="deckgo-grid deckgo-grid-2">
                  <ShellStat label="entries" value={files.length} />
                  <ShellStat label="selected path" value={selectedPath || "n/a"} />
                </div>
                <ul className="deckgo-shell-list">
                  {files.length === 0 ? (
                    <p className="deckgo-note">No memory files loaded.</p>
                  ) : (
                    files.map((file) => (
                      <li key={file.path}>
                        <button
                          type="button"
                          className={`deckgo-selectable-card ${selectedPath === file.path ? "is-selected" : ""}`}
                          onClick={() => {
                            if (file.type === "file") {
                              void refreshFiles(file.path);
                            }
                          }}
                        >
                          <strong>{file.name}</strong>
                          <div className="deckgo-meta">
                            {file.type} | {file.path} | size: {file.size ?? "n/a"}
                          </div>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </>
            ) : null}
            {tab === "health" ? (
              <>
                <div className="deckgo-grid deckgo-grid-2">
                  <ShellStat label="entries" value={healthEntries.length} />
                  <ShellStat
                    label="lance db"
                    value={healthResponse?.lanceDbEnabled ? "enabled" : "off"}
                  />
                </div>
                <JsonDetails title="Health payload" payload={healthEntries} />
              </>
            ) : null}
            {tab === "dreams" ? (
              <div className="deckgo-actions">
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void dreamsAction("read")}
                  disabled={actionState !== "idle"}
                >
                  Read
                </button>
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void dreamsAction("backfill")}
                  disabled={actionState !== "idle"}
                >
                  Backfill
                </button>
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void dreamsAction("repair")}
                  disabled={actionState !== "idle"}
                >
                  Repair
                </button>
                <button
                  className="deckgo-button is-danger"
                  type="button"
                  onClick={() => void dreamsAction("reset")}
                  disabled={actionState !== "idle"}
                >
                  Reset
                </button>
              </div>
            ) : null}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-restored-chat-main">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Memory detail</h2>
          </div>
          <p className="deckgo-card-subtitle">
            This slice avoids the still-unimplemented LanceDB search lane and stays on stable
            operator reads and doctor actions.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            {tab === "files" ? (
              selectedPath ? (
                <div className="deckgo-surface-tile">
                  <p className="deckgo-surface-label">{selectedPath}</p>
                  <pre className="deckgo-code" style={{ whiteSpace: "pre-wrap" }}>
                    {selectedContent}
                  </pre>
                </div>
              ) : (
                <p className="deckgo-note">Select a memory file to read it.</p>
              )
            ) : null}
            {tab === "health" ? (
              <JsonDetails title="Raw health response" payload={healthResponse} />
            ) : null}
            {tab === "dreams" ? (
              dreamsResult ? (
                <JsonDetails title="Dream diary action result" payload={dreamsResult} />
              ) : (
                <p className="deckgo-note">Run a dream-diary action to inspect its response.</p>
              )
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
