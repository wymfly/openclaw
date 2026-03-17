"use client";

import { Cpu, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
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

/** Format price per million tokens. Returns "—" for missing/undefined values. */
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

  // Group models by provider.
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
    <aside
      className="flex flex-col w-80 shrink-0 border-r h-full"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 border-b text-xs font-medium"
        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
      >
        {t("catalog")}
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto">
        {loading && models.length === 0 && (
          <div className="p-3 text-xs" style={{ color: "var(--text-secondary)" }}>
            {tc("loading")}
          </div>
        )}

        {!loading && models.length === 0 && (
          <div className="p-3 text-xs" style={{ color: "var(--text-secondary)" }}>
            {t("noModels")}
          </div>
        )}

        {[...grouped.entries()].map(([provider, providerModels]) => (
          <div key={provider}>
            {/* Provider group header */}
            <button
              onClick={() => selectProvider(provider)}
              className="flex items-center gap-1.5 w-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide hover:opacity-80"
              style={{
                color: selectedProvider === provider ? "var(--accent)" : "var(--text-secondary)",
                backgroundColor:
                  selectedProvider === provider
                    ? "color-mix(in srgb, var(--accent) 8%, transparent)"
                    : "transparent",
              }}
            >
              <Cpu size={12} />
              {provider}
            </button>

            {/* Models in this provider */}
            {providerModels.map((model) => (
              <div
                key={model.id}
                className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-default"
                style={{ color: "var(--text-primary)" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="truncate font-medium">{model.name}</span>
                    {model.isDefault && (
                      <Star
                        size={10}
                        className="shrink-0"
                        style={{ color: "var(--accent)" }}
                        fill="var(--accent)"
                      />
                    )}
                  </div>
                  <div
                    className="flex items-center gap-2 text-[10px] mt-0.5"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <span>{fmtCtx(model.contextWindow)}</span>
                    <span>
                      {t("inputPrice")}: {fmtPrice(model.inputPrice)}
                    </span>
                    <span>
                      {t("outputPrice")}: {fmtPrice(model.outputPrice)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}
