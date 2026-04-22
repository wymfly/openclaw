import { useEffect, useMemo, useState } from "react";
import type { DeckGoDoc, DeckGoDocCategory } from "../../api";
import { deleteDoc, extractDocs, fetchDocs } from "../../api";
import { JsonDetails, ShellStat } from "../../shell-components";

type PanelState = "idle" | "loading" | "ready";

const DOC_CATEGORIES: Array<DeckGoDocCategory | "all"> = [
  "all",
  "summary",
  "plan",
  "spec",
  "manual",
  "draft",
];

export function RestoredDocsPanel() {
  const [docs, setDocs] = useState<DeckGoDoc[]>([]);
  const [selectedDocId, setSelectedDocId] = useState("");
  const [category, setCategory] = useState<DeckGoDocCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<"idle" | "extracting" | "deleting">("idle");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [error, setError] = useState("");

  const refresh = async (preferredDocId?: string) => {
    setLoadState("loading");
    try {
      const next = await fetchDocs({
        category: category === "all" ? null : category,
        query,
      });
      const nextDocs = next.docs ?? [];
      setDocs(nextDocs);
      setLoadState("ready");
      setError("");
      const fallbackId = preferredDocId?.trim() || nextDocs[0]?.id || "";
      setSelectedDocId((current) =>
        nextDocs.some((doc) => doc.id === current)
          ? current
          : nextDocs.some((doc) => doc.id === fallbackId)
            ? fallbackId
            : nextDocs[0]?.id || "",
      );
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : "failed to load docs");
    }
  };

  useEffect(() => {
    void refresh();
  }, [category, query]);

  const selectedDoc = docs.find((doc) => doc.id === selectedDocId) ?? docs[0] ?? null;
  const categorySummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const doc of docs) {
      counts.set(doc.category, (counts.get(doc.category) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => `${name}: ${count}`)
      .join(" · ");
  }, [docs]);

  const extractAction = async () => {
    setActionState("extracting");
    try {
      const result = await extractDocs();
      setActionResult(result);
      setError("");
      await refresh(selectedDocId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "doc extraction failed");
    } finally {
      setActionState("idle");
    }
  };

  const deleteAction = async () => {
    if (!selectedDoc) {
      return;
    }
    setActionState("deleting");
    try {
      const result = await deleteDoc(selectedDoc.id);
      setActionResult(result);
      setError("");
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "doc delete failed");
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-restored-workspace">
      <div className="deckgo-column">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Docs hub</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Vite-owned docs slice over the existing docs list/extract/delete routes.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-pill-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Docs {loadState}
              </span>
              <span className="deckgo-pill">{docs.length} docs</span>
            </div>
            <div className="deckgo-grid deckgo-grid-2">
              <ShellStat label="documents" value={docs.length} />
              <ShellStat label="categories" value={categorySummary || "none"} />
            </div>
            <div className="deckgo-actions">
              <select
                className="deckgo-input"
                value={category}
                onChange={(event) => setCategory(event.target.value as DeckGoDocCategory | "all")}
              >
                {DOC_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <input
                className="deckgo-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="search docs"
              />
            </div>
            <div className="deckgo-actions">
              <button
                className="deckgo-button"
                type="button"
                onClick={() => void refresh(selectedDocId)}
              >
                Refresh docs
              </button>
              <button
                className="deckgo-button is-primary"
                type="button"
                onClick={() => void extractAction()}
                disabled={actionState !== "idle"}
              >
                {actionState === "extracting" ? "Extracting" : "Extract"}
              </button>
              <button
                className="deckgo-button is-danger"
                type="button"
                onClick={() => void deleteAction()}
                disabled={!selectedDoc || actionState !== "idle"}
              >
                {actionState === "deleting" ? "Deleting" : "Delete"}
              </button>
            </div>
            {error ? <p className="deckgo-note">{error}</p> : null}
            {docs.length === 0 ? (
              <p className="deckgo-note">No docs loaded.</p>
            ) : (
              <ul className="deckgo-shell-list">
                {docs.map((doc) => (
                  <li key={doc.id}>
                    <button
                      type="button"
                      className={`deckgo-selectable-card ${selectedDoc?.id === doc.id ? "is-selected" : ""}`}
                      onClick={() => setSelectedDocId(doc.id)}
                    >
                      <strong>{doc.title}</strong>
                      <div className="deckgo-meta">
                        category: {doc.category} | language: {doc.language || "n/a"}
                      </div>
                      <div className="deckgo-meta">
                        updated: {doc.updatedAt || doc.extractedAt || "n/a"}
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
            <h2 className="deckgo-card-title">Selected doc</h2>
          </div>
          <p className="deckgo-card-subtitle">
            This slice focuses on doc browsing and operator extraction, not yet on richer knowledge
            workflows.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            {selectedDoc ? (
              <>
                <div className="deckgo-restored-hero-strip">
                  <div>
                    <p className="deckgo-kicker">Document</p>
                    <strong>{selectedDoc.title}</strong>
                    <p className="deckgo-note">
                      category: {selectedDoc.category} | session:{" "}
                      {selectedDoc.sourceSession || "n/a"}
                    </p>
                  </div>
                  <div className="deckgo-pill-row">
                    <span className="deckgo-pill">{selectedDoc.language || "unknown"}</span>
                    <span className="deckgo-pill">{selectedDoc.keywords.length} keywords</span>
                  </div>
                </div>
                <div className="deckgo-surface-tile">
                  <p className="deckgo-surface-label">Content</p>
                  <pre className="deckgo-code" style={{ whiteSpace: "pre-wrap" }}>
                    {selectedDoc.content}
                  </pre>
                </div>
                <JsonDetails title="Doc payload" payload={selectedDoc} />
              </>
            ) : (
              <p className="deckgo-note">Choose a document to inspect it.</p>
            )}
            {actionResult ? <JsonDetails title="Last docs action" payload={actionResult} /> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
