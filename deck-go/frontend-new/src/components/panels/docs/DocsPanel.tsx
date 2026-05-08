import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Hash,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DeckGoDoc, DeckGoDocCategory } from "../../../api";
import {
  useDeleteDocMutation,
  useDocDetailQuery,
  useDocsListQuery,
  useExtractDocsMutation,
} from "../../../data/modules/docs";
import { navigateToAgent, navigateToSession } from "../../../deck-ui/panel-navigation";
import { useDeckUI } from "../../../deck-ui/ui-store";
import { useTranslations } from "../../../i18n/provider";
import { useActiveSessionKey } from "../../../stores/chat-hooks";
import { JsonDetails } from "../../shared/ShellComponents";
import { MarkdownText } from "../chat/MarkdownText";
import "./docs-panel.css";

type PanelState = "idle" | "loading" | "ready";
type ExtractPhase = "idle" | "running" | "done";

type SearchResult = {
  id: string;
  category: DeckGoDocCategory;
  title: string;
  keywords: string[];
  snippet: string;
  score: number;
};

const DOC_CATEGORIES: DeckGoDocCategory[] = ["summary", "plan", "spec", "manual", "draft"];

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

function categoryClass(value: DeckGoDocCategory | "all") {
  return `docs-panel__category--${value}`;
}

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function deriveExcerpt(content: string) {
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (
      trimmed.startsWith("#") ||
      trimmed.startsWith("```") ||
      trimmed.startsWith("|") ||
      trimmed.startsWith("- ") ||
      trimmed.startsWith("* ")
    ) {
      continue;
    }
    return trimmed.length > 160 ? `${trimmed.slice(0, 157)}...` : trimmed;
  }
  const compact = content.replace(/\s+/g, " ").trim();
  return compact.length > 160 ? `${compact.slice(0, 157)}...` : compact;
}

function countOccurrences(value: string, query: string) {
  if (!query) {
    return 0;
  }
  let count = 0;
  let index = value.toLowerCase().indexOf(query);
  while (index >= 0) {
    count += 1;
    index = value.toLowerCase().indexOf(query, index + query.length);
  }
  return count;
}

function buildSnippet(content: string, query: string) {
  const compact = content.replace(/\s+/g, " ").trim();
  if (!query) {
    return deriveExcerpt(content);
  }
  const matchIndex = compact.toLowerCase().indexOf(query);
  if (matchIndex < 0) {
    return deriveExcerpt(content);
  }
  const start = Math.max(0, matchIndex - 60);
  const end = Math.min(compact.length, matchIndex + query.length + 80);
  const prefix = start > 0 ? "... " : "";
  const suffix = end < compact.length ? " ..." : "";
  return `${prefix}${compact.slice(start, end)}${suffix}`;
}

function buildSearchResults(docs: DeckGoDoc[], query: string): SearchResult[] {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return [];
  }
  return docs
    .map((doc) => {
      const titleMatch = doc.title.toLowerCase().includes(normalized);
      const keywordMatches = doc.keywords.filter((keyword) =>
        keyword.toLowerCase().includes(normalized),
      ).length;
      const sessionMatch = doc.sourceSession?.toLowerCase().includes(normalized) ? 1 : 0;
      const agentMatch = doc.sourceAgent?.toLowerCase().includes(normalized) ? 1 : 0;
      const contentMatches = countOccurrences(doc.content, normalized);
      const score =
        Number(titleMatch) * 10 +
        keywordMatches * 5 +
        sessionMatch * 3 +
        agentMatch * 2 +
        contentMatches;
      return {
        id: doc.id,
        category: doc.category,
        title: doc.title,
        keywords: doc.keywords,
        snippet: buildSnippet(doc.content, normalized),
        score,
      };
    })
    .filter((result) => result.score > 0)
    .toSorted((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, 12);
}

