"use client";

import { CheckCircle, AlertCircle, Loader2, Radio } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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
      <div className="flex items-center gap-2.5 mb-1">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--accent-muted)]">
          <Radio size={14} className="text-[var(--accent)]" />
        </div>
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          {t("stepConnection")}
        </span>
      </div>

      {/* Gateway URL */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-[var(--text-secondary)]">
          {t("gatewayUrl")}
        </Label>
        <Input
          type="url"
          value={data.gatewayUrl}
          onChange={(e) => {
            onChange({ gatewayUrl: e.target.value });
            setResult(null);
          }}
          placeholder="ws://localhost:18789"
          className="h-9 text-sm font-mono focus-glow"
        />
      </div>

      {/* Token */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-[var(--text-secondary)]">
          {t("gatewayToken")}
        </Label>
        <Input
          type="password"
          value={data.gatewayToken}
          onChange={(e) => {
            onChange({ gatewayToken: e.target.value });
            setResult(null);
          }}
          placeholder={t("tokenPlaceholder")}
          className="h-9 text-sm focus-glow"
        />
      </div>

      {/* Test result */}
      {result && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium ring-1 transition-panel",
            result.ok
              ? "bg-[var(--success-muted)] text-[var(--success-muted-text)] ring-[var(--success)]/20"
              : "bg-[var(--danger-muted)] text-[var(--danger-muted-text)] ring-[var(--danger)]/20",
          )}
        >
          {result.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {result.ok ? t("connectionSuccess") : (result.error ?? t("connectionFailed"))}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void testConnection()}
          disabled={testing || !data.gatewayUrl || !data.gatewayToken}
          className="gap-1.5 text-xs"
        >
          {testing && <Loader2 size={12} className="animate-spin" />}
          {t("testConnection")}
        </Button>
        <Button size="sm" onClick={onNext} disabled={!result?.ok} className="text-xs">
          {t("next")}
        </Button>
      </div>
    </div>
  );
}
