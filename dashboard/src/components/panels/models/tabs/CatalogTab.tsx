"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { useModelsStore } from "@/stores/models";
import { ModelDetail } from "../catalog/ModelDetail";
import { ProviderList } from "../catalog/ProviderList";
import { ProviderOverview } from "../catalog/ProviderOverview";

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
    models,
    authOverview,
    loading,
    fetchModels,
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

  useEffect(() => {
    void fetchModels();
    void fetchAuthOverview();
  }, [fetchModels, fetchAuthOverview]);

  const selectedProvider = selected?.provider ?? null;
  const selectedModel = selected?.type === "model" ? (selected.model ?? null) : null;

  // Group models by provider for the overview pane
  const providerModels = useMemo(() => {
    if (!selectedProvider) {
      return [];
    }
    return models.filter((m) => m.provider === selectedProvider);
  }, [models, selectedProvider]);

  // Find the specific selected model object
  const selectedModelObj = useMemo(() => {
    if (!selectedModel) {
      return null;
    }
    return models.find((m) => m.id === selectedModel) ?? null;
  }, [models, selectedModel]);

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
    (_provider: string, modelId: string) => {
      const { fallbacks } = useModelsStore.getState();
      void updateFallbacks(modelId, fallbacks);
    },
    [updateFallbacks],
  );

  const handleAddToFallback = useCallback(
    (_provider: string, modelId: string) => {
      const { primaryModel, fallbacks } = useModelsStore.getState();
      if (!primaryModel) {
        // No primary set — set this as primary instead
        void updateFallbacks(modelId, fallbacks);
      } else if (!fallbacks.includes(modelId)) {
        void updateFallbacks(primaryModel, [...fallbacks, modelId]);
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

      <div className="flex min-h-0 flex-1">
        {/* Left pane: provider/model tree */}
        <ProviderList
          models={models}
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
