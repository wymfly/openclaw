"use client";

import { Check, Loader2, RefreshCw, Search, Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AuthOverviewEntry, CatalogProvider } from "@/stores/models";

interface WizardStepSelectProps {
  catalogProviders: CatalogProvider[];
  catalogLoading: boolean;
  catalogError: boolean;
  configuredProviders: Set<string>;
  authOverview: AuthOverviewEntry[];
  onSelectKnown: (provider: CatalogProvider) => void;
  onSelectCustom: () => void;
  onRetryLoad: () => void;
}

export function WizardStepSelect({
  catalogProviders,
  catalogLoading,
  catalogError,
  configuredProviders,
  authOverview,
  onSelectKnown,
  onSelectCustom,
  onRetryLoad,
}: WizardStepSelectProps) {
  const t = useTranslations("models.wizard");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return catalogProviders;
    const q = search.toLowerCase();
    return catalogProviders.filter(
      (p) => p.displayName.toLowerCase().includes(q) || p.id.toLowerCase().includes(q),
    );
  }, [catalogProviders, search]);

  const oauthEntries = useMemo(
    () => authOverview.filter((a) => a.auth?.type === "oauth" || a.auth?.type === "token"),
    [authOverview],
  );

  return (
    <div className="space-y-4">
      {/* Known Providers */}
      <div>
        <h4 className="text-sm font-medium">{t("knownProviders")}</h4>
        <p className="text-xs text-muted-foreground mt-0.5">{t("knownProvidersHint")}</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchProviders")}
          className="w-full pl-8 pr-3 py-2 text-xs rounded-md border border-[var(--border)] bg-background focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        />
      </div>

      {/* Loading state */}
      {catalogLoading && (
        <div className="flex items-center justify-center gap-2 py-6">
          <Loader2 size={14} className="animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{t("loadingProviders")}</span>
        </div>
      )}

      {/* Error state */}
      {catalogError && !catalogLoading && (
        <div className="flex flex-col items-center gap-2 py-6">
          <span className="text-xs text-destructive">{t("catalogLoadError")}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetryLoad}
            className="cursor-pointer"
          >
            <RefreshCw size={12} className="mr-1" />
            {t("retry")}
          </Button>
        </div>
      )}

      {/* Provider grid */}
      {!catalogLoading && !catalogError && (
        <div className="grid grid-cols-2 gap-2">
          {filtered.map((provider) => {
            const isConfigured = configuredProviders.has(provider.id);
            return (
              <button
                key={provider.id}
                type="button"
                disabled={isConfigured}
                onClick={() => onSelectKnown(provider)}
                className={`flex flex-col gap-1 p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                  isConfigured
                    ? "bg-muted opacity-60 border-[var(--border)] pointer-events-none"
                    : "border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-accent"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{provider.displayName}</span>
                  {isConfigured && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Check size={10} />
                      {t("configured")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">
                    {t("models", { count: provider.modelCount })}
                  </span>
                  <span className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground">
                    {provider.authType}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-[var(--border-subtle)]" />

      {/* Custom Provider */}
      <button
        type="button"
        onClick={onSelectCustom}
        className="w-full flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-accent text-left transition-colors cursor-pointer"
      >
        <Settings size={16} className="text-muted-foreground shrink-0" />
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium">{t("customProvider")}</span>
          <span className="text-[10px] text-muted-foreground">{t("customProviderHint")}</span>
        </div>
      </button>

      {/* OAuth / Plugin section */}
      {oauthEntries.length > 0 && (
        <>
          <div className="border-t border-[var(--border-subtle)]" />
          <div>
            <h4 className="text-sm font-medium mb-2">{t("oauthProviders")}</h4>
            <div className="space-y-1.5">
              {oauthEntries.map((entry) => (
                <div
                  key={entry.provider}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-[var(--border)] text-xs"
                >
                  <span className="font-medium">{entry.provider}</span>
                  {entry.status === "ready" ? (
                    <span className="text-[10px] text-[var(--success)] flex items-center gap-0.5">
                      <Check size={10} />
                      {t("authorized")}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">
                      {t("oauthCliHint", { provider: entry.provider })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
