"use client";

import { Layers, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { AllowlistEntry, AuthOverviewEntry, Model } from "@/stores/models";
import { AuthStatusDot } from "../shared/AuthStatusDot";
import { ModelBadges } from "../shared/ModelBadges";
import { ModelParamsEditor } from "./ModelParamsEditor";
import { formatContextWindow } from "./ProviderList";

interface ModelDetailProps {
  model: Model;
  auth: AuthOverviewEntry | undefined;
  onSetDefault: (provider: string, modelId: string) => void;
  onAddToFallback: (provider: string, modelId: string) => void;
  allowlistActive?: boolean;
  isEnabled?: boolean;
  onToggleEnabled?: (provider: string, modelId: string, enabled: boolean) => void;
  allowlistEntry?: AllowlistEntry;
  providerApi?: string;
  onUpdateEntry?: (ref: string, entry: Partial<AllowlistEntry>) => void;
}

/** Format price per million tokens with /M suffix. */
function fmtPrice(price: number | undefined | null, freeLabel: string): string {
  if (typeof price !== "number" || !Number.isFinite(price)) {
    return "\u2014";
  }
  if (price === 0) {
    return freeLabel;
  }
  return `$${price.toFixed(2)}/M`;
}

/**
 * Right-pane model detail view.
 * Shows model identity, capabilities, pricing grid, and quick actions.
 */
export function ModelDetail({
  model,
  auth,
  onSetDefault,
  onAddToFallback,
  allowlistActive,
  isEnabled,
  onToggleEnabled,
  allowlistEntry,
  providerApi,
  onUpdateEntry,
}: ModelDetailProps) {
  const t = useTranslations("models");

  const authStatus = auth?.status ?? "unknown";

  const priceItems = [
    { label: t("catalog.inputPrice"), value: fmtPrice(model.inputPrice, t("catalog.free")) },
    { label: t("catalog.outputPrice"), value: fmtPrice(model.outputPrice, t("catalog.free")) },
    { label: t("catalog.cacheRead"), value: fmtPrice(model.cacheReadPrice, t("catalog.free")) },
    { label: t("catalog.cacheWrite"), value: fmtPrice(model.cacheWritePrice, t("catalog.free")) },
  ];

  return (
    <div className="transition-panel space-y-6 p-6">
      {/* Header: Model name + provider */}
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">{model.name}</h2>
          {model.isDefault && (
            <Star
              size={14}
              className="shrink-0 fill-[var(--primary)] text-[var(--primary)]"
              aria-label={t("default")}
            />
          )}
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
          <div className="flex items-center gap-1.5">
            <AuthStatusDot status={authStatus} size="sm" />
            <span>{model.provider}</span>
          </div>
          <span className="font-mono text-[10px] text-[var(--muted-foreground)]">{model.id}</span>
        </div>
        {allowlistActive && onToggleEnabled && (
          <div className="mt-2 flex items-center gap-2">
            <Switch
              checked={isEnabled ?? false}
              onCheckedChange={(checked) => onToggleEnabled(model.provider, model.id, checked)}
            />
            <span className="text-xs text-[var(--muted-foreground)]">
              {isEnabled ? t("catalog.enabled") : t("catalog.disabled")}
            </span>
          </div>
        )}
      </div>

      {/* Capability badges */}
      <ModelBadges reasoning={model.reasoning} input={model.input} />

      {/* Pricing grid */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {priceItems.map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                {item.label}
              </div>
              <div className="font-mono text-sm font-semibold text-[var(--foreground)]">
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Context window + max output */}
      <div className="flex gap-6">
        <div className="space-y-1">
          <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
            {t("catalog.contextWindow")}
          </div>
          <div className="font-mono text-sm font-semibold text-[var(--foreground)]">
            {formatContextWindow(model.contextWindow)}
          </div>
        </div>
        {model.maxTokens != null && (
          <div className="space-y-1">
            <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
              {t("catalog.maxOutput")}
            </div>
            <div className="font-mono text-sm font-semibold text-[var(--foreground)]">
              {formatContextWindow(model.maxTokens)}
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 border-t border-[var(--border)] pt-4">
        {!model.isDefault && (
          <Button variant="ghost" size="sm" onClick={() => onSetDefault(model.provider, model.id)}>
            <Star size={14} className="mr-1.5" />
            {t("catalog.setDefault")}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => onAddToFallback(model.provider, model.id)}>
          <Layers size={14} className="mr-1.5" />
          {t("catalog.addToFallback")}
        </Button>
      </div>

      {/* Per-model parameters (when allowlist is active and model is enabled) */}
      {allowlistActive && isEnabled && allowlistEntry && onUpdateEntry && (
        <ModelParamsEditor
          modelRef={`${model.provider}/${model.id}`}
          entry={allowlistEntry}
          providerApi={providerApi}
          onUpdate={onUpdateEntry}
        />
      )}
    </div>
  );
}
