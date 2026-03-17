"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSettingsStore } from "@/stores/settings";

export function ConnectionSection() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");

  const gatewayUrl = useSettingsStore((s) => s.gatewayUrl);
  const gatewayToken = useSettingsStore((s) => s.gatewayToken);
  const setGatewayUrl = useSettingsStore((s) => s.setGatewayUrl);
  const setGatewayToken = useSettingsStore((s) => s.setGatewayToken);
  const saveSettings = useSettingsStore((s) => s.saveSettings);
  const testConnection = useSettingsStore((s) => s.testConnection);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const ok = await testConnection();
    setTestResult(ok);
    setTesting(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await saveSettings();
    setSaving(false);
  };

  return (
    <section>
      <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
        {t("connection")}
      </h3>
      <div
        className="rounded-lg border p-4 flex flex-col gap-3"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}
      >
        {/* Gateway URL */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            {t("gatewayUrl")}
          </label>
          <input
            type="text"
            value={gatewayUrl}
            onChange={(e) => setGatewayUrl(e.target.value)}
            placeholder="ws://localhost:18789"
            className="px-3 py-1.5 text-xs rounded-md border outline-none"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        {/* Gateway Token */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            {t("gatewayToken")}
          </label>
          <input
            type="password"
            value={gatewayToken}
            onChange={(e) => setGatewayToken(e.target.value)}
            placeholder="••••••"
            className="px-3 py-1.5 text-xs rounded-md border outline-none"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            className="px-3 py-1.5 text-xs rounded-md font-medium border"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-primary)",
              backgroundColor: "var(--bg-primary)",
            }}
            onClick={() => void handleTest()}
            disabled={testing}
          >
            {testing ? "..." : t("testConnection")}
          </button>

          <button
            type="button"
            className="px-3 py-1.5 text-xs rounded-md font-medium"
            style={{
              backgroundColor: "var(--accent)",
              color: "#fff",
            }}
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? "..." : tc("save")}
          </button>

          {testResult !== null && (
            <span
              className="text-xs font-medium"
              style={{
                color: testResult ? "rgb(34,197,94)" : "rgb(239,68,68)",
              }}
            >
              {testResult ? "Connected" : "Failed"}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
