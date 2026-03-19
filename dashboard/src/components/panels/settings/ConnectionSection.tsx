"use client";

import { CheckCircle, Loader2, Radio, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
          {t("connection")}
        </h3>
        {testResult !== null && (
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] gap-1",
              testResult
                ? "border-[var(--success)]/30 text-[var(--success-muted-text)] bg-[var(--success-muted)]"
                : "border-[var(--danger)]/30 text-[var(--danger-muted-text)] bg-[var(--danger-muted)]",
            )}
          >
            {testResult ? <CheckCircle size={10} /> : <XCircle size={10} />}
            {testResult ? t("connectionSuccess") : t("connectionFailed")}
          </Badge>
        )}
      </div>

      <Card className="ring-1 ring-[var(--border)]">
        <CardContent className="flex flex-col gap-4 p-4">
          {/* Gateway URL */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-[var(--text-secondary)]">
              {t("gatewayUrl")}
            </Label>
            <div className="relative">
              <Radio
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
              />
              <Input
                type="text"
                value={gatewayUrl}
                onChange={(e) => setGatewayUrl(e.target.value)}
                placeholder="ws://localhost:18789"
                className="h-8 pl-9 text-xs font-mono focus-glow"
              />
            </div>
          </div>

          {/* Gateway Token */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-[var(--text-secondary)]">
              {t("gatewayToken")}
            </Label>
            <Input
              type="password"
              value={gatewayToken}
              onChange={(e) => setGatewayToken(e.target.value)}
              placeholder="••••••••"
              className="h-8 text-xs font-mono focus-glow"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-subtle)]">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleTest()}
              disabled={testing}
              className="gap-1.5 text-xs"
            >
              {testing && <Loader2 size={12} className="animate-spin" />}
              {t("testConnection")}
            </Button>

            <Button
              size="sm"
              onClick={() => void handleSave()}
              disabled={saving}
              className="gap-1.5 text-xs"
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              {tc("save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
