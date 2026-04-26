import { useCallback, useEffect, useState } from "react";
import type {
  DeckGoSettings,
  DeckGoSettingsResponse,
} from "../../../../../contracts/generated/ts/deck-api.generated";
import type {
  DeckGoPairedDevice as LocalPairedDevice,
  DeckGoPendingDeviceRequest as LocalPendingDeviceRequest,
} from "../../../api";
import {
  approveDeviceRequest,
  fetchDevices,
  fetchSelfDevice,
  fetchSettings,
  fetchSettingsVersion,
  persistAccessToken,
  rejectDeviceRequest,
  removeDevice,
  revokeDeviceToken,
  rotateDeviceToken,
  saveSettings,
  streamEvents,
  testSettingsConnection,
} from "../../../api";
import { useDeckUI } from "../../../deck-ui/ui-store";
import { useTranslations } from "../../../i18n/provider";
import { JsonDetails } from "../../shared/ShellComponents";

type PairedDevice = LocalPairedDevice;
type PendingDeviceRequest = LocalPendingDeviceRequest;

function normalizeSettings(result: DeckGoSettingsResponse): DeckGoSettings {
  return {
    accessToken: result.settings.accessToken ?? "",
    managedGateway: {
      mode: result.settings.managedGateway?.mode ?? "managed",
      command: result.settings.managedGateway?.command ?? "",
      args: result.settings.managedGateway?.args ?? [],
      workingDir: result.settings.managedGateway?.workingDir ?? "",
      bindHost: result.settings.managedGateway?.bindHost ?? "127.0.0.1",
      bindPort: result.settings.managedGateway?.bindPort ?? 18789,
      gatewayToken: result.settings.managedGateway?.gatewayToken ?? "",
      autoStart: result.settings.managedGateway?.autoStart ?? true,
      env: result.settings.managedGateway?.env ?? {},
    },
  };
}

function formatEnvLines(env: Record<string, string> | undefined) {
  return Object.entries(env ?? {})
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function parseEnvLines(raw: string) {
  const env: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const index = trimmed.indexOf("=");
    if (index <= 0) {
      continue;
    }
    const key = trimmed.slice(0, index).trim();
    if (!key) {
      continue;
    }
    env[key] = trimmed.slice(index + 1).trim();
  }
  return env;
}

function formatArgsText(args: string[] | undefined) {
  return JSON.stringify(args ?? []);
}

function parseArgsText(raw: string): {
  args: string[];
  errorKey: "startupArgsJsonError" | "startupArgsArrayError" | "";
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { args: [], errorKey: "" };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
      return { args: [], errorKey: "startupArgsArrayError" };
    }
    return { args: parsed, errorKey: "" };
  } catch {
    return { args: [], errorKey: "startupArgsJsonError" };
  }
}

function buildGatewayUrl(settings: DeckGoSettings["managedGateway"]) {
  const host = settings?.bindHost?.trim() || "127.0.0.1";
  const port = Number(settings?.bindPort) || 18789;
  return `ws://${host}:${port}`;
}

function deviceName(device: Pick<PairedDevice | PendingDeviceRequest, "deviceId" | "displayName">) {
  return device.displayName || device.deviceId.slice(0, 8);
}

