"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useDocsStore, type DocCategory } from "@/stores/docs";

const CATEGORIES: Array<DocCategory | null> = [null, "summary", "plan", "spec", "manual", "draft"];

const CATEGORY_COLORS: Record<DocCategory, string> = {
  summary: "#3b82f6",
  plan: "#8b5cf6",
  spec: "#f59e0b",
  manual: "#10b981",
  draft: "#6b7280",
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

        // Active "all" button uses primary token; active category buttons use dynamic hex color
        const isActiveAll = isActive && !cat;
        const isActiveCat = isActive && cat;

        return (
          <button
            key={cat ?? "all"}
            type="button"
            className={cn(
              "px-3 py-1 text-xs rounded-full font-medium transition-colors",
              isActiveAll && "bg-primary text-primary-foreground",
              isActiveCat && "text-primary-foreground",
              !isActive && "border text-muted-foreground bg-transparent hover:bg-muted",
            )}
            style={isActiveCat ? { backgroundColor: CATEGORY_COLORS[cat] } : undefined}
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
