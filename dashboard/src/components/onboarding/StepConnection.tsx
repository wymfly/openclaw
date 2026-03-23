"use client";

import { Wifi, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useCallback } from "react";
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

  const inputStyle = {
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Wifi size={16} style={{ color: "var(--accent)" }} />
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {t("stepConnection")}
        </span>
      </div>

      {/* Gateway URL */}
      <div>
        <label
          className="block text-xs font-medium mb-1"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("gatewayUrl")}
        </label>
        <input
          type="url"
          value={data.gatewayUrl}
          onChange={(e) => {
            onChange({ gatewayUrl: e.target.value });
            setResult(null);
          }}
          placeholder="ws://localhost:18789"
          className="w-full text-sm rounded px-3 py-2"
          style={inputStyle}
        />
      </div>

      {/* Token */}
      <div>
        <label
          className="block text-xs font-medium mb-1"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("gatewayToken")}
        </label>
        <input
          type="password"
          value={data.gatewayToken}
          onChange={(e) => {
            onChange({ gatewayToken: e.target.value });
            setResult(null);
          }}
          placeholder={t("tokenPlaceholder")}
          className="w-full text-sm rounded px-3 py-2"
          style={inputStyle}
        />
      </div>

      {/* Test result */}
      {result && (
        <div
          className="flex items-center gap-2 text-xs px-3 py-2 rounded"
          style={{
            backgroundColor: result.ok ? "var(--status-connected)" : "var(--status-disconnected)",
            color: "#fff",
          }}
        >
          {result.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {result.ok ? t("connectionSuccess") : (result.error ?? t("connectionFailed"))}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={() => void testConnection()}
          disabled={testing || !data.gatewayUrl || !data.gatewayToken}
          className="flex items-center gap-1.5 text-xs px-4 py-2 rounded hover:opacity-80 transition-opacity disabled:opacity-40"
          style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
        >
          {testing && <Loader2 size={12} className="animate-spin" />}
          {t("testConnection")}
        </button>
        <button
          onClick={onNext}
          disabled={!result?.ok}
          className="text-xs px-4 py-2 rounded hover:opacity-80 transition-opacity disabled:opacity-40"
          style={{ backgroundColor: "var(--accent)", color: "#fff" }}
        >
          {t("next")}
        </button>
      </div>
    </div>
  );
}
