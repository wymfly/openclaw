import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { SearchIcon, SlidersIcon, XIcon } from "../../../deck-ui/icons";
import { useTranslations } from "../../../i18n/provider";
import type { FilterFieldDef, FilterState } from "./types";

type ListSearchBarProps<F extends FilterState = FilterState> = {
  className?: string;
  debounceMs?: number;
  filters?: FilterFieldDef[];
  filterValues?: F;
  matchCount?: number;
  onFilterChange?: (filters: F) => void;
  onSearch: (query: string) => void;
  placeholder?: string;
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function ListSearchBar<F extends FilterState = FilterState>(props: ListSearchBarProps<F>) {
  const {
    className,
    debounceMs = 300,
    filters,
    filterValues,
    matchCount,
    onFilterChange,
    onSearch,
    placeholder,
  } = props;
  const t = useTranslations("lists");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFilters = Boolean(filters?.length);
  const hasQuery = query.trim().length > 0;

  useEffect(() => {
    debounceRef.current = setTimeout(() => onSearch(query), debounceMs);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [debounceMs, onSearch, query]);

  const clearSearch = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setQuery("");
    setFiltersOpen(false);
    onSearch("");
  }, [onSearch]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        onSearch(query);
      }
      if (event.key === "Escape") {
        clearSearch();
      }
    },
    [clearSearch, onSearch, query],
  );

  return (
    <div className={classNames("deckgo-list-search", className)}>
      <div className="deckgo-list-search-row">
        <SearchIcon className="deckgo-list-search-icon" />
        <input
          className="deckgo-list-search-input"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? t("searchPlaceholder")}
          type="text"
          value={query}
        />
        {hasQuery && matchCount != null ? (
          <span className="deckgo-list-search-count">{t("matchCount", { count: matchCount })}</span>
        ) : null}
        {hasQuery ? (
          <button
            aria-label={t("clearSearch")}
            className="deckgo-icon-button"
            onClick={clearSearch}
            type="button"
          >
            <XIcon />
          </button>
        ) : null}
        {hasFilters ? (
          <button
            aria-expanded={filtersOpen}
            aria-label={t("advancedFilters")}
            className={classNames("deckgo-icon-button", filtersOpen && "is-active")}
            onClick={() => setFiltersOpen((open) => !open)}
            type="button"
          >
            <SlidersIcon />
          </button>
        ) : null}
      </div>
      {hasFilters && filtersOpen ? (
        <div className="deckgo-list-filter-row">
          {filters?.map((field) => (
            <FilterField
              key={field.key}
              field={field}
              onChange={(value) => {
                onFilterChange?.({ ...filterValues, [field.key]: value } as F);
              }}
              value={(filterValues as Record<string, unknown> | undefined)?.[field.key]}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FilterField(props: {
  field: FilterFieldDef;
  onChange: (value: unknown) => void;
  value: unknown;
}) {
  const { field, onChange, value } = props;
  if (field.type === "select" && field.options) {
    return (
      <label className="deckgo-list-filter">
        <span>{field.label}</span>
        <select
          className="deckgo-input"
          onChange={(event) => onChange(event.target.value || undefined)}
          value={(value as string) ?? ""}
        >
          <option value="">-</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "multiselect" && field.options) {
    const selected = (value as string[] | undefined) ?? [];
    return (
      <div className="deckgo-list-filter">
        <span>{field.label}</span>
        <div className="deckgo-list-filter-options">
          {field.options.map((option) => {
            const active = selected.includes(option.value);
            return (
              <button
                className={classNames("deckgo-pill", active && "is-primary")}
                key={option.value}
                onClick={() => {
                  const next = active
                    ? selected.filter((item) => item !== option.value)
                    : [...selected, option.value];
                  onChange(next.length > 0 ? next : undefined);
                }}
                type="button"
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <label className="deckgo-list-filter">
      <span>{field.label}</span>
      <input
        className="deckgo-input"
        onChange={(event) => onChange(event.target.value || undefined)}
        type="text"
        value={(value as string) ?? ""}
      />
    </label>
  );
}