function extractOutline(content: string) {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("## "))
    .map((line) => line.replace(/^##\s+/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

function readHashDocId() {
  if (typeof window === "undefined") {
    return "";
  }
  const hash = window.location.hash.replace(/^#\/?/, "").trim();
  return hash || "";
}

function writeHashDocId(docId: string) {
  if (typeof window === "undefined" || !docId) {
    return;
  }
  window.history.replaceState(null, "", `#/${docId}`);
}

function Highlight({ text, query }: { text: string; query: string }) {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return <>{text}</>;
  }
  const lower = text.toLowerCase();
  const parts: Array<{ value: string; hit: boolean }> = [];
  let cursor = 0;
  let index = lower.indexOf(normalized);
  while (index >= 0) {
    if (index > cursor) {
      parts.push({ value: text.slice(cursor, index), hit: false });
    }
    parts.push({ value: text.slice(index, index + normalized.length), hit: true });
    cursor = index + normalized.length;
    index = lower.indexOf(normalized, cursor);
  }
  if (cursor < text.length) {
    parts.push({ value: text.slice(cursor), hit: false });
  }
  return (
    <>
      {parts.map((part, index) =>
        part.hit ? (
          <mark key={`${part.value}-${index}`}>{part.value}</mark>
        ) : (
          <span key={`${part.value}-${index}`}>{part.value}</span>
        ),
      )}
    </>
  );
}

export function DocsPanel() {
  const t = useTranslations("docs");
  const tc = useTranslations("common");
  const activeSessionKey = useActiveSessionKey();
  const ui = useDeckUI();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const extractTimerRef = useRef<number | null>(null);
  const [selectedDocId, setSelectedDocId] = useState(() => readHashDocId());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<DeckGoDocCategory>>(
    () => new Set(),
  );
  const [keywordFilter, setKeywordFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<"idle" | "extracting" | "deleting">("idle");
  const [extractOpen, setExtractOpen] = useState(false);
  const [extractPhase, setExtractPhase] = useState<ExtractPhase>("idle");
  const [extractError, setExtractError] = useState("");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [confirmDeleteDocId, setConfirmDeleteDocId] = useState("");
  const [copiedDocId, setCopiedDocId] = useState("");
  const [error, setError] = useState("");
  const docsQuery = useDocsListQuery();
  const detailQuery = useDocDetailQuery(selectedDocId, { enabled: Boolean(selectedDocId) });
  const extractDocsMutation = useExtractDocsMutation();
  const deleteDocMutation = useDeleteDocMutation();

  const refresh = useCallback(
    async (preferredDocId?: string) => {
      try {
        const result = await docsQuery.refetch();
        const nextDocs = result.data?.docs ?? [];
        setLoadState("ready");
        setError("");
        setSelectedDocId((current) => {
          const candidates = [preferredDocId, current, readHashDocId(), nextDocs[0]?.id];
          const match = candidates.find(
            (candidate) => candidate && nextDocs.some((doc) => doc.id === candidate),
          );
          return match || "";
        });
      } catch (loadError) {
        setLoadState("idle");
        setError(loadError instanceof Error ? loadError.message : t("loadFailed"));
      }
    },
    [docsQuery, t],
  );

  useEffect(() => {
    const nextDocs = docsQuery.data?.docs ?? [];
    setLoadState(docsQuery.isLoading ? "loading" : docsQuery.data ? "ready" : "idle");
    if (docsQuery.error) {
      setError(docsQuery.error instanceof Error ? docsQuery.error.message : t("loadFailed"));
      return;
    }
    setSelectedDocId((current) => {
      const candidates = [current, readHashDocId(), nextDocs[0]?.id];
      const match = candidates.find(
        (candidate) => candidate && nextDocs.some((doc) => doc.id === candidate),
      );
      return match || "";
    });
  }, [docsQuery.data, docsQuery.error, docsQuery.isLoading, t]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setExtractOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(
    () => () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      if (extractTimerRef.current !== null) {
        window.clearTimeout(extractTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (detailQuery.error) {
      setError(
        detailQuery.error instanceof Error ? detailQuery.error.message : t("detailLoadFailed"),
      );
    }
  }, [detailQuery.error, t]);

  useEffect(() => {
    setConfirmDeleteDocId("");
    if (selectedDocId) {
      writeHashDocId(selectedDocId);
    }
  }, [selectedDocId]);

  const docs = useMemo(() => docsQuery.data?.docs ?? [], [docsQuery.data]);
  const selectedListDoc = docs.find((doc) => doc.id === selectedDocId) ?? docs[0] ?? null;
  const selectedDoc = selectedListDoc
    ? detailQuery.data && detailQuery.data.id === selectedListDoc.id
      ? detailQuery.data
      : selectedListDoc
    : null;
  const confirmDeleteSelected = Boolean(selectedDoc && confirmDeleteDocId === selectedDoc.id);
  const searchResults = useMemo(() => buildSearchResults(docs, query), [docs, query]);
  const filteredTreeDocs = useMemo(
    () =>
      keywordFilter
        ? docs.filter((doc) =>
            doc.keywords.some((keyword) => keyword.toLowerCase() === keywordFilter.toLowerCase()),
          )
        : docs,
    [docs, keywordFilter],
  );
  const groupedDocs = useMemo(() => {
    const groups = new Map<DeckGoDocCategory, DeckGoDoc[]>();
    for (const category of DOC_CATEGORIES) {
      groups.set(category, []);
    }
    for (const doc of filteredTreeDocs) {
      groups.get(doc.category)?.push(doc);
    }
    return groups;
  }, [filteredTreeDocs]);
  const allKeywords = useMemo(() => {
    const items = new Set<string>();
    for (const doc of docs) {
      for (const keyword of doc.keywords) {
        items.add(keyword);
      }
    }
    return Array.from(items).toSorted((left, right) => left.localeCompare(right));
  }, [docs]);
  const outline = useMemo(() => extractOutline(selectedDoc?.content ?? ""), [selectedDoc?.content]);
  const relatedDocs = useMemo(() => {
    if (!selectedDoc || selectedDoc.keywords.length === 0) {
      return [];
    }
    const selectedKeywords = new Set(selectedDoc.keywords.map((keyword) => keyword.toLowerCase()));
    return docs
      .filter(
        (doc) =>
          doc.id !== selectedDoc.id &&
          doc.keywords.some((keyword) => selectedKeywords.has(keyword.toLowerCase())),
      )
      .slice(0, 4);
  }, [docs, selectedDoc]);

  const selectDoc = (docId: string) => {
    setSelectedDocId(docId);
    setSearchOpen(false);
    setQuery("");
  };

  const toggleCategory = (category: DeckGoDocCategory) => {
    setCollapsedCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const toggleKeywordFilter = (keyword: string) => {
    setKeywordFilter((current) =>
      current?.toLowerCase() === keyword.toLowerCase() ? null : keyword,
    );
  };

  const copyDocId = (docId: string) => {
    void navigator.clipboard?.writeText(docId).catch(() => undefined);
    setCopiedDocId(docId);
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => setCopiedDocId(""), 1400);
  };

  const runExtract = async () => {
    const sessionKey = activeSessionKey?.trim();
    if (!sessionKey) {
      setExtractError(t("activeSessionRequired"));
      return;
    }
    setActionState("extracting");
    setExtractPhase("running");
    setExtractError("");
    try {
      const result = await extractDocsMutation.mutateAsync(sessionKey);
      setActionResult(result);
      setError("");
      setExtractPhase("done");
      await refresh(result.docs?.[0]?.id ?? selectedDocId);
      if (extractTimerRef.current !== null) {
        window.clearTimeout(extractTimerRef.current);
      }
      extractTimerRef.current = window.setTimeout(() => {
        setExtractOpen(false);
        setExtractPhase("idle");
      }, 900);
    } catch (actionError) {
      setExtractPhase("idle");
      setExtractError(actionError instanceof Error ? actionError.message : t("extractFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const runDelete = async () => {
    if (!selectedDoc) {
      return;
    }
    if (!confirmDeleteSelected) {
      setConfirmDeleteDocId(selectedDoc.id);
      return;
    }
    setActionState("deleting");
    try {
      const result = await deleteDocMutation.mutateAsync(selectedDoc.id);
      setActionResult(result);
      setError("");
      setConfirmDeleteDocId("");
      const nextDocId = docs.find((doc) => doc.id !== selectedDoc.id)?.id;
      await refresh(nextDocId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("deleteFailed"));
      setConfirmDeleteDocId("");
    } finally {
      setActionState("idle");
    }
  };

  const treeEmpty = docs.length === 0 || filteredTreeDocs.length === 0;

  return (
    <section className="docs-panel" data-testid="docs-panel">
      <header className="docs-panel__topbar">
        <div className="docs-panel__brand">
          <BookOpen size={17} aria-hidden="true" />
          <strong>{t("title")}</strong>
          <span>{t("subtitle")}</span>
        </div>
        <div className="docs-panel__search-wrap">
          <label className="docs-panel__search" aria-label={t("searchAria")}>
            <Search size={15} aria-hidden="true" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder={t("searchWithShortcut")}
            />
            {query ? (
              <button
                className="docs-panel__icon-button"
                type="button"
                aria-label={t("clearSearch")}
                onClick={() => {
                  setQuery("");
                  setSearchOpen(false);
                }}
              >
                <X size={14} aria-hidden="true" />
              </button>
            ) : null}
          </label>
          {searchOpen && query ? (
            <div
              className="docs-panel__search-results"
              role="dialog"
              aria-label={t("searchResults")}
            >
              <div className="docs-panel__search-results-head">
                <span>{t("matchCount", { count: searchResults.length })}</span>
                <button
                  className="docs-panel__icon-button"
                  type="button"
                  aria-label={t("closeSearch")}
                  onClick={() => {
                    setQuery("");
                    setSearchOpen(false);
                  }}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
              {searchResults.length > 0 ? (
                <ul className="docs-panel__search-list">
                  {searchResults.map((result) => (
                    <li key={result.id}>
                      <button type="button" onClick={() => selectDoc(result.id)}>
                        <span
                          className={`docs-panel__category-chip ${categoryClass(result.category)}`}
                        >
                          {t(`category.${result.category}`)}
                        </span>
                        <strong>
                          <Highlight text={result.title} query={query} />
                        </strong>
                        <span>
                          <Highlight text={result.snippet} query={query} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="docs-panel__empty">{t("searchEmpty")}</p>
              )}
            </div>
          ) : null}
        </div>
        <div className="docs-panel__topbar-actions">
          <span className="docs-panel__count">{t("docCount", { count: docs.length })}</span>
          <div className="docs-panel__extract">
            <button
              className="docs-panel__button is-primary"
              type="button"
              onClick={() => {
                setExtractOpen((current) => !current);
                setExtractError("");
              }}
              disabled={actionState !== "idle" || !activeSessionKey}
            >
              <ArrowRight size={14} aria-hidden="true" />
              {t("extractActiveSession")}
            </button>
            {extractOpen ? (
              <div className="docs-panel__extract-pop" role="dialog" aria-label={t("extract")}>
                <div className="docs-panel__extract-head">
                  <strong>{t("activeSessionTitle")}</strong>
                  <button
                    className="docs-panel__icon-button"
                    type="button"
                    aria-label={tc("close")}
                    onClick={() => setExtractOpen(false)}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
                <div className="docs-panel__extract-body">
                  <div>
                    <span>{t("session")}</span>
                    <code>{activeSessionKey || t("none")}</code>
                  </div>
                  <div>
                    <span>{t("destination")}</span>
                    <span>{t("localRegistry")}</span>
                  </div>
                  <div>
                    <span>{t("evidenceLevel")}</span>
                    <span>{t("mockOrRealGateway")}</span>
                  </div>
                </div>
                <div className="docs-panel__extract-foot">
                  {extractPhase === "idle" ? (
                    <>
                      <button
                        className="docs-panel__button"
                        type="button"
                        onClick={() => setExtractOpen(false)}
                      >
                        {tc("cancel")}
                      </button>
                      <button
                        className="docs-panel__button is-primary"
                        type="button"
                        disabled={!activeSessionKey || actionState !== "idle"}
                        onClick={() => void runExtract()}
                      >
                        {t("extract")}
                      </button>
                    </>
                  ) : null}
                  {extractPhase === "running" ? (
                    <span className="docs-panel__muted">{t("extracting")}</span>
                  ) : null}
                  {extractPhase === "done" ? (
                    <span className="docs-panel__done">{t("extractDone")}</span>
                  ) : null}
                  {extractError ? (
                    <span className="docs-panel__error-inline">{extractError}</span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="docs-panel__workspace">
        <aside className="docs-panel__tree" aria-label={t("documentCategories")}>
          <div className="docs-panel__rail-head">
            <span className={loadState === "ready" ? "is-positive" : "is-muted"}>
              {loadState === "loading" ? tc("loading") : t(loadState)}
            </span>
            <span>{t("activeSession", { session: activeSessionKey || t("none") })}</span>
          </div>
          {keywordFilter ? (
            <div className="docs-panel__keyword-filter">
              <span>{t("keywordFilter", { keyword: keywordFilter })}</span>
              <button type="button" onClick={() => setKeywordFilter(null)}>
                <X size={13} aria-hidden="true" />
                {t("clear")}
              </button>
            </div>
          ) : null}
          <button
            className="docs-panel__refresh"
            type="button"
            onClick={() => void refresh(selectedDocId)}
          >
            {t("refresh")}
          </button>
          {error ? <p className="docs-panel__error">{error}</p> : null}
          {docs.length === 0 ? <p className="docs-panel__empty">{t("empty")}</p> : null}
          {!treeEmpty ? (
            <div className="docs-panel__tree-groups">
              {DOC_CATEGORIES.map((docCategory) => {
                const categoryDocs = groupedDocs.get(docCategory) ?? [];
                if (keywordFilter && categoryDocs.length === 0) {
                  return null;
                }
                const collapsed = !keywordFilter && collapsedCategories.has(docCategory);
                return (
                  <section key={docCategory} className="docs-panel__tree-group">
                    <button
                      className={`docs-panel__tree-group-head ${categoryClass(docCategory)}`}
                      type="button"
                      onClick={() => toggleCategory(docCategory)}
                    >
                      {collapsed ? (
                        <ChevronRight size={14} aria-hidden="true" />
                      ) : (
                        <ChevronDown size={14} aria-hidden="true" />
                      )}
                      <span className="docs-panel__category-dot" aria-hidden="true" />
                      <span>
                        <strong>{t(`categoryPlural.${docCategory}`)}</strong>
                        <small>{t(`categoryDescription.${docCategory}`)}</small>
                      </span>
                      <em>{categoryDocs.length}</em>
                    </button>
                    {!collapsed ? (
                      categoryDocs.length > 0 ? (
                        <ul className="docs-panel__doc-list">
                          {categoryDocs.map((doc) => (
                            <li key={doc.id}>
                              <button
                                type="button"
                                className={`docs-panel__doc-row ${selectedDoc?.id === doc.id ? "is-selected" : ""}`}
                                data-doc-id={doc.id}
                                onClick={() => selectDoc(doc.id)}
                              >
                                <strong>{doc.title}</strong>
                                <span>{deriveExcerpt(doc.content)}</span>
                                <small>{formatDocDate(doc.extractedAt)}</small>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="docs-panel__empty is-compact">{t("emptyCategory")}</p>
                      )
                    ) : null}
                  </section>
                );
              })}
            </div>
          ) : docs.length > 0 ? (
            <p className="docs-panel__empty">{t("noMatches")}</p>
          ) : null}
        </aside>

        <section className="docs-panel__viewer">
          {selectedDoc ? (
            <article className="docs-panel__reader">
              <header className="docs-panel__hero">
                <nav className="docs-panel__breadcrumb" aria-label={t("breadcrumb")}>
                  <BookOpen size={15} aria-hidden="true" />
                  <span>{t(`categoryPlural.${selectedDoc.category}`)}</span>
                  <ChevronRight size={14} aria-hidden="true" />
                  <span>{selectedDoc.title}</span>
                </nav>
                <h2>{selectedDoc.title}</h2>
                <p>{deriveExcerpt(selectedDoc.content)}</p>
                <div className="docs-panel__provenance">
                  <span>{t("source")}</span>
                  <strong>{selectedDoc.sourceAgent || t("notAvailable")}</strong>
                  <code>{selectedDoc.sourceSession || t("notAvailable")}</code>
                </div>
                <div className="docs-panel__meta-row">
                  <span>
                    <Clock size={13} aria-hidden="true" />
                    {t("extracted")} {formatDocDate(selectedDoc.extractedAt)}
                  </span>
                  <span>
                    <Clock size={13} aria-hidden="true" />
                    {t("updated")} {formatDocDate(selectedDoc.updatedAt)}
                  </span>
                  <span>{selectedDoc.language || t("unknown")}</span>
                  <button type="button" onClick={() => copyDocId(selectedDoc.id)}>
                    <Hash size={13} aria-hidden="true" />
                    <code>{selectedDoc.id}</code>
                    <Copy size={13} aria-hidden="true" />
                    {copiedDocId === selectedDoc.id ? <em>{t("copied")}</em> : null}
                  </button>
                  {confirmDeleteSelected ? (
                    <span className="docs-panel__confirm" role="alertdialog">
                      <span>{t("deletePrompt")}</span>
                      <button
                        className="docs-panel__button is-danger"
                        type="button"
                        disabled={actionState !== "idle"}
                        onClick={() => void runDelete()}
                      >
                        {actionState === "deleting" ? t("deleting") : t("confirmDelete")}
                      </button>
                      <button
                        className="docs-panel__button"
                        type="button"
                        disabled={actionState !== "idle"}
                        onClick={() => setConfirmDeleteDocId("")}
                      >
                        {tc("cancel")}
                      </button>
                    </span>
                  ) : (
                    <button
                      className="docs-panel__delete"
                      type="button"
                      onClick={() => void runDelete()}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                      {t("delete")}
                    </button>
                  )}
                </div>
                {selectedDoc.keywords.length > 0 ? (
                  <div className="docs-panel__keyword-row" aria-label={t("keywords")}>
                    {selectedDoc.keywords.map((keyword) => (
                      <button
                        key={keyword}
                        className={keywordFilter === keyword ? "is-active" : ""}
                        type="button"
                        onClick={() => toggleKeywordFilter(keyword)}
                      >
                        <Tag size={12} aria-hidden="true" />
                        {keyword}
                      </button>
                    ))}
                  </div>
                ) : null}
              </header>

              <div className="docs-panel__reader-body">
                <div className="docs-panel__prose-wrap">
                  <MarkdownText text={selectedDoc.content} />
                  {relatedDocs.length > 0 ? (
                    <section className="docs-panel__related">
                      <h3>{t("relatedDocs")}</h3>
                      <ul>
                        {relatedDocs.map((doc) => (
                          <li key={doc.id}>
                            <button type="button" onClick={() => selectDoc(doc.id)}>
                              <strong>{doc.title}</strong>
                              <span>{deriveExcerpt(doc.content)}</span>
                              <ArrowRight size={14} aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                  <JsonDetails title={t("docPayload")} payload={selectedDoc} />
                  {actionResult ? (
                    <JsonDetails title={t("lastDocsAction")} payload={actionResult} />
                  ) : null}
                </div>
                <aside className="docs-panel__outline">
                  <h3>{t("onThisPage")}</h3>
                  {outline.length > 0 ? (
                    <ul>
                      {outline.map((heading) => (
                        <li key={heading}>{heading}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>{t("noOutline")}</p>
                  )}
                  <h3>{t("allKeywords")}</h3>
                  {allKeywords.length > 0 ? (
                    <div className="docs-panel__keyword-cloud">
                      {allKeywords.map((keyword) => (
                        <button
                          key={keyword}
                          className={keywordFilter === keyword ? "is-active" : ""}
                          type="button"
                          onClick={() => toggleKeywordFilter(keyword)}
                        >
                          {keyword}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p>{t("notAvailable")}</p>
                  )}
                  <div className="docs-panel__source-actions">
                    {selectedDoc.sourceSession?.trim() ? (
                      <button
                        className="docs-panel__button"
                        type="button"
                        onClick={() =>
                          navigateToSession(ui, selectedDoc.sourceSession?.trim() || "")
                        }
                      >
                        {t("openSourceSession")}
                      </button>
                    ) : null}
                    {selectedDoc.sourceAgent?.trim() ? (
                      <button
                        className="docs-panel__button"
                        type="button"
                        onClick={() => navigateToAgent(ui, selectedDoc.sourceAgent?.trim() || "")}
                      >
                        {t("openSourceAgent")}
                      </button>
                    ) : null}
                  </div>
                </aside>
              </div>
            </article>
          ) : (
            <div className="docs-panel__viewer-empty">
              <BookOpen size={20} aria-hidden="true" />
              <p>{t("chooseDoc")}</p>
            </div>
          )}
        </section>
      </main>
    </section>
  );
}
