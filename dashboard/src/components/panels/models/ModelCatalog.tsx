"use client";

import { Cpu, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useModelsStore, type Model } from "@/stores/models";

/** Format context window size to human-readable (e.g. 128K, 1M). */
function fmtCtx(tokens: number | undefined | null): string {
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

/** Format price per million tokens. */
function fmtPrice(price: number | undefined | null): string {
  if (typeof price !== "number" || !Number.isFinite(price)) {
    return "\u2014";
  }
  if (price === 0) {
    return "Free";
  }
  return `$${price.toFixed(2)}`;
}

export function ModelCatalog() {
  const t = useTranslations("models");
  const tc = useTranslations("common");
  const { models, loading, selectedProvider, selectProvider } = useModelsStore();

  const grouped = useMemo(() => {
    const map = new Map<string, Model[]>();
    for (const m of models) {
      const key = m.provider || "unknown";
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(m);
    }
    return map;
  }, [models]);

  return (
    <aside className="flex flex-col w-72 shrink-0 border-r border-[var(--border)] h-full bg-[var(--bg-secondary)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] shrink-0">
        <Cpu size={14} className="text-[var(--accent)]" />
        <span className="text-xs font-semibold text-[var(--text-primary)] tracking-tight">
          {t("catalog")}
        </span>
        {models.length > 0 && (
          <span className="ml-auto text-[10px] font-mono text-[var(--text-secondary)]">
            {models.length}
          </span>
        )}
      </div>

      {/* Scrollable catalog */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {loading && models.length === 0 && (
            <div className="px-4 py-4 text-xs text-[var(--text-secondary)]">{tc("loading")}</div>
          )}

          {!loading && models.length === 0 && (
            <div className="px-4 py-4 text-xs text-[var(--text-secondary)]">{t("noModels")}</div>
          )}

          {[...grouped.entries()].map(([provider, providerModels], groupIndex) => (
            <div key={provider}>
              {groupIndex > 0 && <Separator className="mx-3 my-1 bg-[var(--border-subtle)]" />}

              {/* Provider group header */}
              <button
                onClick={() => selectProvider(provider)}
                className={cn(
                  "relative flex items-center gap-2 w-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] cursor-pointer transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
                  selectedProvider === provider
                    ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
                )}
              >
                {/* Active indicator */}
                {selectedProvider === provider && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"
                    aria-hidden
                  />
                )}
                <Cpu size={12} className="shrink-0" />
                {provider}
                <span className="ml-auto font-mono font-normal text-[10px]">
                  {providerModels.length}
                </span>
              </button>

              {/* Models in provider */}
              <div className="px-2 space-y-0.5">
                {providerModels.map((model) => (
                  <div
                    key={model.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors duration-150 hover:bg-[var(--bg-tertiary)]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium text-[var(--text-primary)]">
                          {model.name}
                        </span>
                        {model.isDefault && (
                          <Star
                            size={10}
                            className="shrink-0 text-[var(--accent)] fill-[var(--accent)]"
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 mt-0.5">
                        <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                          {fmtCtx(model.contextWindow)}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                          {t("inputPrice")}: {fmtPrice(model.inputPrice)}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                          {t("outputPrice")}: {fmtPrice(model.outputPrice)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
