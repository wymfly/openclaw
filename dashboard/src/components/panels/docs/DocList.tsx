"use client";

import { useTranslations } from "next-intl";
import { useDocsStore, type Doc, type DocCategory } from "@/stores/docs";

const CATEGORY_COLORS: Record<DocCategory, string> = {
  summary: "#3b82f6",
  plan: "#8b5cf6",
  spec: "#f59e0b",
  manual: "#10b981",
  draft: "#6b7280",
};

export function DocList() {
  const t = useTranslations("docs");
  const { docs, selectedDoc, filterCategory, searchQuery, selectDoc } = useDocsStore();

  // Client-side filtering
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
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--text-secondary)" }}
      >
        <p className="text-sm">{t("noResults")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 overflow-y-auto">
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
  const color = CATEGORY_COLORS[doc.category];

  return (
    <button
      type="button"
      className="text-left w-full p-3 rounded-lg border transition-colors"
      style={{
        borderColor: isSelected ? color : "var(--border)",
        backgroundColor: isSelected ? "var(--bg-secondary)" : "transparent",
      }}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="w-2 h-2 rounded-full inline-block flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs font-medium" style={{ color }}>
          {categoryLabel}
        </span>
      </div>
      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
        {doc.title}
      </p>
      <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
        {new Date(doc.extractedAt).toLocaleDateString()}
      </p>
    </button>
  );
}
