"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CatalogTab } from "./tabs/CatalogTab";
import { FallbacksTab } from "./tabs/FallbacksTab";
import { ProviderConfigTab } from "./tabs/ProviderConfigTab";
import { UsageTab } from "./tabs/UsageTab";

/**
 * Models panel — 4-tab layout (controlled).
 * CatalogTab can request navigation to Provider Config with a pre-selected provider.
 */
export function ModelsPanel() {
  const t = useTranslations("models");
  const [activeTab, setActiveTab] = useState("catalog");

  // Provider to pre-select when navigating from Catalog → Provider Config
  const [configProvider, setConfigProvider] = useState<string | null>(null);

  const handleGoConfig = useCallback((provider: string) => {
    setConfigProvider(provider);
    setActiveTab("provider-config");
  }, []);

  const handleConsumeConfigProvider = useCallback(() => {
    setConfigProvider(null);
  }, []);

  const handleGoFallbacks = useCallback(() => {
    setActiveTab("fallbacks");
  }, []);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
      <TabsList
        className="shrink-0 rounded-none border-b px-2"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        <TabsTrigger value="catalog">{t("tabs.catalog")}</TabsTrigger>
        <TabsTrigger value="provider-config">{t("tabs.config")}</TabsTrigger>
        <TabsTrigger value="fallbacks">{t("tabs.fallbacks")}</TabsTrigger>
        <TabsTrigger value="usage">{t("tabs.usage")}</TabsTrigger>
      </TabsList>
      <TabsContent value="catalog" className="flex-1 overflow-auto mt-0">
        <CatalogTab onGoConfig={handleGoConfig} onGoFallbacks={handleGoFallbacks} />
      </TabsContent>
      <TabsContent value="provider-config" className="flex-1 overflow-auto mt-0">
        <ProviderConfigTab
          initialProvider={configProvider}
          onConsumeInitialProvider={handleConsumeConfigProvider}
        />
      </TabsContent>
      <TabsContent value="fallbacks" className="flex-1 overflow-auto mt-0">
        <FallbacksTab />
      </TabsContent>
      <TabsContent value="usage" className="flex-1 overflow-auto mt-0">
        <UsageTab />
      </TabsContent>
    </Tabs>
  );
}
