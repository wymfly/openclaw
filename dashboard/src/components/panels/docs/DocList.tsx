"use client";

import { FileCode } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useDocsStore, type Doc, type DocCategory } from "@/stores/docs";

/* Map categories to CSS var–based classes to avoid inline style */
const CATEGORY_DOT: Record<DocCategory, string> = {
  summary: "bg-[var(--chart-1)]",
  plan: "bg-[var(--chart-2)]",
  spec: "bg-[var(--chart-5)]",
  manual: "bg-[var(--chart-4)]",
  draft: "bg-[var(--text-secondary)]",
};

const CATEGORY_TEXT: Record<DocCategory, string> = {
  summary: "text-[var(--chart-1)]",
  plan: "text-[var(--chart-2)]",
  spec: "text-[var(--chart-5)]",
  manual: "text-[var(--chart-4)]",
  draft: "text-[var(--text-secondary)]",
};

const CATEGORY_ACTIVE_RING: Record<DocCategory, string> = {
  summary: "ring-[var(--chart-1)]",
  plan: "ring-[var(--chart-2)]",
  spec: "ring-[var(--chart-5)]",
  manual: "ring-[var(--chart-4)]",
  draft: "ring-[var(--text-secondary)]",
};

export function DocList() {
  const t = useTranslations("docs");
  const { docs, selectedDoc, filterCategory, searchQuery, selectDoc } = useDocsStore();

  const filtered = docs.filter((doc) => {
    if (filterCategory && doc.category !== filterCategory) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.content.toLowerCase().includes(q) ||
        doc.keywords.some((k) => k.toLowerCase().includes(q))
      );
    }
    return true;
  });

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-full text-[var(--text-secondary)]">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-tertiary)] ring-1 ring-[var(--border-subtle)]">
          <FileCode size={20} className="text-[var(--accent)]" />
        </div>
        <p className="text-sm font-medium text-[var(--text-primary)]">{t("noResults")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 overflow-y-auto">
      {filtered.map((doc) => (
        <DocCard
          key={doc.id}
          doc={doc}
          isSelected={selectedDoc?.id === doc.id}
          onSelect={() => selectDoc(doc)}
          categoryLabel={t(`category.${doc.category}`)}
        />
      ))}
    </div>
  );
}

function DocCard({
  doc,
  isSelected,
  onSelect,
  categoryLabel,
}: {
  doc: Doc;
  isSelected: boolean;
  onSelect: () => void;
  categoryLabel: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "relative text-left w-full p-3 rounded-lg transition-all duration-150 cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
        isSelected
          ? cn("bg-[var(--bg-secondary)] ring-1", CATEGORY_ACTIVE_RING[doc.category])
          : "hover:bg-[var(--bg-tertiary)]",
      )}
      onClick={onSelect}
    >
      {/* Active indicator */}
      {isSelected && (
        <span
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full",
            CATEGORY_DOT[doc.category],
          )}
          aria-hidden
        />
      )}

      <div className="flex items-center gap-2 mb-1">
        <span
          className={cn(
            "w-2 h-2 rounded-full inline-block flex-shrink-0",
            CATEGORY_DOT[doc.category],
          )}
        />
        <span className={cn("text-xs font-medium", CATEGORY_TEXT[doc.category])}>
          {categoryLabel}
        </span>
      </div>
      <p className="text-sm font-medium truncate text-[var(--text-primary)]">{doc.title}</p>
      <p className="text-xs mt-1 text-[var(--text-secondary)] font-mono">
        {new Date(doc.extractedAt).toLocaleDateString()}
      </p>
    </button>
  );
}
