"use client";

import { Cpu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useModelsStore } from "@/stores/models";
import { ModelCatalog } from "./ModelCatalog";
import { ProviderConfig } from "./ProviderConfig";

/**
 * Models panel — catalog browser with provider detail.
 * Left: scrollable model catalog grouped by provider.
 * Right: provider configuration form.
 */
export function ModelsPanel() {
  const t = useTranslations("models");
  const { selectedProvider, fetchModels, fetchProviderConfig } = useModelsStore();

  useEffect(() => {
    void fetchModels();
    void fetchProviderConfig();
  }, [fetchModels, fetchProviderConfig]);

  return (
    <div className="flex h-full overflow-hidden rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)]">
      <ModelCatalog />
      <div className="flex flex-col flex-1 min-w-0">
        {selectedProvider ? (
          <ProviderConfig provider={selectedProvider} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)]">
            <div className="w-12 h-12 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center ring-1 ring-[var(--border-subtle)]">
              <Cpu size={20} className="text-[var(--accent)]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {t("selectProvider")}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
