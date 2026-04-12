"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { useModelsStore } from "@/stores/models";
import { ModelDetail } from "../catalog/ModelDetail";
import { ProviderList } from "../catalog/ProviderList";
import { ProviderOverview } from "../catalog/ProviderOverview";

type CapabilityFilter = "reasoning" | "vision" | "text";

interface Selection {
  type: "provider" | "model";
  provider: string;
  model?: string;
}

interface CatalogTabProps {
  /** Navigate to Provider Config tab with a pre-selected provider. */
  onGoConfig?: (provider: string) => void;
  /** Navigate to Fallbacks tab. */
  onGoFallbacks?: () => void;
}

/**
 * Catalog tab — split-pane layout with provider/model tree on the left,
 * and either a provider overview or model detail on the right.
 */
export function CatalogTab({ onGoConfig, onGoFallbacks }: CatalogTabProps = {}) {
  const t = useTranslations("models");
  const {
    usableModels: models,
    authOverview,
    usableLoading: loading,
    fetchUsableModels,
    fetchAuthOverview,
    updateFallbacks,
    fetchFallbacks,
    allowlistActive,
    allowlist,
    toggleAllowlist,
    toggleModelEnabled,
    updateModelAllowlistEntry,
    providerApiMap,
  } = useModelsStore();
  const [selected, setSelected] = useState<Selection | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<CapabilityFilter>>(new Set());

  useEffect(() => {
    void fetchUsableModels();
    void fetchAuthOverview();
  }, [fetchUsableModels, fetchAuthOverview]);

  const selectedProvider = selected?.provider ?? null;
  const selectedModel = selected?.type === "model" ? (selected.model ?? null) : null;

  // Derive filtered models list from active capability filters (AND logic)
  const filteredModels = useMemo(() => {
    if (activeFilters.size === 0) return models;
    return models.filter((m) => {
      if (activeFilters.has("reasoning") && !m.reasoning) return false;
      if (activeFilters.has("vision") && !m.input?.includes("image")) return false;
      if (activeFilters.has("text") && m.input && !m.input.includes("text")) return false;
      return true;
    });
  }, [models, activeFilters]);

  const toggleFilter = useCallback((cap: CapabilityFilter) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(cap)) {
        next.delete(cap);
      } else {
        next.add(cap);
      }
      return next;
    });
  }, []);

  // Group models by provider for the overview pane
  const providerModels = useMemo(() => {
    if (!selectedProvider) {
      return [];
    }
    return filteredModels.filter((m) => m.provider === selectedProvider);
  }, [filteredModels, selectedProvider]);

  // Find the specific selected model object
  const selectedModelObj = useMemo(() => {
    if (!selectedModel) {
      return null;
    }
    return models.find((m) => m.id === selectedModel) ?? null;
  }, [models, selectedModel]);

  const CAPABILITY_CHIPS: { key: CapabilityFilter; label: string }[] = [
    { key: "reasoning", label: t("filter.reasoning") },
    { key: "vision", label: t("filter.vision") },
    { key: "text", label: t("filter.text") },
  ];

  // Find auth entry for the selected provider
  const selectedAuth = useMemo(() => {
    if (!selectedProvider) {
      return undefined;
    }
    return authOverview.find((a) => a.provider === selectedProvider);
  }, [authOverview, selectedProvider]);

  const handleSelectProvider = (provider: string) => {
    setSelected({ type: "provider", provider });
  };

  const handleSelectModel = (provider: string, modelId: string) => {
    setSelected({ type: "model", provider, model: modelId });
  };

  // Ensure fallback config is loaded for Set Default / Add to Fallback actions
  useEffect(() => {
    void fetchFallbacks();
  }, [fetchFallbacks]);

  const handleSetDefault = useCallback(
    (provider: string, modelId: string) => {
      const { fallbacks } = useModelsStore.getState();
      void updateFallbacks(`${provider}/${modelId}`, fallbacks);
    },
    [updateFallbacks],
  );

  const handleAddToFallback = useCallback(
    (provider: string, modelId: string) => {
      const { primaryModel, fallbacks } = useModelsStore.getState();
      const ref = `${provider}/${modelId}`;
      if (!primaryModel) {
        // No primary set — set this as primary instead
        void updateFallbacks(ref, fallbacks);
      } else if (!fallbacks.includes(ref)) {
        void updateFallbacks(primaryModel, [...fallbacks, ref]);
      }
      onGoFallbacks?.();
    },
    [updateFallbacks, onGoFallbacks],
  );

  const handleGoConfig = useCallback(() => {
    if (selectedProvider) {
      onGoConfig?.(selectedProvider);
    }
  }, [selectedProvider, onGoConfig]);

  const handleToggleEnabled = useCallback(
    (provider: string, modelId: string, enabled: boolean) => {
      void toggleModelEnabled(`${provider}/${modelId}`, enabled);
    },
    [toggleModelEnabled],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          {t("catalog.runtimeInventoryTitle")}
        </h2>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          {t("catalog.runtimeInventoryHint")}
        </p>
      </div>

      {/* Allowlist toggle bar */}
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-2">
        <Switch
          checked={allowlistActive}
          onCheckedChange={(checked) => {
            if (checked) {
              if (window.confirm(t("catalog.allowlistConfirm"))) {
                void toggleAllowlist(true);
              }
            } else {
              void toggleAllowlist(false);
            }
          }}
        />
        <span className="text-xs font-medium">{t("catalog.allowlistToggle")}</span>
        {!allowlistActive && (
          <span className="text-[10px] text-[var(--muted-foreground)]">
            {t("catalog.allowlistOff")}
          </span>
        )}
      </div>

      {/* Capability filter bar — only shown when there are models to filter */}
      {models.length > 0 && (
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2">
          {CAPABILITY_CHIPS.map(({ key, label }) => {
            const active = activeFilters.has(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleFilter(key)}
                className={[
                  "rounded-full px-3 py-0.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Left pane: provider/model tree */}
        <ProviderList
          models={filteredModels}
          auth={authOverview}
          loading={loading}
          selectedProvider={selectedProvider}
          selectedModel={selectedModel}
          onSelectProvider={handleSelectProvider}
          onSelectModel={handleSelectModel}
          allowlist={allowlist}
          allowlistActive={allowlistActive}
        />

        {/* Right pane: detail view */}
        <div className="flex-1 overflow-auto border-l border-[var(--border)]">
          {selected?.type === "provider" && (
            <ProviderOverview
              provider={selected.provider}
              models={providerModels}
              auth={selectedAuth}
              onSetDefault={handleSetDefault}
              onGoConfig={handleGoConfig}
              allowlistActive={allowlistActive}
              allowlist={allowlist}
              onToggleEnabled={handleToggleEnabled}
            />
          )}

          {selected?.type === "model" && selectedModelObj && (
            <ModelDetail
              model={selectedModelObj}
              auth={selectedAuth}
              onSetDefault={handleSetDefault}
              onAddToFallback={handleAddToFallback}
              allowlistActive={allowlistActive}
              isEnabled={allowlist[`${selectedModelObj.provider}/${selectedModelObj.id}`] != null}
              onToggleEnabled={handleToggleEnabled}
              allowlistEntry={allowlist[`${selectedModelObj.provider}/${selectedModelObj.id}`]}
              providerApi={providerApiMap[selectedModelObj.provider]}
              onUpdateEntry={updateModelAllowlistEntry}
            />
          )}

          {/* Empty state */}
          {!selected && (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-[var(--muted-foreground)]">{t("catalog.selectModel")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
