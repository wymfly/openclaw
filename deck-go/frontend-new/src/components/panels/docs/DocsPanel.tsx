import { useCallback, useEffect, useMemo, useState } from "react";
import type { DeckGoDoc, DeckGoDocCategory } from "../../../api";
import { deleteDoc, extractDocs, fetchDoc, fetchDocs } from "../../../api";
import { navigateToAgent, navigateToSession } from "../../../deck-ui/panel-navigation";
import { useDeckUI } from "../../../deck-ui/ui-store";
import { useTranslations } from "../../../i18n/provider";
import { useActiveSessionKey } from "../../../stores/chat-hooks";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";
import { MarkdownText } from "../chat/MarkdownText";
import "./docs-panel.css";

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
  return `docs-panel__category--${value}`;
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
  const t = useTranslations("docs");
  const tc = useTranslations("common");
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

  const refresh = useCallback(
    async (preferredDocId?: string) => {
      setLoadState("loading");
      try {
        const next = await fetchDocs();
        const nextDocs = next.docs ?? [];
        setDocs(nextDocs);
        setDocDetails((current) => {
          const nextIds = new Set(nextDocs.map((doc) => doc.id));
          return Object.fromEntries(
            Object.entries(current).filter(([docId]) => nextIds.has(docId)),
          );
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
        setError(loadError instanceof Error ? loadError.message : t("loadFailed"));
      }
    },
    [t],
  );

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
          setError(loadError instanceof Error ? loadError.message : t("detailLoadFailed"));
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
      const label = t(`category.${doc.category}`);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => `${name}: ${count}`)
      .join(" · ");
  }, [docs, t]);
  const categoryCounts = useMemo(() => {
    const counts = new Map<DeckGoDocCategory, number>();
    for (const doc of docs) {
      counts.set(doc.category, (counts.get(doc.category) ?? 0) + 1);
    }
    return counts;
  }, [docs]);

  const extractAction = async (sessionKey?: string) => {
    if (!sessionKey?.trim()) {
      setError(t("activeSessionRequired"));
      return;
    }
    setActionState("extracting");
    try {
      const result = await extractDocs(sessionKey.trim());
      setActionResult(result);
      setError("");
      await refresh(selectedDocId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("extractFailed"));
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
      setError(actionError instanceof Error ? actionError.message : t("deleteFailed"));
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="docs-panel" data-testid="docs-panel">
      <div className="docs-panel__column">
        <article className="docs-panel__card">
          <div className="docs-panel__card-head">
            <h2 className="docs-panel__card-title">{t("title")}</h2>
          </div>
          <p className="docs-panel__description">{t("description")}</p>
          <div className="docs-panel__body">
            <div className="docs-panel__pill-row">
              <span
                className={`docs-panel__pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}
              >
                {loadState === "loading" ? tc("loading") : t(loadState)}
              </span>
              <span className="docs-panel__pill">{t("docCount", { count: docs.length })}</span>
              <span className="docs-panel__pill">
                {t("activeSession", { session: activeSessionKey || t("none") })}
              </span>
            </div>
            <div className="docs-panel__metrics">
              <ShellStat label={t("documents")} value={docs.length} />
              <ShellStat label={t("categories")} value={categorySummary || t("none")} />
            </div>
            <div
              className="docs-panel__category-filter"
              role="group"
              aria-label={t("documentCategories")}
            >
              {DOC_CATEGORIES.map((value) => {
                const isActive = category === value;
                const count = value === "all" ? docs.length : (categoryCounts.get(value) ?? 0);
                const label = value === "all" ? t("category.all") : t(`category.${value}`);
                return (
                  <button
                    key={value}
                    type="button"
                    className={`docs-panel__category ${docCategoryClass(value)} ${isActive ? "is-active" : ""}`}
                    data-category-filter={value}
                    onClick={() => setCategory(value)}
                  >
                    <span className="docs-panel__dot" aria-hidden="true" />
                    <span>{label}</span>
                    {count > 0 ? <span className="docs-panel__count">{count}</span> : null}
                  </button>
                );
              })}
            </div>
            <div className="docs-panel__actions">
              <input
                className="docs-panel__input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("search")}
              />
            </div>
            <div className="docs-panel__actions">
              <button
                className="docs-panel__button"
                type="button"
                onClick={() => void refresh(selectedDocId)}
              >
                {t("refresh")}
              </button>
              <button
                className="docs-panel__button is-primary"
                type="button"
                onClick={() => void extractAction(activeSessionKey ?? undefined)}
                disabled={actionState !== "idle" || !activeSessionKey}
              >
                {actionState === "extracting" ? t("extracting") : t("extractActiveSession")}
              </button>
              <button
                className="docs-panel__button is-danger"
                type="button"
                onClick={() => void deleteAction()}
                disabled={!selectedDoc || actionState !== "idle"}
              >
                {actionState === "deleting"
                  ? t("deleting")
                  : confirmDeleteSelected
                    ? t("confirmDelete")
                    : t("delete")}
              </button>
              {confirmDeleteSelected ? (
                <button
                  className="docs-panel__button"
                  type="button"
                  onClick={() => setConfirmDeleteDocId("")}
                  disabled={actionState !== "idle"}
                >
                  {t("cancelDelete")}
                </button>
              ) : null}
            </div>
            {error ? <p className="docs-panel__error">{error}</p> : null}
            {docs.length === 0 ? (
              <p className="docs-panel__empty">{t("empty")}</p>
            ) : visibleDocs.length === 0 ? (
              <p className="docs-panel__empty">{t("noMatches")}</p>
            ) : (
              <ul className="docs-panel__list">
                {visibleDocs.map((doc) => (
                  <li key={doc.id}>
                    <button
                      type="button"
                      className={`docs-panel__row ${selectedDoc?.id === doc.id ? "is-selected" : ""}`}
                      data-doc-id={doc.id}
                      onClick={() => {
                        setSelectedDocId(doc.id);
                        setConfirmDeleteDocId("");
                      }}
                    >
                      <div className={`docs-panel__doc-meta-row ${docCategoryClass(doc.category)}`}>
                        <span className="docs-panel__dot" aria-hidden="true" />
                        <span className="docs-panel__category-label">
                          {t(`category.${doc.category}`)}
                        </span>
                        <span className="docs-panel__date">{formatDocDate(doc.extractedAt)}</span>
                      </div>
                      <strong className="docs-panel__doc-title">{doc.title}</strong>
                      <p className="docs-panel__preview">{summarizeDoc(doc)}</p>
                      <div className="docs-panel__keywords" aria-label={`${doc.title} keywords`}>
                        {doc.keywords.slice(0, 4).map((keyword) => (
                          <span className="docs-panel__keyword" key={keyword}>
                            {keyword}
                          </span>
                        ))}
                        {doc.keywords.length > 4 ? (
                          <span className="docs-panel__keyword">+{doc.keywords.length - 4}</span>
                        ) : null}
                      </div>
                      <div className="docs-panel__meta">
                        {t("language")}: {doc.language || t("notAvailable")} | {t("updated")}:{" "}
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

      <div className="docs-panel__column docs-panel__column--main">
        <article className="docs-panel__card">
          <div className="docs-panel__card-head">
            <h2 className="docs-panel__card-title">{t("selectedDoc")}</h2>
          </div>
          <p className="docs-panel__description">{t("selectedDescription")}</p>
          <div className="docs-panel__body">
            {selectedDoc ? (
              <>
                <div className="docs-panel__hero">
                  <div>
                    <p className="docs-panel__eyebrow">{t("document")}</p>
                    <strong>{selectedDoc.title}</strong>
                    <p className="docs-panel__meta">
                      {t("categoryLabel")}: {t(`category.${selectedDoc.category}`)} | {t("session")}
                      : {selectedDoc.sourceSession || t("notAvailable")}
                    </p>
                  </div>
                  <div className="docs-panel__pill-row">
                    <span className="docs-panel__pill">{selectedDoc.language || t("unknown")}</span>
                    <span className="docs-panel__pill">
                      {t("keywordCount", { count: selectedKeywords.length })}
                    </span>
                  </div>
                </div>
                <div className="docs-panel__surface-grid">
                  <div className="docs-panel__surface">
                    <p className="docs-panel__label">{t("sourceSession")}</p>
                    <strong>{selectedDoc.sourceSession || t("notAvailable")}</strong>
                    {selectedDoc.sourceSession?.trim() ? (
                      <button
                        className="docs-panel__button is-small"
                        type="button"
                        onClick={() =>
                          navigateToSession(ui, selectedDoc.sourceSession?.trim() || "")
                        }
                      >
                        {t("openSourceSession")}
                      </button>
                    ) : null}
                  </div>
                  <div className="docs-panel__surface">
                    <p className="docs-panel__label">{t("sourceAgent")}</p>
                    <strong>{selectedDoc.sourceAgent || t("notAvailable")}</strong>
                    {selectedDoc.sourceAgent?.trim() ? (
                      <button
                        className="docs-panel__button is-small"
                        type="button"
                        onClick={() => navigateToAgent(ui, selectedDoc.sourceAgent?.trim() || "")}
                      >
                        {t("openSourceAgent")}
                      </button>
                    ) : null}
                  </div>
                  <div className="docs-panel__surface">
                    <p className="docs-panel__label">{t("extracted")}</p>
                    <strong>{formatDocDate(selectedDoc.extractedAt)}</strong>
                  </div>
                  <div className="docs-panel__surface">
                    <p className="docs-panel__label">{t("updated")}</p>
                    <strong>{formatDocDate(selectedDoc.updatedAt)}</strong>
                  </div>
                </div>
                {selectedKeywords.length > 0 ? (
                  <div
                    className="docs-panel__keywords"
                    aria-label={`${selectedDoc.title} detail keywords`}
                  >
                    {selectedKeywords.map((keyword) => (
                      <span className="docs-panel__keyword" key={keyword}>
                        {keyword}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="docs-panel__surface">
                  <p className="docs-panel__label">{t("content")}</p>
                  <div className="docs-panel__prose">
                    <MarkdownText text={selectedDoc.content} />
                  </div>
                </div>
                <JsonDetails title={t("docPayload")} payload={selectedDoc} />
              </>
            ) : (
              <p className="docs-panel__empty">{t("chooseDoc")}</p>
            )}
            {actionResult ? (
              <JsonDetails title={t("lastDocsAction")} payload={actionResult} />
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
