"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useModelsStore } from "@/stores/models";
import { ModelCatalog } from "./ModelCatalog";
import { ProviderConfig } from "./ProviderConfig";

/**
 * Models panel — entry point component.
 * Composes model catalog (left) and provider config (right).
 */
export function ModelsPanel() {
  const t = useTranslations("models");
  const { selectedProvider, fetchModels, fetchProviderConfig } = useModelsStore();

  useEffect(() => {
    void fetchModels();
    void fetchProviderConfig();
  }, [fetchModels, fetchProviderConfig]);

  return (
    <div
      className="flex h-full rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--border)" }}
    >
      <ModelCatalog />
      <div className="flex flex-col flex-1 min-w-0">
        {selectedProvider ? (
          <ProviderConfig provider={selectedProvider} />
        ) : (
          <div
            className="flex items-center justify-center h-full"
            style={{ color: "var(--text-secondary)" }}
          >
            <p className="text-sm">{t("selectProvider")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
