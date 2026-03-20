"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import { useModelsStore } from "@/stores/models";
import { AddProviderDialog } from "../config/AddProviderDialog";
import { AuthHealthCard } from "../config/AuthHealthCard";
import { ConfigForm } from "../config/ConfigForm";
import { ProviderSidebar } from "../config/ProviderSidebar";

/**
 * Provider Config tab — split-pane layout:
 *   Left: ProviderSidebar (grouped by configured/unconfigured)
 *   Right: AuthHealthCard + ConfigForm for the selected provider
 */
interface ProviderConfigTabProps {
  initialProvider?: string | null;
  onConsumeInitialProvider?: () => void;
}

export function ProviderConfigTab({
  initialProvider,
  onConsumeInitialProvider,
}: ProviderConfigTabProps = {}) {
  const t = useTranslations("models");
  const {
    authOverview,
    providers,
    probeResults,
    fetchAuthOverview,
    fetchProviderConfig,
    runProbe,
    updateProviderConfig,
    addCustomProvider,
  } = useModelsStore();

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [probeLoading, setProbeLoading] = useState<Record<string, boolean>>({});
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  useEffect(() => {
    void fetchAuthOverview();
    void fetchProviderConfig();
  }, [fetchAuthOverview, fetchProviderConfig]);

  // Auto-select the first provider once auth overview loads
  useEffect(() => {
    if (!selectedProvider && authOverview.length > 0) {
      setSelectedProvider(authOverview[0].provider);
    }
  }, [selectedProvider, authOverview]);

  // Handle navigation from Catalog tab with a specific provider
  useEffect(() => {
    if (initialProvider) {
      setSelectedProvider(initialProvider);
      onConsumeInitialProvider?.();
    }
  }, [initialProvider, onConsumeInitialProvider]);

  const selectedEntry = authOverview.find((e) => e.provider === selectedProvider);

  // Find matching provider config for the selected entry
  const selectedConfig = providers.find((p) => p.provider === selectedProvider);

  const handleAddProvider = useCallback(
    async (params: Parameters<typeof addCustomProvider>[0]) => {
      const ok = await addCustomProvider(params);
      if (ok) {
        setSelectedProvider(params.name.toLowerCase().trim());
      }
      return ok;
    },
    [addCustomProvider],
  );

  const handleProbe = useCallback(async () => {
    if (!selectedProvider) {
      return;
    }
    setProbeLoading((prev) => ({ ...prev, [selectedProvider]: true }));
    try {
      await runProbe(selectedProvider);
    } finally {
      setProbeLoading((prev) => ({ ...prev, [selectedProvider]: false }));
    }
  }, [selectedProvider, runProbe]);

  return (
    <div className="flex h-full">
      {/* Left pane: provider list */}
      <ProviderSidebar
        auth={authOverview}
        selected={selectedProvider}
        onSelect={setSelectedProvider}
        onAddProvider={() => setAddDialogOpen(true)}
      />

      {/* Right pane: details for selected provider */}
      <div className="flex-1 overflow-auto border-l border-[var(--border)] p-4 space-y-4">
        {selectedEntry ? (
          <>
            <AuthHealthCard
              entry={selectedEntry}
              probeResult={selectedProvider ? probeResults[selectedProvider] : undefined}
              probeLoading={!!(selectedProvider && probeLoading[selectedProvider])}
              onProbe={() => void handleProbe()}
            />
            <ConfigForm
              provider={selectedProvider!}
              initialConfig={selectedConfig}
              onSave={updateProviderConfig}
            />
          </>
        ) : (
          /* Empty state */
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-[var(--text-secondary)]">{t("selectProvider")}</p>
          </div>
        )}
      </div>
      <AddProviderDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddProvider}
      />
    </div>
  );
}
