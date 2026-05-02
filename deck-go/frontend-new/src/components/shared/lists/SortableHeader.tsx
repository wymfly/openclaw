import type { ReactNode } from "react";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "../../../deck-ui/icons";
import type { SortDirection, SortState } from "./types";

type SortableHeaderProps = {
  children: ReactNode;
  className?: string;
  columnKey: string;
  onSortChange: (sort: SortState | null) => void;
  sort: SortState | null;
};

function nextSort(columnKey: string, current: SortState | null): SortState | null {
  if (!current || current.key !== columnKey) {
    return { direction: "asc", key: columnKey };
  }
  if (current.direction === "asc") {
    return { direction: "desc", key: columnKey };
  }
  return null;
}

function ariaSortValue(direction: SortDirection | null) {
  if (direction === "asc") {
    return "ascending";
  }
  if (direction === "desc") {
    return "descending";
  }
  return "none";
}

export function SortableHeader(props: SortableHeaderProps) {
  const { children, className, columnKey, onSortChange, sort } = props;
  const isActive = sort?.key === columnKey;
  const direction = isActive ? sort.direction : null;

  return (
    <button
      aria-sort={ariaSortValue(direction)}
      className={`deckgo-sortable-header ${isActive ? "is-active" : ""} ${className ?? ""}`.trim()}
      onClick={() => onSortChange(nextSort(columnKey, sort))}
      type="button"
    >
      {children}
      {direction === "asc" ? (
        <ArrowUpIcon />
      ) : direction === "desc" ? (
        <ArrowDownIcon />
      ) : (
        <ArrowUpDownIcon />
      )}
    </button>
  );
}
