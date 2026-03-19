"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CatalogTab } from "./tabs/CatalogTab";
import { FallbacksTab } from "./tabs/FallbacksTab";
import { ProviderConfigTab } from "./tabs/ProviderConfigTab";
import { UsageTab } from "./tabs/UsageTab";

/**
 * Models panel — four-tab layout:
 *   Catalog | Provider Config | Fallbacks | Usage
 */
export function ModelsPanel() {
  const t = useTranslations("models");

  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="catalog" className="flex h-full flex-col">
        <TabsList className="mx-4 mt-2 shrink-0">
          <TabsTrigger value="catalog">{t("tabs.catalog")}</TabsTrigger>
          <TabsTrigger value="config">{t("tabs.config")}</TabsTrigger>
          <TabsTrigger value="fallbacks">{t("tabs.fallbacks")}</TabsTrigger>
          <TabsTrigger value="usage">{t("tabs.usage")}</TabsTrigger>
        </TabsList>
        <TabsContent value="catalog" className="flex-1 overflow-hidden mt-0">
          <CatalogTab />
        </TabsContent>
        <TabsContent value="config" className="flex-1 overflow-hidden mt-0">
          <ProviderConfigTab />
        </TabsContent>
        <TabsContent value="fallbacks" className="flex-1 overflow-hidden mt-0">
          <FallbacksTab />
        </TabsContent>
        <TabsContent value="usage" className="flex-1 overflow-hidden mt-0">
          <UsageTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
