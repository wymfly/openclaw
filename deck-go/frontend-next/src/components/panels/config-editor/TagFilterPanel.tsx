"use client";

import { useTranslations } from "next-intl";
import type { TagEntry } from "@/lib/config-search";

interface TagFilterPanelProps {
  tags: TagEntry[];
  activeTags: string[];
  onToggleTag: (tag: string) => void;
}

/**
 * Horizontal chip bar showing available config field tags.
 *
 * Each chip displays the tag name and count of fields with that tag.
 * Clicking a chip toggles the tag filter (equivalent to adding/removing
 * `tag:xxx` from the search bar).
 *
 * Renders nothing when no tags are available.
 */
export function TagFilterPanel({ tags, activeTags, onToggleTag }: TagFilterPanelProps) {
  const t = useTranslations("config");

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 py-1.5">
      <span className="text-[10px] shrink-0" style={{ color: "var(--muted-foreground)" }}>
        {t("filterByTag")}
      </span>
      {tags.map(({ tag, count }) => {
        const isActive = activeTags.includes(tag);
        return (
          <button
            key={tag}
            onClick={() => onToggleTag(tag)}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full transition-colors"
            style={{
              backgroundColor: isActive ? "var(--primary)" : "var(--muted)",
              color: isActive ? "var(--primary-foreground)" : "var(--muted-foreground)",
              border: isActive ? "1px solid var(--primary)" : "1px solid var(--border)",
            }}
          >
            {tag}
            <span className="text-[10px]" style={{ opacity: 0.7 }}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
