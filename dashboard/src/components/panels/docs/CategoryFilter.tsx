"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useDocsStore, type DocCategory } from "@/stores/docs";

const CATEGORIES: Array<DocCategory | null> = [null, "summary", "plan", "spec", "manual", "draft"];

/* Map categories to CSS var–based Tailwind classes to avoid inline style */
const CATEGORY_ACTIVE_BG: Record<DocCategory, string> = {
  summary: "bg-[var(--chart-1)] text-white",
  plan: "bg-[var(--chart-2)] text-white",
  spec: "bg-[var(--chart-5)] text-white",
  manual: "bg-[var(--chart-4)] text-white",
  draft: "bg-[var(--text-secondary)] text-white",
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

        const isActiveAll = isActive && !cat;
        const isActiveCat = isActive && cat;

        return (
          <button
            key={cat ?? "all"}
            type="button"
            className={cn(
              "px-3 py-1 text-xs rounded-full font-medium transition-colors duration-150 cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
              isActiveAll && "bg-[var(--accent)] text-[var(--accent-fg)]",
              isActiveCat && cat && CATEGORY_ACTIVE_BG[cat],
              !isActive &&
                "border border-[var(--border)] text-[var(--text-secondary)] bg-transparent hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
            )}
            onClick={() => setFilterCategory(cat)}
          >
            {label}
            {count > 0 && <span className="ml-1 opacity-70 font-mono">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
