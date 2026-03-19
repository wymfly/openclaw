"use client";

import { ArrowRight, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AuthOverviewEntry, Model } from "@/stores/models";
import { AuthStatusDot } from "../shared/AuthStatusDot";
import { formatContextWindow } from "./ProviderList";

interface ProviderOverviewProps {
  provider: string;
  models: Model[];
  auth: AuthOverviewEntry | undefined;
  onSetDefault: (provider: string, modelId: string) => void;
  onGoConfig: () => void;
}

/** Format price per million tokens in compact form. */
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
 * Right-pane provider overview — auth summary + model comparison table.
 * Shown when user selects a provider (not a specific model).
 */
export function ProviderOverview({
  provider,
  models,
  auth,
  onSetDefault,
  onGoConfig,
}: ProviderOverviewProps) {
  const t = useTranslations("models");

  const authSource = auth?.auth?.source;
  const authStatus = auth?.status ?? "unknown";

  return (
    <div className="transition-panel space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {t("catalog.providerModels", { provider })}
          </h2>
          {/* Auth summary line */}
          <div className="mt-1.5 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <AuthStatusDot status={authStatus} size="md" />
            <span>
              {authSource
                ? t("catalog.authSummary", { source: authSource })
                : t("catalog.authNone")}
            </span>
          </div>
        </div>

        <Button variant="ghost" size="sm" onClick={onGoConfig}>
          {t("catalog.goConfig")}
          <ArrowRight size={14} className="ml-1" />
        </Button>
      </div>

      {/* Model comparison table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--text-secondary)]">
              <th className="px-4 py-2.5 text-left font-medium">{t("catalog.modelName")}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t("catalog.contextWindow")}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t("catalog.inputPrice")}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t("catalog.outputPrice")}</th>
              <th className="px-4 py-2.5 text-center font-medium">{t("catalog.reasoning")}</th>
              <th className="px-4 py-2.5 text-center font-medium">{t("catalog.vision")}</th>
              <th className="px-4 py-2.5 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {models.map((model, i) => (
              <tr
                key={model.id}
                className={cn(
                  "border-b border-[var(--border-subtle)] transition-colors duration-100",
                  "hover:bg-[var(--bg-tertiary)]",
                  i === models.length - 1 && "border-b-0",
                )}
              >
                {/* Name */}
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-[var(--text-primary)]">{model.name}</span>
                    {model.isDefault && (
                      <Star
                        size={10}
                        className="shrink-0 fill-[var(--accent)] text-[var(--accent)]"
                      />
                    )}
                  </div>
                </td>

                {/* Context window */}
                <td className="px-4 py-2.5 text-right font-mono text-[var(--text-secondary)]">
                  {formatContextWindow(model.contextWindow)}
                </td>

                {/* Input price */}
                <td className="px-4 py-2.5 text-right font-mono text-[var(--text-secondary)]">
                  {fmtPrice(model.inputPrice, t("catalog.free"))}
                </td>

                {/* Output price */}
                <td className="px-4 py-2.5 text-right font-mono text-[var(--text-secondary)]">
                  {fmtPrice(model.outputPrice, t("catalog.free"))}
                </td>

                {/* Reasoning */}
                <td className="px-4 py-2.5 text-center">
                  {model.reasoning ? (
                    <span
                      className="text-[var(--status-connected)]"
                      aria-label={t("catalog.reasoning")}
                    >
                      &#10003;
                    </span>
                  ) : (
                    <span className="text-[var(--text-secondary)]">&mdash;</span>
                  )}
                </td>

                {/* Vision */}
                <td className="px-4 py-2.5 text-center">
                  {model.input?.includes("image") ? (
                    <span
                      className="text-[var(--status-connected)]"
                      aria-label={t("catalog.vision")}
                    >
                      &#10003;
                    </span>
                  ) : (
                    <span className="text-[var(--text-secondary)]">&mdash;</span>
                  )}
                </td>

                {/* Actions */}
                <td className="px-4 py-2.5 text-right">
                  {!model.isDefault && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => onSetDefault(provider, model.id)}
                      className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--accent)]"
                    >
                      {t("catalog.setDefault")}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
