"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Card } from "@/components/ui/card";
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
    <Card className="flex-row h-full p-0 gap-0">
      <ModelCatalog />
      <div className="flex flex-col flex-1 min-w-0">
        {selectedProvider ? (
          <ProviderConfig provider={selectedProvider} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">{t("selectProvider")}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