function deviceRoles(device: Pick<PairedDevice | PendingDeviceRequest, "role" | "roles">) {
  return device.roles?.length ? device.roles : device.role ? [device.role] : ["viewer"];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readDeviceStreamPayload(event: { data?: string; json?: unknown }) {
  if (isRecord(event.json)) {
    return event.json;
  }
  if (!event.data) {
    return {};
  }
  try {
    const parsed = JSON.parse(event.data) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function deviceStreamLabel(
  event: { event?: string; data?: string; json?: unknown },
  labels: { deviceEvent: string; unknownDevice: string },
) {
  const payload = readDeviceStreamPayload(event);
  const displayName =
    typeof payload.displayName === "string" && payload.displayName.trim()
      ? payload.displayName.trim()
      : typeof payload.deviceId === "string" && payload.deviceId.trim()
        ? payload.deviceId.trim()
        : labels.unknownDevice;
  const role = typeof payload.role === "string" && payload.role.trim() ? payload.role.trim() : "";
  return `${event.event ?? labels.deviceEvent}: ${displayName}${role ? ` (${role})` : ""}`;
}

export function SettingsPanel() {
  const t = useTranslations("settings");
  const { bootstrap, runtime, themeMode, refreshRuntimeSummary, setThemeMode } = useDeckUI();
  const [settings, setSettings] = useState<DeckGoSettings>({
    accessToken: "",
    managedGateway: {
      mode: "managed",
      command: "",
      args: [],
      workingDir: "",
      bindHost: "127.0.0.1",
      bindPort: 18789,
      gatewayToken: "",
      autoStart: true,
      env: {},
    },
  });
  const [settingsPath, setSettingsPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastSaved, setLastSaved] = useState<unknown>(null);
  const [versionInfo, setVersionInfo] = useState({ deck: "", gateway: "", cli: "" });
  const [connectionTestState, setConnectionTestState] = useState("idle");
  const [connectionTestResult, setConnectionTestResult] = useState<unknown>(null);
  const [pendingDevices, setPendingDevices] = useState<PendingDeviceRequest[]>([]);
  const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>([]);
  const [selfDeviceId, setSelfDeviceId] = useState<string | null>(null);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [deviceActionState, setDeviceActionState] = useState("idle");
  const [deviceActionResult, setDeviceActionResult] = useState<unknown>(null);
  const [lastDeviceStreamEvent, setLastDeviceStreamEvent] = useState("");
  const [devicesError, setDevicesError] = useState("");
  const [managedGatewayArgsText, setManagedGatewayArgsText] = useState("[]");
  const [managedGatewayArgsError, setManagedGatewayArgsError] = useState("");

  const refreshSettings = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchSettings();
      const normalized = normalizeSettings(result);
      setSettings(normalized);
      setManagedGatewayArgsText(formatArgsText(normalized.managedGateway?.args));
      setManagedGatewayArgsError("");
      setSettingsPath(result.path);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("loadSettingsFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);

  const refreshVersion = useCallback(async () => {
    try {
      const result = await fetchSettingsVersion();
      setVersionInfo({
        deck: result.deck ?? "",
        gateway: result.gateway ?? "",
        cli: result.cli ?? "",
      });
    } catch {
      setVersionInfo({ deck: "", gateway: "", cli: "" });
    }
  }, []);

  useEffect(() => {
    void refreshVersion();
  }, [refreshVersion]);

  const refreshDevices = useCallback(async () => {
    setDevicesLoading(true);
    try {
      const [devices, self] = await Promise.all([
        fetchDevices(),
        fetchSelfDevice().catch(() => ({ deviceId: null })),
      ]);
      setPendingDevices(devices.pending ?? []);
      setPairedDevices(devices.paired ?? []);
      setSelfDeviceId(self.deviceId ?? null);
      setDevicesError("");
    } catch (loadError) {
      setDevicesError(loadError instanceof Error ? loadError.message : t("loadDevicesFailed"));
    } finally {
      setDevicesLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refreshDevices();
  }, [refreshDevices]);

  useEffect(() => {
    const controller = new AbortController();
    void streamEvents({
      signal: controller.signal,
      retryDelayMs: 1_000,
      onEvent(event) {
        if (event.event !== "device.pair.requested" && event.event !== "device.pair.resolved") {
          return;
        }
        setLastDeviceStreamEvent(
          deviceStreamLabel(event, {
            deviceEvent: t("deviceEvent"),
            unknownDevice: t("unknownDevice"),
          }),
        );
        void refreshDevices();
      },
    }).catch(() => {});
    return () => controller.abort();
  }, [refreshDevices, t]);

  const updateManagedGateway = (patch: Partial<NonNullable<DeckGoSettings["managedGateway"]>>) => {
    setSettings((current) => ({
      ...current,
      managedGateway: {
        ...current.managedGateway,
        ...patch,
      },
    }));
  };

  const onSave = async () => {
    if (managedGatewayArgsError) {
      setError(managedGatewayArgsError);
      return;
    }

    setSaving(true);
    try {
      const result = await saveSettings(settings);
      persistAccessToken(settings.accessToken ?? "");
      setLastSaved(result);
      await refreshSettings();
      await refreshRuntimeSummary();
      setError("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("saveSettingsFailed"));
    } finally {
      setSaving(false);
    }
  };

  const onTestConnection = async () => {
    setConnectionTestState("testing");
    setConnectionTestResult(null);
    const url = buildGatewayUrl(settings.managedGateway);
    try {
      const result = await testSettingsConnection(url, settings.managedGateway?.gatewayToken ?? "");
      setConnectionTestResult({ url, ...result });
      setError("");
    } catch (testError) {
      setConnectionTestResult({
        url,
        ok: false,
        error: testError instanceof Error ? testError.message : t("connectionTestFailed"),
      });
    } finally {
      setConnectionTestState("idle");
    }
  };

  const runDeviceAction = async (
    confirmMessage: string,
    actionName: string,
    action: () => Promise<unknown>,
  ) => {
    if (!window.confirm(confirmMessage)) {
      return;
    }
    setDeviceActionState(actionName);
    try {
      const result = await action();
      setDeviceActionResult(result ?? { ok: true });
      await refreshDevices();
      setDevicesError("");
    } catch (actionError) {
      setDevicesError(actionError instanceof Error ? actionError.message : t("deviceActionFailed"));
    } finally {
      setDeviceActionState("idle");
    }
  };

  const activeRuntimeUrl = runtime?.runtime.gatewayUrl || t("notResolved");
  const configuredProbeUrl = buildGatewayUrl(settings.managedGateway);

  return (
    <section className="deckgo-panel-workspace deck-ui-settings">
      <div className="deckgo-column deckgo-panel-main deck-ui-settings-column">
        <article className="deckgo-card is-float deck-ui-settings-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("localSettingsTitle")}</h2>
          </div>
          <p className="deckgo-card-subtitle">{t("localSettingsDescription")}</p>
          <div className="deckgo-card-body deckgo-form-grid deck-ui-settings-body">
            <div className="deckgo-pill-row deck-ui-settings-status-row">
              <span className={`deckgo-pill ${loading ? "is-muted" : "is-positive"}`}>
                {t("settingsStatus", { status: loading ? t("loading") : t("ready") })}
              </span>
              <span
                className={`deckgo-pill ${bootstrap?.gateway.connected ? "is-positive" : "is-muted"}`}
              >
                {t("gatewayStatus", {
                  status: bootstrap?.gateway.connected ? t("linked") : t("pending"),
                })}
              </span>
              <span className="deckgo-pill">
                {t("runtimeStatus", { status: runtime?.runtime.status || t("idle") })}
              </span>
            </div>

            <label className="deckgo-label deck-ui-settings-label">
              <span>{t("deckAccessToken")}</span>
              <input
                className="deckgo-input deck-ui-settings-input"
                type="password"
                autoComplete="new-password"
                value={settings.accessToken ?? ""}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, accessToken: event.target.value }))
                }
              />
            </label>

            <div className="deckgo-form-row deck-ui-settings-form-row">
              <label className="deckgo-label deck-ui-settings-label">
                <span>{t("managedGatewayCommand")}</span>
                <input
                  className="deckgo-input deck-ui-settings-input"
                  value={settings.managedGateway?.command ?? ""}
                  onChange={(event) => updateManagedGateway({ command: event.target.value })}
                />
              </label>
              <label className="deckgo-label deck-ui-settings-label">
                <span>{t("workingDir")}</span>
                <input
                  className="deckgo-input deck-ui-settings-input"
                  value={settings.managedGateway?.workingDir ?? ""}
                  onChange={(event) => updateManagedGateway({ workingDir: event.target.value })}
                />
              </label>
              <label className="deckgo-label deck-ui-settings-label">
                <span>{t("gatewayToken")}</span>
                <input
                  className="deckgo-input deck-ui-settings-input"
                  type="password"
                  autoComplete="new-password"
                  value={settings.managedGateway?.gatewayToken ?? ""}
                  onChange={(event) => updateManagedGateway({ gatewayToken: event.target.value })}
                />
              </label>
            </div>

            <div className="deckgo-form-row deck-ui-settings-form-row">
              <label className="deckgo-label deck-ui-settings-label">
                <span>{t("bindHost")}</span>
                <input
                  className="deckgo-input deck-ui-settings-input"
                  value={settings.managedGateway?.bindHost ?? ""}
                  onChange={(event) => updateManagedGateway({ bindHost: event.target.value })}
                />
              </label>
              <label className="deckgo-label deck-ui-settings-label">
                <span>{t("bindPort")}</span>
                <input
                  className="deckgo-input deck-ui-settings-input"
                  type="number"
                  value={settings.managedGateway?.bindPort ?? 18789}
                  onChange={(event) =>
                    updateManagedGateway({ bindPort: Number(event.target.value) || 18789 })
                  }
                />
              </label>
              <label className="deckgo-label deck-ui-settings-label">
                <span>{t("runtimeEndpoint")}</span>
                <input
                  className="deckgo-input deck-ui-settings-input"
                  value={activeRuntimeUrl}
                  readOnly
                />
              </label>
            </div>

            <label className="deckgo-label deck-ui-settings-label">
              <span>{t("startupArgs")}</span>
              <input
                className="deckgo-input deck-ui-settings-input"
                value={managedGatewayArgsText}
                placeholder='["openclaw","gateway","run"]'
                aria-invalid={managedGatewayArgsError ? true : undefined}
                onChange={(event) => {
                  const nextText = event.target.value;
                  const parsed = parseArgsText(nextText);
                  setManagedGatewayArgsText(nextText);
                  setManagedGatewayArgsError(parsed.errorKey ? t(parsed.errorKey) : "");
                  if (!parsed.errorKey) {
                    updateManagedGateway({ args: parsed.args });
                  }
                }}
              />
              {managedGatewayArgsError ? (
                <span role="alert" className="deckgo-note deck-ui-settings-error">
                  {managedGatewayArgsError}
                </span>
              ) : null}
            </label>

            <label className="deckgo-label deck-ui-settings-label">
              <span>{t("managedGatewayEnvironment")}</span>
              <textarea
                className="deckgo-textarea deck-ui-settings-textarea"
                rows={5}
                value={formatEnvLines(settings.managedGateway?.env)}
                onChange={(event) =>
                  updateManagedGateway({
                    env: parseEnvLines(event.target.value),
                  })
                }
                placeholder="NO_PROXY=localhost,127.0.0.1"
              />
            </label>

            <label className="deckgo-checkbox-row deck-ui-settings-check">
              <input
                type="checkbox"
                checked={settings.managedGateway?.autoStart ?? true}
                onChange={(event) => updateManagedGateway({ autoStart: event.target.checked })}
              />
              <span>{t("autoStartManagedGateway")}</span>
            </label>

            <div className="deckgo-surface-tile deck-ui-settings-surface">
              <p className="deckgo-surface-label">{t("connectionProbe")}</p>
              <strong>{configuredProbeUrl}</strong>
              <p className="deckgo-note">{t("connectionProbeDescription")}</p>
            </div>

            <div className="deckgo-actions deck-ui-settings-actions">
              <button
                className="deckgo-button deck-ui-settings-button is-primary"
                type="button"
                disabled={saving || Boolean(managedGatewayArgsError)}
                onClick={() => void onSave()}
              >
                {saving ? t("savingSettings") : t("saveSettings")}
              </button>
              <button
                className="deckgo-button deck-ui-settings-button"
                type="button"
                onClick={() => void refreshSettings()}
              >
                {t("refreshSettings")}
              </button>
              <button
                className="deckgo-button deck-ui-settings-button"
                type="button"
                onClick={() => void refreshRuntimeSummary()}
              >
                {t("refreshRuntime")}
              </button>
              <button
                className="deckgo-button deck-ui-settings-button"
                type="button"
                onClick={() => void onTestConnection()}
                disabled={connectionTestState !== "idle"}
              >
                {connectionTestState === "testing" ? t("testingConnection") : t("testConnection")}
              </button>
            </div>

            <div className="deckgo-surface-tile deck-ui-settings-surface">
              <p className="deckgo-surface-label">{t("settingsFile")}</p>
              <strong>{settingsPath || t("notLoadedYet")}</strong>
              <p className="deckgo-note">
                {t("managedSettingsSummary", {
                  autoStart: settings.managedGateway?.autoStart ? "true" : "false",
                  mode: settings.managedGateway?.mode || "managed",
                })}
              </p>
            </div>

            {error ? <p className="deckgo-note deck-ui-settings-error">{error}</p> : null}
          </div>
        </article>
      </div>

      <aside className="deckgo-column deck-ui-settings-column">
        <article className="deckgo-card deck-ui-settings-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("appearance")}</h2>
          </div>
          <div className="deckgo-card-body deck-ui-settings-body deck-ui-settings-side-body">
            <p className="deckgo-note">{t("themeLocalDescription")}</p>
            <div className="deckgo-actions deck-ui-settings-actions">
              <button
                className={`deckgo-button deck-ui-settings-button ${themeMode === "dark" ? "is-primary" : ""}`}
                type="button"
                onClick={() => setThemeMode("dark")}
              >
                {t("themeDark")}
              </button>
              <button
                className={`deckgo-button deck-ui-settings-button ${themeMode === "light" ? "is-primary" : ""}`}
                type="button"
                onClick={() => setThemeMode("light")}
              >
                {t("themeLight")}
              </button>
              <button
                className={`deckgo-button deck-ui-settings-button ${themeMode === "system" ? "is-primary" : ""}`}
                type="button"
                onClick={() => setThemeMode("system")}
              >
                {t("themeSystem")}
              </button>
            </div>
          </div>
        </article>

        <article className="deckgo-card deck-ui-settings-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("settingsSummary")}</h2>
          </div>
          <div className="deckgo-card-body deck-ui-settings-body deck-ui-settings-side-body">
            <p className="deckgo-note">
              {t("summaryAccessTokenConfigured", {
                value: settings.accessToken ? t("yes") : t("no"),
              })}
            </p>
            <p className="deckgo-note">
              {t("summaryCommandConfigured", {
                value: settings.managedGateway?.command ? t("yes") : t("no"),
              })}
            </p>
            <p className="deckgo-note">
              {t("summaryGatewayTokenConfigured", {
                value: settings.managedGateway?.gatewayToken ? t("yes") : t("no"),
              })}
            </p>
            <p className="deckgo-note">{t("summaryRuntimeUrl", { value: activeRuntimeUrl })}</p>
            <p className="deckgo-note">
              {t("summaryDeckVersion", { value: versionInfo.deck || t("notAvailable") })}
            </p>
            <p className="deckgo-note">
              {t("summaryGatewayVersion", { value: versionInfo.gateway || t("notAvailable") })}
            </p>
            <p className="deckgo-note">
              {t("summaryCliVersion", { value: versionInfo.cli || t("notAvailable") })}
            </p>
            <div className="deckgo-actions deck-ui-settings-actions">
              <a
                className="deckgo-button deck-ui-settings-button"
                href="https://docs.openclaw.ai"
                rel="noopener noreferrer"
                target="_blank"
              >
                {t("openDocs")}
              </a>
              <a
                className="deckgo-button deck-ui-settings-button"
                href="https://github.com/openclaw/openclaw"
                rel="noopener noreferrer"
                target="_blank"
              >
                {t("openGitHub")}
              </a>
            </div>
          </div>
        </article>

        {connectionTestResult ? (
          <article className="deckgo-card deck-ui-settings-card">
            <div className="deckgo-card-header">
              <h2 className="deckgo-card-title">{t("connectionTestResult")}</h2>
            </div>
            <div className="deckgo-card-body deck-ui-settings-body">
              <JsonDetails title={t("settingsConnectionResult")} payload={connectionTestResult} />
            </div>
          </article>
        ) : null}

        {lastSaved ? (
          <article className="deckgo-card deck-ui-settings-card">
            <div className="deckgo-card-header">
              <h2 className="deckgo-card-title">{t("lastSaveResult")}</h2>
            </div>
            <div className="deckgo-card-body deck-ui-settings-body">
              <JsonDetails title={t("settingsSaveResult")} payload={lastSaved} />
            </div>
          </article>
        ) : null}

        <article className="deckgo-card deck-ui-settings-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("pairedDevices")}</h2>
          </div>
          <div className="deckgo-card-body deck-ui-settings-body">
            <div className="deckgo-pill-row deck-ui-settings-status-row">
              <span className={`deckgo-pill ${devicesLoading ? "is-muted" : "is-positive"}`}>
                {t("devicesStatus", { status: devicesLoading ? t("loading") : t("ready") })}
              </span>
              <span className="deckgo-pill">
                {t("pendingDevicesCount", { count: pendingDevices.length })}
              </span>
              <span className="deckgo-pill">
                {t("pairedDevicesCount", { count: pairedDevices.length })}
              </span>
            </div>
            <div className="deckgo-actions deck-ui-settings-actions">
              <button
                className="deckgo-button deck-ui-settings-button"
                type="button"
                onClick={() => void refreshDevices()}
                disabled={devicesLoading}
              >
                {t("refreshDevices")}
              </button>
            </div>
            {lastDeviceStreamEvent ? (
              <p className="deckgo-note">
                {t("lastDeviceStreamEvent", { event: lastDeviceStreamEvent })}
              </p>
            ) : null}
            {devicesError ? (
              <p className="deckgo-note deck-ui-settings-error">{devicesError}</p>
            ) : null}

            {pendingDevices.length ? (
              <div className="deckgo-surface-tile deck-ui-settings-surface">
                <p className="deckgo-surface-label">{t("pendingRequests")}</p>
                <ul className="deckgo-shell-list deck-ui-settings-list">
                  {pendingDevices.map((request) => (
                    <li key={request.requestId}>
                      <div className="deckgo-selectable-card deck-ui-settings-row">
                        <strong>{deviceName(request)}</strong>
                        <div className="deckgo-meta">
                          {t("pendingRequestMeta", {
                            requestId: request.requestId,
                            deviceId: request.deviceId,
                            roles: deviceRoles(request).join(", "),
                          })}
                        </div>
                        <div className="deckgo-actions deck-ui-settings-actions">
                          <button
                            className="deckgo-button deck-ui-settings-button is-primary"
                            type="button"
                            onClick={() =>
                              void runDeviceAction(
                                t("confirmApproveDevice", { requestId: request.requestId }),
                                "approving",
                                () => approveDeviceRequest(request.requestId),
                              )
                            }
                            disabled={deviceActionState !== "idle"}
                          >
                            {t("approveRequest")}
                          </button>
                          <button
                            className="deckgo-button deck-ui-settings-button is-danger"
                            type="button"
                            onClick={() =>
                              void runDeviceAction(
                                t("confirmRejectDevice", { requestId: request.requestId }),
                                "rejecting",
                                () => rejectDeviceRequest(request.requestId),
                              )
                            }
                            disabled={deviceActionState !== "idle"}
                          >
                            {t("rejectRequest")}
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {pairedDevices.length ? (
              <ul className="deckgo-shell-list deck-ui-settings-list">
                {pairedDevices.map((device) => {
                  const isSelf = device.deviceId === selfDeviceId;
                  const tokens = device.tokens ?? [];
                  return (
                    <li key={device.deviceId}>
                      <div className="deckgo-selectable-card deck-ui-settings-row">
                        <strong>
                          {deviceName(device)}
                          {isSelf ? ` ${t("thisDeviceSuffix")}` : ""}
                        </strong>
                        <div className="deckgo-meta">
                          {t("pairedDeviceMeta", {
                            deviceId: device.deviceId,
                            roles: deviceRoles(device).join(", "),
                          })}
                        </div>
                        <div className="deckgo-meta">
                          {t("pairedDeviceNetworkMeta", {
                            platform: device.platform ?? t("notAvailable"),
                            ip: device.remoteIp ?? t("notAvailable"),
                          })}
                        </div>
                        {tokens.length ? (
                          <ul className="deckgo-shell-list deck-ui-settings-list deck-ui-settings-token-list">
                            {tokens.map((token) => {
                              const revoked = token.revokedAtMs != null;
                              return (
                                <li key={`${device.deviceId}-${token.role}`}>
                                  <div className="deckgo-surface-tile deck-ui-settings-surface">
                                    <p className="deckgo-surface-label">
                                      {t("tokenStatus", {
                                        role: token.role,
                                        status: revoked ? t("revoked") : t("active"),
                                      })}
                                    </p>
                                    <p className="deckgo-note">
                                      {t("tokenScopes", {
                                        scopes:
                                          (token.scopes ?? []).join(", ") || t("notAvailable"),
                                      })}
                                    </p>
                                    <div className="deckgo-actions deck-ui-settings-actions">
                                      <button
                                        className="deckgo-button deck-ui-settings-button"
                                        type="button"
                                        onClick={() =>
                                          void runDeviceAction(
                                            t("confirmRotateToken", {
                                              role: token.role,
                                              deviceId: device.deviceId,
                                            }),
                                            "rotating",
                                            () => rotateDeviceToken(device.deviceId, token.role),
                                          )
                                        }
                                        disabled={deviceActionState !== "idle" || revoked}
                                      >
                                        {t("rotateToken")}
                                      </button>
                                      <button
                                        className="deckgo-button deck-ui-settings-button is-danger"
                                        type="button"
                                        onClick={() =>
                                          void runDeviceAction(
                                            t("confirmRevokeToken", {
                                              role: token.role,
                                              deviceId: device.deviceId,
                                            }),
                                            "revoking",
                                            () => revokeDeviceToken(device.deviceId, token.role),
                                          )
                                        }
                                        disabled={deviceActionState !== "idle" || revoked || isSelf}
                                      >
                                        {t("revokeToken")}
                                      </button>
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                        <div className="deckgo-actions deck-ui-settings-actions">
                          <button
                            className="deckgo-button deck-ui-settings-button is-danger"
                            type="button"
                            onClick={() =>
                              void runDeviceAction(
                                t("confirmRemoveDevice", { deviceId: device.deviceId }),
                                "removing",
                                () => removeDevice(device.deviceId),
                              )
                            }
                            disabled={deviceActionState !== "idle" || isSelf}
                          >
                            {t("removeDevice")}
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : !devicesLoading ? (
              <p className="deckgo-note deck-ui-settings-empty">{t("noPairedDevices")}</p>
            ) : null}

            {deviceActionResult ? (
              <JsonDetails title={t("lastDeviceAction")} payload={deviceActionResult} />
            ) : null}
          </div>
        </article>
      </aside>
    </section>
  );
}
