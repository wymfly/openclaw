"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useModelsStore } from "@/stores/models";
import { AddProviderWizard } from "../config/AddProviderWizard";
import { AuthHealthCard } from "../config/AuthHealthCard";
import { BedrockDiscoveryCard } from "../config/BedrockDiscoveryCard";
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
    bedrockDiscovery,
    configRaw,
    fetchAuthOverview,
    fetchProviderConfig,
    fetchFallbacks,
    runProbe,
    updateProviderConfig,
    addCustomProvider,
    updateBedrockDiscovery,
  } = useModelsStore();

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [probeLoading, setProbeLoading] = useState<Record<string, boolean>>({});
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  useEffect(() => {
    void fetchAuthOverview();
    void fetchProviderConfig();
    void fetchFallbacks();
  }, [fetchAuthOverview, fetchProviderConfig, fetchFallbacks]);

  // Auto-select the first configured provider once auth overview loads
  useEffect(() => {
    if (!selectedProvider && authOverview.length > 0) {
      const firstConfigured = authOverview.find((a) => a.status !== "unknown");
      setSelectedProvider((firstConfigured ?? authOverview[0]).provider);
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

  // Derive auth type from raw config (primary), with authOverview as fallback
  const configAuthType = useMemo(() => {
    if (!configRaw || !selectedProvider) {
      return null;
    }
    try {
      const config = JSON.parse(configRaw) as Record<string, unknown>;
      const models = config.models as Record<string, unknown> | undefined;
      const providersCfg = models?.providers as Record<string, unknown> | undefined;
      const providerCfg = providersCfg?.[selectedProvider] as Record<string, unknown> | undefined;
      return (providerCfg?.auth as string) ?? null;
    } catch {
      return null;
    }
  }, [configRaw, selectedProvider]);

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
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          {t("config.globalOnlyTitle")}
        </h2>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">{t("config.globalOnlyHint")}</p>
      </div>

      <div className="flex min-h-0 flex-1">
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
              {selectedEntry.editable || selectedConfig ? (
                <ConfigForm
                  provider={selectedProvider!}
                  initialConfig={selectedConfig}
                  authType={configAuthType ?? selectedEntry?.auth?.type ?? null}
                  onSave={updateProviderConfig}
                />
              ) : (
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--muted)]/60 px-4 py-3">
                  <h3 className="text-sm font-medium text-[var(--foreground)]">
                    {t("config.readOnlyTitle")}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {t("config.readOnlyHint")}
                  </p>
                  <button
                    type="button"
                    onClick={() => setAddDialogOpen(true)}
                    className="mt-3 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
                  >
                    {t("config.addProvider")}
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Empty state */
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-[var(--muted-foreground)]">{t("selectProvider")}</p>
            </div>
          )}

          {/* Bedrock Discovery — global config */}
          <BedrockDiscoveryCard config={bedrockDiscovery} onUpdate={updateBedrockDiscovery} />
        </div>
      </div>

      <AddProviderWizard
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddProvider}
      />
    </div>
  );
}
