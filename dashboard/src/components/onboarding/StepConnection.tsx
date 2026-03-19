"use client";

import { Wifi, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OnboardingData } from "./OnboardingWizard";

type Props = {
  data: OnboardingData;
  onChange: (partial: Partial<OnboardingData>) => void;
  onNext: () => void;
};

export function StepConnection({ data, onChange, onNext }: Props) {
  const t = useTranslations("onboarding");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const testConnection = useCallback(async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch("/api/onboarding/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: data.gatewayUrl, token: data.gatewayToken }),
      });
      const body = (await res.json()) as { success: boolean; error?: string };
      setResult({ ok: body.success, error: body.error });
    } catch {
      setResult({ ok: false, error: t("connectionFailed") });
    } finally {
      setTesting(false);
    }
  }, [data.gatewayUrl, data.gatewayToken, t]);

  return (
    <div className="space-y-4">
      <div className="mb-2 flex items-center gap-2">
        <Wifi size={16} className="text-primary" />
        <span className="text-sm font-semibold text-foreground">{t("stepConnection")}</span>
      </div>

      {/* Gateway URL */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{t("gatewayUrl")}</Label>
        <Input
          type="url"
          value={data.gatewayUrl}
          onChange={(e) => {
            onChange({ gatewayUrl: e.target.value });
            setResult(null);
          }}
          placeholder="ws://localhost:18789"
          className="text-sm"
        />
      </div>

      {/* Token */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{t("gatewayToken")}</Label>
        <Input
          type="password"
          value={data.gatewayToken}
          onChange={(e) => {
            onChange({ gatewayToken: e.target.value });
            setResult(null);
          }}
          placeholder={t("tokenPlaceholder")}
          className="text-sm"
        />
      </div>

      {/* Test result */}
      {result && (
        <div
          className={
            result.ok
              ? "flex items-center gap-2 rounded-md bg-[var(--success-muted)] px-3 py-2 text-xs text-[var(--success-muted-text)]"
              : "flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive"
          }
        >
          {result.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {result.ok ? t("connectionSuccess") : (result.error ?? t("connectionFailed"))}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void testConnection()}
          disabled={testing || !data.gatewayUrl || !data.gatewayToken}
        >
          {testing && <Loader2 size={12} className="animate-spin" />}
          {t("testConnection")}
        </Button>
        <Button size="sm" onClick={onNext} disabled={!result?.ok}>
          {t("next")}
        </Button>
      </div>
    </div>
  );
}
