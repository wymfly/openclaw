"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { BedrockDiscoveryConfig } from "@/stores/models";

const COMMON_REGIONS = ["us-east-1", "us-west-2", "eu-west-1", "ap-northeast-1"];
const BEDROCK_PROVIDERS = ["anthropic", "amazon", "meta", "cohere", "mistral"];

interface BedrockDiscoveryCardProps {
  config: BedrockDiscoveryConfig;
  onUpdate: (config: BedrockDiscoveryConfig) => Promise<boolean>;
}

/**
 * Card for global AWS Bedrock discovery settings.
 * Debounces saves at 500ms; syncs from props when config changes externally.
 */
export function BedrockDiscoveryCard({ config, onUpdate }: BedrockDiscoveryCardProps) {
  const t = useTranslations("models.config");
  const [local, setLocal] = useState<BedrockDiscoveryConfig>(config);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from props when config changes externally
  useEffect(() => {
    setLocal(config);
  }, [config]);

  // Clear debounce timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const debouncedSave = useCallback(
    (next: BedrockDiscoveryConfig) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        void onUpdate(next);
      }, 500);
    },
    [onUpdate],
  );

  const update = useCallback(
    (patch: Partial<BedrockDiscoveryConfig>) => {
      const next = { ...local, ...patch };
      setLocal(next);
      debouncedSave(next);
    },
    [local, debouncedSave],
  );

  const handleToggleProvider = useCallback(
    (provider: string, checked: boolean) => {
      const current = local.providerFilter ?? [];
      const next = checked ? [...current, provider] : current.filter((p) => p !== provider);
      update({ providerFilter: next });
    },
    [local.providerFilter, update],
  );

  return (
    <Card className="transition-panel">
      <CardHeader className="border-b pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{t("bedrockTitle")}</CardTitle>
          <Switch
            checked={!!local.enabled}
            onCheckedChange={(checked) => update({ enabled: checked })}
          />
        </div>
      </CardHeader>

      {local.enabled && (
        <CardContent className="space-y-4 pt-3">
          {/* Region */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t("bedrockRegion")}</Label>
            <Input
              value={local.region ?? ""}
              onChange={(e) => update({ region: e.target.value || undefined })}
              list="bedrock-regions"
              placeholder="us-east-1"
              className="h-8 text-xs"
            />
            <datalist id="bedrock-regions">
              {COMMON_REGIONS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>

          {/* Provider Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("bedrockProviderFilter")}</Label>
            <div className="flex flex-wrap gap-3">
              {BEDROCK_PROVIDERS.map((p) => (
                <label key={p} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(local.providerFilter ?? []).includes(p)}
                    onChange={(e) => handleToggleProvider(p, e.target.checked)}
                    className="accent-[var(--primary)]"
                  />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Refresh Interval */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t("bedrockRefreshInterval")}</Label>
            <Input
              type="number"
              value={local.refreshInterval ?? ""}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : undefined;
                update({ refreshInterval: v });
              }}
              placeholder="3600"
              className="h-8 text-xs"
              min={0}
            />
          </div>

          {/* Default Context Window */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t("bedrockDefaultContext")}</Label>
            <Input
              type="number"
              value={local.defaultContextWindow ?? ""}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : undefined;
                update({ defaultContextWindow: v });
              }}
              placeholder="200000"
              className="h-8 text-xs"
              min={0}
            />
          </div>

          {/* Default Max Tokens */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t("bedrockDefaultMaxTokens")}</Label>
            <Input
              type="number"
              value={local.defaultMaxTokens ?? ""}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : undefined;
                update({ defaultMaxTokens: v });
              }}
              placeholder="4096"
              className="h-8 text-xs"
              min={0}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
