import type { ReactNode } from "react";
import { CheckSquareIcon, MinusIcon, SquareIcon, XIcon } from "../../../deck-ui/icons";
import { useTranslations } from "../../../i18n/provider";

type BatchActionBarProps<T = unknown> = {
  actions?: (props: { selectedIds: Set<string>; selectedItems: T[] }) => ReactNode;
  className?: string;
  isAllSelected: boolean;
  isPartialSelected: boolean;
  onClearSelection: () => void;
  onSelectAll: () => void;
  selectedIds: Set<string>;
  selectedItems?: T[];
};

function ariaChecked(isAllSelected: boolean, isPartialSelected: boolean) {
  if (isAllSelected) {
    return "true";
  }
  if (isPartialSelected) {
    return "mixed";
  }
  return "false";
}

export function BatchActionBar<T = unknown>(props: BatchActionBarProps<T>) {
  const t = useTranslations("lists");
  const {
    actions,
    className,
    isAllSelected,
    isPartialSelected,
    onClearSelection,
    onSelectAll,
    selectedIds,
    selectedItems = [],
  } = props;

  if (selectedIds.size === 0) {
    return null;
  }

  return (
    <div className={`deckgo-batch-action-bar ${className ?? ""}`.trim()}>
      <button
        aria-checked={ariaChecked(isAllSelected, isPartialSelected)}
        aria-label={t("selectAll")}
        className="deckgo-icon-button"
        onClick={isAllSelected ? onClearSelection : onSelectAll}
        role="checkbox"
        type="button"
      >
        {isAllSelected ? <CheckSquareIcon /> : isPartialSelected ? <MinusIcon /> : <SquareIcon />}
      </button>
      <span className="deckgo-batch-action-count">
        {t("selected", { count: selectedIds.size })}
      </span>
      {actions ? (
        <div className="deckgo-batch-action-slot">{actions({ selectedIds, selectedItems })}</div>
      ) : null}
      <button
        aria-label={t("clearSelection")}
        className="deckgo-icon-button deckgo-batch-action-clear"
        onClick={onClearSelection}
        type="button"
      >
        <XIcon />
      </button>
    </div>
  );
}
