"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CatalogTab } from "./tabs/CatalogTab";
import { FallbacksTab } from "./tabs/FallbacksTab";
import { ProviderConfigTab } from "./tabs/ProviderConfigTab";
import { UsageTab } from "./tabs/UsageTab";

/**
 * Models panel — 4-tab layout.
 * Each tab manages its own data fetching.
 */
export function ModelsPanel() {
  const t = useTranslations("models");

  return (
    <Tabs defaultValue="catalog" className="flex flex-col h-full">
      <TabsList
        className="shrink-0 rounded-none border-b px-2"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}
      >
        <TabsTrigger value="catalog">{t("tabs.catalog")}</TabsTrigger>
        <TabsTrigger value="provider-config">{t("tabs.config")}</TabsTrigger>
        <TabsTrigger value="fallbacks">{t("tabs.fallbacks")}</TabsTrigger>
        <TabsTrigger value="usage">{t("tabs.usage")}</TabsTrigger>
      </TabsList>
      <TabsContent value="catalog" className="flex-1 overflow-auto mt-0">
        <CatalogTab />
      </TabsContent>
      <TabsContent value="provider-config" className="flex-1 overflow-auto mt-0">
        <ProviderConfigTab />
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
