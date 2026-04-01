"use client";

import { useTranslations } from "next-intl";
import { useDocsStore, type DocCategory } from "@/stores/docs";

const CATEGORIES: Array<DocCategory | null> = [null, "summary", "plan", "spec", "manual", "draft"];

const CATEGORY_COLORS: Record<DocCategory, string> = {
  summary: "var(--doc-summary)",
  plan: "var(--doc-plan)",
  spec: "var(--doc-spec)",
  manual: "var(--doc-manual)",
  draft: "var(--doc-draft)",
};

export function CategoryFilter() {
  const t = useTranslations("docs");
  const { docs, filterCategory, setFilterCategory } = useDocsStore();

  const counts = docs.reduce(
    (acc, doc) => {
      acc[doc.category] = (acc[doc.category] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="flex gap-1 flex-wrap">
      {CATEGORIES.map((cat) => {
        const isActive = filterCategory === cat;
        const label = cat ? t(`category.${cat}`) : t("category.all");
        const count = cat ? (counts[cat] ?? 0) : docs.length;

        return (
          <button
            key={cat ?? "all"}
            type="button"
            className="px-3 py-1 text-xs rounded-full font-medium transition-colors"
            style={{
              backgroundColor: isActive
                ? cat
                  ? CATEGORY_COLORS[cat]
                  : "var(--primary)"
                : "transparent",
              color: isActive ? "var(--primary-foreground)" : "var(--muted-foreground)",
              border: isActive ? "none" : "1px solid var(--border)",
            }}
            onClick={() => setFilterCategory(cat)}
          >
            {label}
            {count > 0 && <span className="ml-1 opacity-70">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
