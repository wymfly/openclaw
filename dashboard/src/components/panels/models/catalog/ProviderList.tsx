"use client";

import { ChevronRight, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { AuthOverviewEntry, Model } from "@/stores/models";
import { AuthStatusDot } from "../shared/AuthStatusDot";

interface ProviderListProps {
  models: Model[];
  auth: AuthOverviewEntry[];
  loading: boolean;
  selectedProvider: string | null;
  selectedModel: string | null;
  onSelectProvider: (provider: string) => void;
  onSelectModel: (provider: string, modelId: string) => void;
  allowlist?: Record<string, unknown>;
  allowlistActive?: boolean;
}

/** Format context window size to human-readable (e.g. 128K, 1M). */
export function formatContextWindow(tokens: number | undefined | null): string {
  if (typeof tokens !== "number" || !Number.isFinite(tokens)) {
    return "\u2014";
  }
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(0)}K`;
  }
  return String(tokens);
}

/** Group models by provider name. */
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
 * Left-pane collapsible provider/model tree for the Catalog tab.
 * Each provider expands to show its models with context-window badges.
 */
export function ProviderList({
  models,
  auth,
  loading,
  selectedProvider,
  selectedModel,
  onSelectProvider,
  onSelectModel,
  allowlist,
  allowlistActive,
}: ProviderListProps) {
  const t = useTranslations("models");

  // Track which providers are expanded; default all open
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const set = new Set<string>();
    for (const m of models) {
      set.add(m.provider || "unknown");
    }
    return set;
  });

  const grouped = groupByProvider(models);

  const toggleExpanded = (provider: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  };

  const getAuthStatus = (provider: string) => {
    const entry = auth.find((a) => a.provider === provider);
    return entry?.status ?? "unknown";
  };

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)]">
      <ScrollArea className="flex-1">
        <div className="py-2">
          {/* Loading skeleton */}
          {loading && models.length === 0 && (
            <div className="space-y-1 px-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg px-3 py-2.5">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--border)]" />
                  <div className="h-3 flex-1 animate-pulse rounded bg-[var(--border)]" />
                  <div className="h-3 w-6 animate-pulse rounded bg-[var(--border)]" />
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && models.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("catalog.noConfiguredModels")}
              </p>
              <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">
                {t("catalog.noConfiguredModelsHint")}
              </p>
            </div>
          )}

          {/* Provider groups */}
          {[...grouped.entries()].map(([provider, providerModels]) => {
            const isProviderSelected = selectedProvider === provider && !selectedModel;
            const isOpen = expanded.has(provider);

            return (
              <Collapsible
                key={provider}
                open={isOpen}
                onOpenChange={() => toggleExpanded(provider)}
              >
                {/* Provider trigger row */}
                <CollapsibleTrigger
                  className={cn(
                    "group relative flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium tracking-wide transition-colors duration-150",
                    "hover:bg-[var(--muted)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50",
                    isProviderSelected && "bg-[var(--primary-muted)] text-[var(--primary)]",
                    !isProviderSelected && "text-[var(--foreground)]",
                  )}
                  onClick={(e) => {
                    // Also select the provider on click
                    e.stopPropagation();
                    onSelectProvider(provider);
                    // Ensure expansion
                    if (!expanded.has(provider)) {
                      setExpanded((prev) => new Set(prev).add(provider));
                    }
                  }}
                >
                  {/* Active glow indicator */}
                  {isProviderSelected && (
                    <span
                      className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--primary)] shadow-[0_0_8px_var(--primary)]"
                      aria-hidden
                    />
                  )}

                  <ChevronRight
                    size={12}
                    className={cn(
                      "shrink-0 text-[var(--muted-foreground)] transition-transform duration-200",
                      isOpen && "rotate-90",
                    )}
                  />

                  <AuthStatusDot status={getAuthStatus(provider)} size="sm" />

                  <span className="truncate uppercase tracking-[0.05em]">{provider}</span>

                  <span className="ml-auto shrink-0 rounded-full bg-[var(--muted)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted-foreground)]">
                    {allowlistActive
                      ? t("catalog.enabledCount", {
                          count: providerModels.filter(
                            (m) => allowlist?.[`${provider}/${m.id}`] != null,
                          ).length,
                          total: providerModels.length,
                        })
                      : providerModels.length}
                  </span>
                </CollapsibleTrigger>

                {/* Model list */}
                <CollapsibleContent>
                  <div className="space-y-0.5 pb-1 pl-4 pr-2">
                    {providerModels.map((model) => {
                      const isSelected = selectedModel === model.id;

                      return (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => onSelectModel(provider, model.id)}
                          className={cn(
                            "relative flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs transition-all duration-150",
                            "hover:bg-[var(--muted)]",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50",
                            isSelected && [
                              "bg-[var(--primary-muted)]",
                              "border-l-2 border-[var(--primary)]",
                              "shadow-[inset_0_0_0_1px_var(--primary),var(--primary-glow)]",
                            ],
                            !isSelected && "border-l-2 border-transparent",
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "truncate font-medium",
                                  isSelected ? "text-[var(--primary)]" : "text-[var(--foreground)]",
                                )}
                              >
                                {model.name}
                              </span>
                              {model.isDefault && (
                                <Star
                                  size={10}
                                  className="shrink-0 fill-[var(--primary)] text-[var(--primary)]"
                                  aria-label={t("default")}
                                />
                              )}
                            </div>
                          </div>

                          {/* Context window badge */}
                          <span className="shrink-0 rounded bg-[var(--muted)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted-foreground)]">
                            {formatContextWindow(model.contextWindow)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}
