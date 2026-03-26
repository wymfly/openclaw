"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModelsStore } from "@/stores/models";
import type { CatalogProvider } from "@/stores/models";
import { WizardStepCustom } from "./WizardStepCustom";
import { WizardStepKnown } from "./WizardStepKnown";
import { WizardStepSelect } from "./WizardStepSelect";

type WizardStep =
  | { type: "select" }
  | { type: "known"; provider: CatalogProvider }
  | { type: "custom" };

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
  } = useModelsStore();

  const [step, setStep] = useState<WizardStep>({ type: "select" });

  // Derive configured provider set from store
  const configuredProviders = useMemo(
    () => new Set(providers.map((p) => p.provider)),
    [providers],
  );

  // Lazy load catalog providers when dialog opens (once per open; errors use retry button)
  useEffect(() => {
    if (open && catalogProviders.length === 0 && !catalogProvidersLoading && !catalogProvidersError) {
      void fetchCatalogProviders();
    }
  }, [open, catalogProviders.length, catalogProvidersLoading, catalogProvidersError, fetchCatalogProviders]);

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

  const handleComplete = useCallback(() => {
    setStep({ type: "select" });
    onOpenChange(false);
  }, [onOpenChange]);

  // Dialog title depends on step
  const title = useMemo(() => {
    switch (step.type) {
      case "select":
        return t("title");
      case "known":
        return t("configureProvider", { provider: step.provider.displayName });
      case "custom":
        return t("title");
    }
  }, [step, t]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
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
      </DialogContent>
    </Dialog>
  );
}
