"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { FilterFieldDef, FilterState } from "./types";

interface ListSearchBarProps<F extends FilterState = FilterState> {
  /** Called after debounce delay with the search text. */
  onSearch: (query: string) => void;
  /** Debounce delay in milliseconds. Default: 300. */
  debounceMs?: number;
  /** Number of matches to display. Omit to hide. */
  matchCount?: number;
  /** Placeholder text override. Falls back to i18n default. */
  placeholder?: string;
  /** Advanced filter field definitions. Omit to hide filter button. */
  filters?: FilterFieldDef[];
  /** Current filter values. */
  filterValues?: F;
  /** Called when any advanced filter value changes. */
  onFilterChange?: (filters: F) => void;
  /** Optional className for the outer container. */
  className?: string;
}

export function ListSearchBar<F extends FilterState = FilterState>({
  onSearch,
  debounceMs = 300,
  matchCount,
  placeholder,
  filters,
  filterValues,
  onFilterChange,
  className,
}: ListSearchBarProps<F>) {
  const t = useTranslations("lists");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounced search
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      onSearch(query);
    }, debounceMs);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, debounceMs, onSearch]);

  const clearSearch = useCallback(() => {
    setQuery("");
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    onSearch("");
    setFiltersOpen(false);
  }, [onSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        onSearch(query);
      } else if (e.key === "Escape") {
        clearSearch();
      }
    },
    [query, onSearch, clearSearch],
  );

  const hasQuery = query.trim().length > 0;
  const hasFilters = filters && filters.length > 0;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-[var(--border)] bg-card">
        <Search size={14} className="text-muted-foreground shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? t("searchPlaceholder")}
          className="flex-1 min-w-0 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
        />

        {/* Match count */}
        {hasQuery && matchCount != null && (
          <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
            {t("matchCount", { count: matchCount })}
          </span>
        )}

        {/* Clear button */}
        {hasQuery && (
          <button
            type="button"
            onClick={clearSearch}
            className="p-0.5 rounded hover:bg-muted text-muted-foreground cursor-pointer"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}

        {/* Advanced filter toggle */}
        {hasFilters && (
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={cn(
              "p-0.5 rounded hover:bg-muted text-muted-foreground cursor-pointer",
              filtersOpen && "bg-muted text-foreground",
            )}
            aria-label={t("advancedFilters")}
          >
            <SlidersHorizontal size={14} />
          </button>
        )}
      </div>

      {/* Advanced filter area */}
      {hasFilters && filtersOpen && (
        <div className="flex flex-wrap gap-2 px-3 py-2 rounded-md border border-[var(--border-subtle)] bg-card">
          {filters.map((field) => (
            <FilterField
              key={field.key}
              field={field}
              value={(filterValues as Record<string, unknown>)?.[field.key]}
              onChange={(val) => {
                if (onFilterChange) {
                  onFilterChange({
                    ...filterValues,
                    [field.key]: val,
                  } as F);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter field renderer
// ---------------------------------------------------------------------------

function FilterField({
  field,
  value,
  onChange,
}: {
  field: FilterFieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (field.type === "select" && field.options) {
    return (
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>{field.label}</span>
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="text-xs bg-transparent border border-[var(--border)] rounded px-1.5 py-0.5 text-foreground outline-none"
        >
          <option value="">—</option>
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "multiselect" && field.options) {
    const selected = (value as string[]) ?? [];
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>{field.label}</span>
        <div className="flex flex-wrap gap-1">
          {field.options.map((opt) => {
            const active = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const next = active
                    ? selected.filter((v) => v !== opt.value)
                    : [...selected, opt.value];
                  onChange(next.length > 0 ? next : undefined);
                }}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] border transition-colors cursor-pointer",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-[var(--border)] text-muted-foreground hover:bg-muted",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // text
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span>{field.label}</span>
      <input
        type="text"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="text-xs bg-transparent border border-[var(--border)] rounded px-1.5 py-0.5 text-foreground outline-none w-24"
      />
    </label>
  );
}
