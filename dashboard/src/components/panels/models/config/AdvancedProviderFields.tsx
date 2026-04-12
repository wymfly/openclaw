"use client";

import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { KeyValueEditor } from "./KeyValueEditor";

interface AdvancedProviderFieldsProps {
  headers: Record<string, string>;
  authHeader: boolean;
  injectNumCtxForOpenAICompat: boolean;
  onHeadersChange: (v: Record<string, string>) => void;
  onAuthHeaderChange: (v: boolean) => void;
  onInjectNumCtxChange: (v: boolean) => void;
  disabled?: boolean;
}

export function AdvancedProviderFields({
  headers,
  authHeader,
  injectNumCtxForOpenAICompat,
  onHeadersChange,
  onAuthHeaderChange,
  onInjectNumCtxChange,
  disabled,
}: AdvancedProviderFieldsProps) {
  const t = useTranslations("models.advanced.provider");

  return (
    <div className="space-y-4">
      {/* Headers KV editor */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t("headers")}</Label>
        <p className="text-xs text-muted-foreground">{t("headersHint")}</p>
        <KeyValueEditor value={headers} onChange={onHeadersChange} disabled={disabled} />
      </div>

      {/* Auth Header toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Label className="text-sm">{t("authHeader")}</Label>
          <p className="text-xs text-muted-foreground">{t("authHeaderHint")}</p>
        </div>
        <Switch checked={authHeader} onCheckedChange={onAuthHeaderChange} disabled={disabled} />
      </div>

      {/* injectNumCtx toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Label className="text-sm">{t("injectNumCtx")}</Label>
          <p className="text-xs text-muted-foreground">{t("injectNumCtxHint")}</p>
        </div>
        <Switch
          checked={injectNumCtxForOpenAICompat}
          onCheckedChange={onInjectNumCtxChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
