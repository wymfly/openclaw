"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useCallback } from "react";
import { cn } from "@/lib/utils";
import type { SortDirection, SortState } from "./types";

interface SortableHeaderProps {
  /** Column key used in sort state. */
  columnKey: string;
  /** Column label text. */
  children: React.ReactNode;
  /** Current sort state from useListState. */
  sort: SortState | null;
  /** Called to update sort state. */
  onSortChange: (sort: SortState | null) => void;
  /** Optional className. */
  className?: string;
}

/**
 * Tri-state sort cycle: unsorted → asc → desc → unsorted.
 * When switching columns, always starts at asc.
 */
function nextSort(columnKey: string, current: SortState | null): SortState | null {
  if (!current || current.key !== columnKey) {
    return { key: columnKey, direction: "asc" };
  }
  if (current.direction === "asc") {
    return { key: columnKey, direction: "desc" };
  }
  // desc → clear
  return null;
}

export function SortableHeader({
  columnKey,
  children,
  sort,
  onSortChange,
  className,
}: SortableHeaderProps) {
  const isActive = sort?.key === columnKey;
  const direction: SortDirection | null = isActive ? sort.direction : null;

  const handleClick = useCallback(() => {
    onSortChange(nextSort(columnKey, sort));
  }, [columnKey, sort, onSortChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium cursor-pointer select-none",
        "text-muted-foreground hover:text-foreground transition-colors",
        isActive && "text-foreground",
        className,
      )}
      aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}
    >
      {children}
      <SortIcon direction={direction} />
    </button>
  );
}

function SortIcon({ direction }: { direction: SortDirection | null }) {
  if (direction === "asc") {
    return <ArrowUp size={12} className="text-primary" />;
  }
  if (direction === "desc") {
    return <ArrowDown size={12} className="text-primary" />;
  }
  return <ArrowUpDown size={12} className="opacity-40" />;
}
