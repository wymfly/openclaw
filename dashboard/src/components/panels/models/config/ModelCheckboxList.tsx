"use client";

import { useTranslations } from "next-intl";
import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CatalogProviderModel } from "@/stores/models";

interface ModelCheckboxListProps {
  models: CatalogProviderModel[];
  selected: Set<string>;
  onToggle: (modelId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function ModelCheckboxList({
  models,
  selected,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: ModelCheckboxListProps) {
  const t = useTranslations("models.wizard");

  const allSelected = models.length > 0 && selected.size === models.length;

  return (
    <div className="space-y-2">
      {/* Select all / deselect all toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {selected.size} / {models.length}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="h-6 text-[10px] cursor-pointer"
        >
          {allSelected ? t("deselectAll") : t("selectAll")}
        </Button>
      </div>

      {/* Scrollable model list */}
      <div className="max-h-[280px] overflow-y-auto space-y-1 rounded-lg border border-[var(--border)] p-2">
        {models.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            {t("noModelsInCatalog")}
          </p>
        ) : (
          models.map((model) => (
            <label
              key={model.id}
              className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.has(model.id)}
                onChange={() => onToggle(model.id)}
                className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
              />
              <span className="flex-1 text-xs font-mono truncate">{model.name}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                {(model.contextWindow / 1000).toFixed(0)}K
              </span>
              {model.reasoning && (
                <Brain size={12} className="text-[var(--purple)] shrink-0" />
              )}
            </label>
          ))
        )}
      </div>
    </div>
  );
}
