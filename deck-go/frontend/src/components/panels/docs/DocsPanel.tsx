import { useCallback, useEffect, useMemo, useState } from "react";
import type { DeckGoDoc, DeckGoDocCategory } from "../../../api";
import { deleteDoc, extractDocs, fetchDoc, fetchDocs } from "../../../api";
import { navigateToAgent, navigateToSession } from "../../../deck-ui/panel-navigation";
import { useDeckUI } from "../../../deck-ui/ui-store";
import { useActiveSessionKey } from "../../../stores/chat-hooks";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";
import { MarkdownText } from "../chat/MarkdownText";

type PanelState = "idle" | "loading" | "ready";

const DOC_CATEGORIES: Array<DeckGoDocCategory | "all"> = [
  "all",
  "summary",
  "plan",
  "spec",
  "manual",
  "draft",
];

function formatDocDate(value?: string | null) {
  if (!value) {
    return "n/a";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function summarizeDoc(doc: DeckGoDoc) {
  const compact = doc.content.replace(/\s+/g, " ").trim();
  return compact.length > 128 ? `${compact.slice(0, 125)}...` : compact;
}

function docCategoryClass(value: DeckGoDocCategory | "all") {
  return `deckgo-doc-category--${value}`;
}

function docMatchesQuery(doc: DeckGoDoc, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return (
    doc.title.toLowerCase().includes(normalized) ||
    doc.content.toLowerCase().includes(normalized) ||
    doc.keywords.some((keyword) => keyword.toLowerCase().includes(normalized))
  );
}

export function DocsPanel() {
  const activeSessionKey = useActiveSessionKey();
  const ui = useDeckUI();
  const [docs, setDocs] = useState<DeckGoDoc[]>([]);
  const [docDetails, setDocDetails] = useState<Record<string, DeckGoDoc>>({});
  const [selectedDocId, setSelectedDocId] = useState("");
  const [category, setCategory] = useState<DeckGoDocCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<"idle" | "extracting" | "deleting">("idle");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [confirmDeleteDocId, setConfirmDeleteDocId] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async (preferredDocId?: string) => {
    setLoadState("loading");
    try {
      const next = await fetchDocs();
      const nextDocs = next.docs ?? [];
      setDocs(nextDocs);
      setDocDetails((current) => {
        const nextIds = new Set(nextDocs.map((doc) => doc.id));
        return Object.fromEntries(Object.entries(current).filter(([docId]) => nextIds.has(docId)));
      });
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
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedDocId || docDetails[selectedDocId]) {
      return undefined;
    }
    let cancelled = false;
    void fetchDoc(selectedDocId)
      .then((detail) => {
        if (!cancelled) {
          setDocDetails((current) => ({ ...current, [selectedDocId]: detail }));
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "failed to load doc detail");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [docDetails, selectedDocId]);

  const visibleDocs = useMemo(
    () =>
      docs.filter(
        (doc) => (category === "all" || doc.category === category) && docMatchesQuery(doc, query),
      ),
    [category, docs, query],
  );
  const selectedListDoc = docs.find((doc) => doc.id === selectedDocId) ?? docs[0] ?? null;
  const selectedDoc = selectedListDoc ? (docDetails[selectedListDoc.id] ?? selectedListDoc) : null;
  const confirmDeleteSelected = Boolean(selectedDoc && confirmDeleteDocId === selectedDoc.id);
  const selectedKeywords = selectedDoc?.keywords ?? [];
  const categorySummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const doc of docs) {
      counts.set(doc.category, (counts.get(doc.category) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => `${name}: ${count}`)
      .join(" · ");
  }, [docs]);
  const categoryCounts = useMemo(() => {
    const counts = new Map<DeckGoDocCategory, number>();
    for (const doc of docs) {
      counts.set(doc.category, (counts.get(doc.category) ?? 0) + 1);
    }
    return counts;
  }, [docs]);

  const extractAction = async (sessionKey?: string) => {
    if (!sessionKey?.trim()) {
      setError("active session is required before extracting docs");
      return;
    }
    setActionState("extracting");
    try {
      const result = await extractDocs(sessionKey.trim());
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
    if (!confirmDeleteSelected) {
      setConfirmDeleteDocId(selectedDoc.id);
      return;
    }
    setActionState("deleting");
    try {
      const result = await deleteDoc(selectedDoc.id);
      setActionResult(result);
      setError("");
      setConfirmDeleteDocId("");
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "doc delete failed");
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-panel-workspace deck-ui-docs">
      <div className="deckgo-column deck-ui-docs-column">
        <article className="deckgo-card is-float deck-ui-docs-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Docs hub</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Docs use existing list, extract, get, and delete routes.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-docs-body">
            <div className="deckgo-pill-row deck-ui-docs-status-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Docs {loadState}
              </span>
              <span className="deckgo-pill">{docs.length} docs</span>
              <span className="deckgo-pill">active session {activeSessionKey || "none"}</span>
            </div>
            <div className="deckgo-grid deckgo-grid-2 deck-ui-docs-stats">
              <ShellStat label="documents" value={docs.length} />
              <ShellStat label="categories" value={categorySummary || "none"} />
            </div>
            <div
              className="deckgo-doc-category-filter deck-ui-docs-category-filter"
              role="group"
              aria-label="Document categories"
            >
              {DOC_CATEGORIES.map((value) => {
                const isActive = category === value;
                const count = value === "all" ? docs.length : (categoryCounts.get(value) ?? 0);
                return (
                  <button
                    key={value}
                    type="button"
                    className={`deckgo-doc-category ${docCategoryClass(value)} ${isActive ? "is-active" : ""}`}
                    data-category-filter={value}
                    onClick={() => setCategory(value)}
                  >
                    <span className="deckgo-doc-dot" aria-hidden="true" />
                    <span>{value}</span>
                    {count > 0 ? <span className="deckgo-doc-count">{count}</span> : null}
                  </button>
                );
              })}
            </div>
            <div className="deckgo-actions deck-ui-docs-actions">
              <input
                className="deckgo-input deck-ui-docs-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="search docs"
              />
            </div>
            <div className="deckgo-actions deck-ui-docs-actions">
              <button
                className="deckgo-button deck-ui-docs-button"
                type="button"
                onClick={() => void refresh(selectedDocId)}
              >
                Refresh docs
              </button>
              <button
                className="deckgo-button deck-ui-docs-button is-primary"
                type="button"
                onClick={() => void extractAction(activeSessionKey ?? undefined)}
                disabled={actionState !== "idle" || !activeSessionKey}
              >
                {actionState === "extracting" ? "Extracting" : "Extract active session"}
              </button>
              <button
                className="deckgo-button deck-ui-docs-button is-danger"
                type="button"
                onClick={() => void deleteAction()}
                disabled={!selectedDoc || actionState !== "idle"}
              >
                {actionState === "deleting"
                  ? "Deleting"
                  : confirmDeleteSelected
                    ? "Confirm delete"
                    : "Delete"}
              </button>
              {confirmDeleteSelected ? (
                <button
                  className="deckgo-button deck-ui-docs-button"
                  type="button"
                  onClick={() => setConfirmDeleteDocId("")}
                  disabled={actionState !== "idle"}
                >
                  Cancel delete
                </button>
              ) : null}
            </div>
            {error ? <p className="deckgo-note deck-ui-docs-error">{error}</p> : null}
            {docs.length === 0 ? (
              <p className="deckgo-note deck-ui-docs-empty">No docs loaded.</p>
            ) : visibleDocs.length === 0 ? (
              <p className="deckgo-note deck-ui-docs-empty">No docs match filters.</p>
            ) : (
              <ul className="deckgo-shell-list deck-ui-docs-list">
                {visibleDocs.map((doc) => (
                  <li key={doc.id}>
                    <button
                      type="button"
                      className={`deckgo-selectable-card deck-ui-docs-row ${selectedDoc?.id === doc.id ? "is-selected" : ""}`}
                      data-doc-id={doc.id}
                      onClick={() => {
                        setSelectedDocId(doc.id);
                        setConfirmDeleteDocId("");
                      }}
                    >
                      <div className={`deckgo-doc-card-row ${docCategoryClass(doc.category)}`}>
                        <span className="deckgo-doc-dot" aria-hidden="true" />
                        <span className="deckgo-doc-category-label">{doc.category}</span>
                        <span className="deckgo-doc-date">{formatDocDate(doc.extractedAt)}</span>
                      </div>
                      <strong className="deckgo-doc-card-title">{doc.title}</strong>
                      <p className="deckgo-doc-preview">{summarizeDoc(doc)}</p>
                      <div className="deckgo-doc-keywords" aria-label={`${doc.title} keywords`}>
                        {doc.keywords.slice(0, 4).map((keyword) => (
                          <span className="deckgo-doc-keyword" key={keyword}>
                            {keyword}
                          </span>
                        ))}
                        {doc.keywords.length > 4 ? (
                          <span className="deckgo-doc-keyword">+{doc.keywords.length - 4}</span>
                        ) : null}
                      </div>
                      <div className="deckgo-meta">
                        language: {doc.language || "n/a"} | updated:{" "}
                        {formatDocDate(doc.updatedAt || doc.extractedAt)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-panel-main deck-ui-docs-column">
        <article className="deckgo-card is-float deck-ui-docs-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Selected doc</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Browse documents, inspect metadata, render Markdown, and run current-session extraction
            through the Gateway docs API.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-docs-body">
            {selectedDoc ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-docs-hero">
                  <div>
                    <p className="deckgo-kicker">Document</p>
                    <strong>{selectedDoc.title}</strong>
                    <p className="deckgo-note">
                      category: {selectedDoc.category} | session:{" "}
                      {selectedDoc.sourceSession || "n/a"}
                    </p>
                  </div>
                  <div className="deckgo-pill-row deck-ui-docs-status-row">
                    <span className="deckgo-pill">{selectedDoc.language || "unknown"}</span>
                    <span className="deckgo-pill">{selectedKeywords.length} keywords</span>
                  </div>
                </div>
                <div className="deckgo-surface-grid deck-ui-docs-surface-grid">
                  <div className="deckgo-surface-tile deck-ui-docs-surface">
                    <p className="deckgo-surface-label">Source session</p>
                    <strong>{selectedDoc.sourceSession || "n/a"}</strong>
                    {selectedDoc.sourceSession?.trim() ? (
                      <button
                        className="deckgo-button deck-ui-docs-button is-small"
                        type="button"
                        onClick={() =>
                          navigateToSession(ui, selectedDoc.sourceSession?.trim() || "")
                        }
                      >
                        Open source session
                      </button>
                    ) : null}
                  </div>
                  <div className="deckgo-surface-tile deck-ui-docs-surface">
                    <p className="deckgo-surface-label">Source agent</p>
                    <strong>{selectedDoc.sourceAgent || "n/a"}</strong>
                    {selectedDoc.sourceAgent?.trim() ? (
                      <button
                        className="deckgo-button deck-ui-docs-button is-small"
                        type="button"
                        onClick={() => navigateToAgent(ui, selectedDoc.sourceAgent?.trim() || "")}
                      >
                        Open source agent
                      </button>
                    ) : null}
                  </div>
                  <div className="deckgo-surface-tile deck-ui-docs-surface">
                    <p className="deckgo-surface-label">Extracted</p>
                    <strong>{formatDocDate(selectedDoc.extractedAt)}</strong>
                  </div>
                  <div className="deckgo-surface-tile deck-ui-docs-surface">
                    <p className="deckgo-surface-label">Updated</p>
                    <strong>{formatDocDate(selectedDoc.updatedAt)}</strong>
                  </div>
                </div>
                {selectedKeywords.length > 0 ? (
                  <div
                    className="deckgo-doc-keywords"
                    aria-label={`${selectedDoc.title} detail keywords`}
                  >
                    {selectedKeywords.map((keyword) => (
                      <span className="deckgo-doc-keyword" key={keyword}>
                        {keyword}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="deckgo-surface-tile deck-ui-docs-surface">
                  <p className="deckgo-surface-label">Content</p>
                  <div className="deckgo-doc-prose">
                    <MarkdownText text={selectedDoc.content} />
                  </div>
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
