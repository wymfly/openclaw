"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useModelsStore } from "@/stores/models";
import { ModelDetail } from "../catalog/ModelDetail";
import { ProviderList } from "../catalog/ProviderList";
import { ProviderOverview } from "../catalog/ProviderOverview";

interface Selection {
  type: "provider" | "model";
  provider: string;
  model?: string;
}

/**
 * Catalog tab — split-pane layout with provider/model tree on the left,
 * and either a provider overview or model detail on the right.
 */
export function CatalogTab() {
  const t = useTranslations("models");
  const { models, authOverview, loading, fetchModels, fetchAuthOverview } = useModelsStore();
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

  const handleSetDefault = (_provider: string, _modelId: string) => {
    // TODO: wire to store action when config update is ready
  };

  const handleAddToFallback = (_provider: string, _modelId: string) => {
    // TODO: wire to store action when fallbacks update is ready
  };

  const handleGoConfig = () => {
    // TODO: navigate to Provider Config tab
  };

  return (
    <div className="flex h-full">
      {/* Left pane: provider/model tree */}
      <ProviderList
        models={models}
        auth={authOverview}
        loading={loading}
        selectedProvider={selectedProvider}
        selectedModel={selectedModel}
        onSelectProvider={handleSelectProvider}
        onSelectModel={handleSelectModel}
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
          />
        )}

        {selected?.type === "model" && selectedModelObj && (
          <ModelDetail
            model={selectedModelObj}
            auth={selectedAuth}
            onSetDefault={handleSetDefault}
            onAddToFallback={handleAddToFallback}
          />
        )}

        {/* Empty state */}
        {!selected && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-[var(--text-secondary)]">{t("catalog.selectModel")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
