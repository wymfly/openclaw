"use client";

import { AlertTriangle, Crown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AuthOverviewEntry, Model } from "@/stores/models";
import { formatContextWindow } from "../catalog/ProviderList";
import { AuthStatusDot } from "../shared/AuthStatusDot";
import { ModelBadges } from "../shared/ModelBadges";

interface PrimaryModelCardProps {
  /** Current primary model ref, e.g. "moonshot/kimi-k2.5" */
  modelRef: string | null;
  model: Model | undefined;
  auth: AuthOverviewEntry | undefined;
  models: Model[];
  onChangePrimary: (newRef: string) => void;
}

/** Group models by provider for the Select dropdown. */
function groupByProvider(models: Model[]): Map<string, Model[]> {
  const map = new Map<string, Model[]>();
  for (const m of models) {
    const key = m.provider || "unknown";
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(m);
  }
  return map;
}

/**
 * Non-draggable primary model card for the fallback chain.
 * Shows model details + a [Change] select to swap the primary model.
 */
export function PrimaryModelCard({
  modelRef,
  model,
  auth,
  models,
  onChangePrimary,
}: PrimaryModelCardProps) {
  const t = useTranslations("models");

  const grouped = useMemo(() => groupByProvider(models), [models]);
  const isMissingAuth = auth?.status === "missing";
  const provider = model?.provider ?? modelRef?.split("/")[0];
  const displayName = model?.name ?? modelRef ?? "\u2014";

  const priceLabel =
    model && typeof model.inputPrice === "number" && typeof model.outputPrice === "number"
      ? `$${model.inputPrice.toFixed(2)}/M in \u00B7 $${model.outputPrice.toFixed(2)}/M out`
      : null;

  return (
    <div
      className={cn(
        "relative rounded-lg border bg-card p-3 transition-all duration-200",
        "border-accent/30 shadow-[0_0_0_1px_var(--primary-muted)]",
        isMissingAuth && "border-dashed border-red-500/50 shadow-none",
      )}
    >
      {/* Header: "Primary Model" label + Change control */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-accent">
          <Crown size={12} className="shrink-0" />
          {t("fallbacks.primary")}
        </div>

        <Select
          value={modelRef ?? ""}
          onValueChange={(val) => {
            if (val) {
              onChangePrimary(val);
            }
          }}
        >
          <SelectTrigger size="sm" className="h-6 gap-1 border-accent/20 px-2 text-xs text-accent">
            <SelectValue>{t("fallbacks.changePrimary")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {[...grouped.entries()].map(([prov, provModels]) => (
              <SelectGroup key={prov}>
                <SelectLabel className="uppercase tracking-wider">{prov}</SelectLabel>
                {provModels.map((m) => {
                  const ref = `${m.provider}/${m.id}`;
                  return (
                    <SelectItem key={ref} value={ref}>
                      {m.name}
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Model info */}
      <div className="flex items-center gap-2">
        <AuthStatusDot status={auth?.status ?? "unknown"} size="md" />
        <span className="truncate text-sm font-medium text-foreground">
          {provider ? `${provider}/` : ""}
          {displayName}
        </span>
        {model && <ModelBadges reasoning={model.reasoning} input={model.input} />}
      </div>

      <div className="mt-1 flex items-center gap-2 pl-5 text-xs text-muted-foreground">
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
        <div className="mt-2 flex items-center gap-1.5 pl-5 text-xs text-red-400">
          <AlertTriangle size={12} className="shrink-0" />
          <span>{t("fallbacks.authWarning")}</span>
        </div>
      )}
    </div>
  );
}
