"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useModelsStore } from "@/stores/models";
import type { CatalogProvider } from "@/stores/models";
import { WizardStepCustom } from "./WizardStepCustom";
import { WizardStepKnown } from "./WizardStepKnown";
import { WizardStepSelect } from "./WizardStepSelect";

type WizardStep =
  | { type: "select" }
  | { type: "known"; provider: CatalogProvider }
  | { type: "custom" }
  | { type: "success"; provider: string; models: Array<{ id: string; name: string }> };

interface AddProviderWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (params: {
    name: string;
    api: string;
    auth: string;
    baseUrl: string;
    apiKey?: string;
    models: Array<{ id: string; name: string; contextWindow: number; maxTokens: number }>;
    headers?: Record<string, string>;
    authHeader?: boolean;
    injectNumCtxForOpenAICompat?: boolean;
  }) => Promise<boolean>;
}

export function AddProviderWizard({ open, onOpenChange, onAdd }: AddProviderWizardProps) {
  const t = useTranslations("models.wizard");

  const {
    catalogProviders,
    catalogProvidersLoading,
    catalogProvidersError,
    providers,
    authOverview,
    fetchCatalogProviders,
    primaryModel,
    fallbacks,
    updateFallbacks,
  } = useModelsStore();

  const [step, setStep] = useState<WizardStep>({ type: "select" });
  const [selectedModel, setSelectedModel] = useState<string>("");

  // Derive configured provider set from store
  const configuredProviders = useMemo(() => new Set(providers.map((p) => p.provider)), [providers]);

  // Lazy load catalog providers when dialog opens (once per open; errors use retry button)
  useEffect(() => {
    if (
      open &&
      catalogProviders.length === 0 &&
      !catalogProvidersLoading &&
      !catalogProvidersError
    ) {
      void fetchCatalogProviders();
    }
  }, [
    open,
    catalogProviders.length,
    catalogProvidersLoading,
    catalogProvidersError,
    fetchCatalogProviders,
  ]);

  // Reset step when dialog closes
  const handleClose = useCallback(
    (o: boolean) => {
      if (!o) {
        setStep({ type: "select" });
      }
      onOpenChange(o);
    },
    [onOpenChange],
  );

  const handleComplete = useCallback(
    (providerName: string, models: Array<{ id: string; name: string }>) => {
      // Auto-select if only one model
      setSelectedModel(models.length === 1 ? `${providerName}/${models[0].id}` : "");
      setStep({ type: "success", provider: providerName, models });
    },
    [],
  );

  // Dialog title depends on step
  const title = useMemo(() => {
    switch (step.type) {
      case "select":
        return t("title");
      case "known":
        return t("configureProvider", { provider: step.provider.displayName });
      case "custom":
        return t("title");
      case "success":
        return t("postAdd.title");
    }
  }, [step, t]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t("globalOnlyHint")}</DialogDescription>
        </DialogHeader>

        {step.type === "select" && (
          <WizardStepSelect
            catalogProviders={catalogProviders}
            catalogLoading={catalogProvidersLoading}
            catalogError={catalogProvidersError}
            configuredProviders={configuredProviders}
            authOverview={authOverview}
            onSelectKnown={(p) => setStep({ type: "known", provider: p })}
            onSelectCustom={() => setStep({ type: "custom" })}
            onRetryLoad={() => void fetchCatalogProviders()}
          />
        )}

        {step.type === "known" && (
          <WizardStepKnown
            provider={step.provider}
            onAdd={onAdd}
            onBack={() => setStep({ type: "select" })}
            onComplete={handleComplete}
          />
        )}

        {step.type === "custom" && (
          <WizardStepCustom
            onAdd={onAdd}
            onBack={() => setStep({ type: "select" })}
            onComplete={handleComplete}
          />
        )}

        {step.type === "success" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {t("postAdd.description", { provider: step.provider })}
            </p>

            {step.models.length > 1 && (
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("postAdd.selectModel")}</p>
                <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("postAdd.selectModel")} />
                  </SelectTrigger>
                  <SelectContent>
                    {step.models.map((m) => (
                      <SelectItem key={m.id} value={`${step.provider}/${m.id}`}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <Button
                className="bg-primary text-primary-foreground w-full"
                disabled={!selectedModel}
                onClick={async () => {
                  if (!selectedModel) return;
                  await updateFallbacks(selectedModel, fallbacks);
                  handleClose(false);
                }}
              >
                {t("postAdd.setAsPrimary")}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                disabled={!selectedModel}
                onClick={async () => {
                  if (!selectedModel) return;
                  await updateFallbacks(primaryModel ?? selectedModel, [
                    ...fallbacks,
                    selectedModel,
                  ]);
                  handleClose(false);
                }}
              >
                {t("postAdd.addToFallback")}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => handleClose(false)}>
                {t("postAdd.close")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
