"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, GripVertical, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { AuthOverviewEntry, Model } from "@/stores/models";
import { formatContextWindow } from "../catalog/ProviderList";
import { AuthStatusDot } from "../shared/AuthStatusDot";
import { ModelBadges } from "../shared/ModelBadges";

interface ModelCardProps {
  /** Sortable ID = "provider/modelId" */
  id: string;
  model: Model | undefined;
  auth: AuthOverviewEntry | undefined;
  onRemove: () => void;
}

/**
 * Draggable model card for the fallback chain.
 * Uses @dnd-kit/sortable for drag-and-drop reordering.
 */
export function ModelCard({ id, model, auth, onRemove }: ModelCardProps) {
  const t = useTranslations("models");
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isMissingAuth = auth?.status === "missing";
  const provider = model?.provider ?? id.split("/")[0];
  const displayName = model?.name ?? id;

  // Format price: "$X/M in" style
  const priceLabel =
    model && typeof model.inputPrice === "number" && typeof model.outputPrice === "number"
      ? `$${model.inputPrice.toFixed(2)}/M in \u00B7 $${model.outputPrice.toFixed(2)}/M out`
      : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg border bg-card p-3 transition-all duration-200",
        isDragging && "z-50 opacity-50 shadow-lg shadow-accent/10",
        isMissingAuth && "border-dashed border-red-500/50",
        !isMissingAuth && !isDragging && "border-border hover:border-accent/30",
      )}
      {...attributes}
    >
      {/* Drag handle */}
      <button
        ref={setActivatorNodeRef}
        type="button"
        className={cn(
          "flex shrink-0 cursor-grab touch-none items-center text-muted-foreground/50 transition-colors hover:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:rounded-sm",
          isDragging && "cursor-grabbing",
        )}
        aria-label="Drag to reorder"
        {...listeners}
      >
        <GripVertical size={16} />
      </button>

      {/* Auth status dot */}
      <AuthStatusDot status={auth?.status ?? "unknown"} size="sm" />

      {/* Model info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {provider}/{displayName}
          </span>
          {model && <ModelBadges reasoning={model.reasoning} input={model.input} />}
        </div>

        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          {model?.contextWindow && (
            <span className="font-mono">{formatContextWindow(model.contextWindow)}</span>
          )}
          {priceLabel && (
            <>
              <span className="text-border">&middot;</span>
              <span className="font-mono">{priceLabel}</span>
            </>
          )}
        </div>

        {/* Auth warning */}
        {isMissingAuth && (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-red-400">
            <AlertTriangle size={12} className="shrink-0" />
            <span>{t("fallbacks.authWarning")}</span>
            <button
              type="button"
              className="ml-1 cursor-pointer text-accent underline underline-offset-2 transition-colors hover:text-accent-foreground"
            >
              {t("fallbacks.goConfig")} &rarr;
            </button>
          </div>
        )}
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        className={cn(
          "flex shrink-0 cursor-pointer items-center rounded-md p-1 text-muted-foreground/40 transition-colors",
          "hover:bg-destructive/10 hover:text-destructive",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50",
        )}
        aria-label="Remove from fallback chain"
      >
        <X size={14} />
      </button>
    </div>
  );
}
