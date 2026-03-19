"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <h3 className="mb-3 text-sm font-semibold text-foreground">{t("connection")}</h3>
      <Card size="sm">
        <CardContent className="flex flex-col gap-3">
          {/* Gateway URL */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">{t("gatewayUrl")}</Label>
            <Input
              type="text"
              value={gatewayUrl}
              onChange={(e) => setGatewayUrl(e.target.value)}
              placeholder="ws://localhost:18789"
              className="h-7 text-xs"
            />
          </div>

          {/* Gateway Token */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">{t("gatewayToken")}</Label>
            <Input
              type="password"
              value={gatewayToken}
              onChange={(e) => setGatewayToken(e.target.value)}
              placeholder="••••••"
              className="h-7 text-xs"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="xs"
              onClick={() => void handleTest()}
              disabled={testing}
            >
              {testing ? "..." : t("testConnection")}
            </Button>

            <Button size="xs" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "..." : tc("save")}
            </Button>

            {testResult !== null && (
              <span
                className={
                  testResult
                    ? "text-xs font-medium text-[var(--success)]"
                    : "text-xs font-medium text-destructive"
                }
              >
                {testResult ? t("connectionSuccess") : t("connectionFailed")}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
