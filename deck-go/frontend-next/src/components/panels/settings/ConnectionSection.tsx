"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMonitorStore } from "@/stores/monitor";
import { useSettingsStore } from "@/stores/settings";

const RUNTIME_POLL_MS = 15_000;

function runtimeStatusI18nKey(status?: string): string {
  switch (status) {
    case "stopped":
    case "starting":
    case "running":
    case "degraded":
    case "stopping":
    case "failed":
      return status;
    default:
      return "unknown";
  }
}

function runtimeHealthI18nKey(health?: string): string {
  switch (health) {
    case "healthy":
    case "unhealthy":
      return health;
    default:
      return "unknown";
  }
}

export function ConnectionSection() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const tMonitor = useTranslations("monitor");

  const gatewayUrl = useSettingsStore((s) => s.gatewayUrl);
  const gatewayToken = useSettingsStore((s) => s.gatewayToken);
  const setGatewayUrl = useSettingsStore((s) => s.setGatewayUrl);
  const setGatewayToken = useSettingsStore((s) => s.setGatewayToken);
  const saveSettings = useSettingsStore((s) => s.saveSettings);
  const testConnection = useSettingsStore((s) => s.testConnection);
  const runtimeGateway = useMonitorStore((s) => s.runtimeGateway);
  const runtimeGatewayLoading = useMonitorStore((s) => s.runtimeGatewayLoading);
  const runtimeGatewayAction = useMonitorStore((s) => s.runtimeGatewayAction);
  const runtimeGatewayError = useMonitorStore((s) => s.runtimeGatewayError);
  const fetchRuntimeGateway = useMonitorStore((s) => s.fetchRuntimeGateway);
  const startRuntimeGateway = useMonitorStore((s) => s.startRuntimeGateway);
  const restartRuntimeGateway = useMonitorStore((s) => s.restartRuntimeGateway);
  const stopRuntimeGateway = useMonitorStore((s) => s.stopRuntimeGateway);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const runtimeStatus = runtimeGateway?.status;
  const runtimeConfigured = runtimeGateway?.configured ?? false;
  const runtimeActionPending = runtimeGatewayAction !== "idle";

  useEffect(() => {
    void fetchRuntimeGateway();
    const id = setInterval(() => void fetchRuntimeGateway(), RUNTIME_POLL_MS);
    return () => clearInterval(id);
  }, [fetchRuntimeGateway]);

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
    await fetchRuntimeGateway();
    setSaving(false);
  };

  const canStart =
    runtimeConfigured &&
    !runtimeActionPending &&
    runtimeStatus !== "running" &&
    runtimeStatus !== "starting";
  const canRestart =
    runtimeConfigured &&
    !runtimeActionPending &&
    runtimeStatus !== "stopped" &&
    runtimeStatus !== "stopping" &&
    runtimeStatus !== "starting";
  const canStop =
    runtimeConfigured &&
    !runtimeActionPending &&
    runtimeStatus !== "stopped" &&
    runtimeStatus !== "stopping";

  return (
    <section>
      <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
        {t("connection")}
      </h3>
      <div
        className="rounded-lg border p-4 flex flex-col gap-3"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        <div
          className="rounded-lg border p-3 flex flex-col gap-3"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                {tMonitor("runtime.title")}
              </p>
              <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                {runtimeGatewayLoading && !runtimeGateway
                  ? tc("loading")
                  : runtimeGateway?.gatewayUrl || "\u2014"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                {tMonitor("runtime.status")}:{" "}
                {tMonitor(`runtime.statusValues.${runtimeStatusI18nKey(runtimeStatus)}`)}
              </Badge>
              <Badge variant="outline">
                {tMonitor("runtime.health")}:{" "}
                {tMonitor(`runtime.healthValues.${runtimeHealthI18nKey(runtimeGateway?.health)}`)}
              </Badge>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="px-3 py-2 rounded-md" style={{ backgroundColor: "var(--muted)" }}>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                {tMonitor("runtime.url")}
              </p>
              <p className="text-xs font-medium break-all" style={{ color: "var(--foreground)" }}>
                {runtimeGateway?.gatewayUrl || "\u2014"}
              </p>
            </div>
            <div className="px-3 py-2 rounded-md" style={{ backgroundColor: "var(--muted)" }}>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                {tMonitor("runtime.lastError")}
              </p>
              <p className="text-xs font-medium break-all" style={{ color: "var(--foreground)" }}>
                {runtimeGateway?.lastError || tMonitor("runtime.none")}
              </p>
            </div>
          </div>

          {!runtimeConfigured && (
            <div
              className="px-3 py-2 text-xs rounded-md"
              style={{
                color: "var(--warning-muted-text)",
                backgroundColor: "var(--warning-muted)",
              }}
            >
              {tMonitor("runtime.notConfigured")}
            </div>
          )}

          {runtimeGatewayError && (
            <div
              className="px-3 py-2 text-xs rounded-md"
              style={{
                color: "var(--destructive)",
                backgroundColor: "var(--destructive-muted)",
              }}
            >
              {runtimeGatewayError}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="xs" onClick={() => void startRuntimeGateway()} disabled={!canStart}>
              {runtimeGatewayAction === "starting"
                ? tMonitor("runtime.starting")
                : tMonitor("runtime.actions.start")}
            </Button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => void restartRuntimeGateway()}
              disabled={!canRestart}
            >
              {runtimeGatewayAction === "restarting"
                ? tMonitor("runtime.restarting")
                : tMonitor("runtime.actions.restart")}
            </Button>
            <Button
              type="button"
              size="xs"
              variant="destructive"
              onClick={() => void stopRuntimeGateway()}
              disabled={!canStop}
            >
              {runtimeGatewayAction === "stopping"
                ? tMonitor("runtime.stopping")
                : tMonitor("runtime.actions.stop")}
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => void fetchRuntimeGateway()}
              disabled={runtimeGatewayLoading || runtimeActionPending}
            >
              {tMonitor("runtime.refresh")}
            </Button>
          </div>
        </div>

        {/* Gateway URL */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
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
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
            }}
          />
        </div>

        {/* Gateway Token */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
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
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
            }}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            onClick={() => void handleTest()}
            disabled={testing}
            size="xs"
            variant="outline"
          >
            {testing ? "..." : t("testConnection")}
          </Button>

          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            size="xs"
          >
            {saving ? "..." : tc("save")}
          </Button>

          {testResult !== null && (
            <span
              className="text-xs font-medium"
              style={{
                color: testResult ? "var(--success)" : "var(--destructive)",
              }}
            >
              {testResult ? t("connectionSuccess") : t("connectionFailed")}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
