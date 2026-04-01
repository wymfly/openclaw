"use client";

import { Minus, Square, SquareCheck, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface BatchActionBarProps<T = unknown> {
  /** Set of selected item IDs. */
  selectedIds: Set<string>;
  /** Selected items array (resolved from IDs). */
  selectedItems?: T[];
  /** Whether all filtered items are selected. */
  isAllSelected: boolean;
  /** Whether some but not all filtered items are selected. */
  isPartialSelected: boolean;
  /** Toggle select all / clear all. */
  onSelectAll: () => void;
  /** Clear all selections. */
  onClearSelection: () => void;
  /** Render prop for custom action buttons. Receives both selectedIds and selectedItems. */
  actions?: (props: { selectedIds: Set<string>; selectedItems: T[] }) => React.ReactNode;
  /** Optional className. */
  className?: string;
}

export function BatchActionBar<T = unknown>({
  selectedIds,
  selectedItems = [],
  isAllSelected,
  isPartialSelected,
  onSelectAll,
  onClearSelection,
  actions,
  className,
}: BatchActionBarProps<T>) {
  const t = useTranslations("lists");

  // Don't render when nothing is selected
  if (selectedIds.size === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md border border-primary/20 bg-[var(--primary-muted)]",
        className,
      )}
    >
      {/* Select-all checkbox — toggles between select all and clear */}
      <button
        type="button"
        onClick={isAllSelected ? onClearSelection : onSelectAll}
        className="text-primary cursor-pointer"
        aria-label={t("selectAll")}
        aria-checked={ariaChecked(isAllSelected, isPartialSelected)}
      >
        <SelectionIcon isAllSelected={isAllSelected} isPartialSelected={isPartialSelected} />
      </button>

      {/* Selection count */}
      <span className="text-xs font-medium text-foreground">
        {t("selected", { count: selectedIds.size })}
      </span>

      {/* Action buttons slot */}
      {actions && (
        <div className="flex items-center gap-2">{actions({ selectedIds, selectedItems })}</div>
      )}

      {/* Clear button */}
      <button
        type="button"
        onClick={onClearSelection}
        className="p-0.5 rounded hover:bg-muted text-muted-foreground cursor-pointer ml-auto"
        aria-label={t("clearSelection")}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ariaChecked(allSelected: boolean, partialSelected: boolean): "true" | "mixed" | "false" {
  if (allSelected) return "true";
  if (partialSelected) return "mixed";
  return "false";
}

function SelectionIcon({
  isAllSelected,
  isPartialSelected,
}: {
  isAllSelected: boolean;
  isPartialSelected: boolean;
}) {
  if (isAllSelected) return <SquareCheck size={16} />;
  if (isPartialSelected) return <Minus size={16} className="text-primary" />;
  return <Square size={16} />;
}
