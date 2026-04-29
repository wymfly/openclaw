import { useCallback, useEffect, useState } from "react";
import type {
  DeckGoRuntimeEndpointPutRequest,
  DeckGoRuntimeEndpointResponse,
  DeckGoRuntimeEndpointTestRequest,
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
  fetchEndpoint,
  fetchSelfDevice,
  fetchSettings,
  fetchSettingsVersion,
  rejectDeviceRequest,
  removeDevice,
  revokeDeviceToken,
  rotateDeviceToken,
  saveSettings,
  streamEvents,
  testEndpoint,
  updateEndpoint,
} from "../../../api";
import { useDeckUI } from "../../../deck-ui/ui-store";
import { useCapabilities } from "../../../hooks/useCapabilities";
import type { Locale } from "../../../i18n/config";
import { useLocale, useSetLocale, useTranslations } from "../../../i18n/provider";
import { EndpointSection } from "../../runtime/EndpointSection";
import { ReadOnlyField } from "../../runtime/ReadOnlyField";
import { JsonDetails } from "../../shared/ShellComponents";

type PairedDevice = LocalPairedDevice;
type PendingDeviceRequest = LocalPendingDeviceRequest;

const LANGUAGE_OPTIONS: { value: Locale; label: string }[] = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
];

type PendingDeviceAction = {
  title: string;
  description: string;
  confirmLabel: string;
  variant: "default" | "danger";
  actionName: string;
  showToken?: boolean;
  action: () => Promise<unknown>;
};

function normalizeSettings(result: DeckGoSettingsResponse): DeckGoSettings {
  return {
    accessTokenConfigured: result.settings.accessTokenConfigured ?? false,
    accessTokenSource: result.settings.accessTokenSource ?? "",
    appearance: result.settings.appearance,
    notifications: result.settings.notifications,
    pairedDevices: result.settings.pairedDevices,
  };
}

function buildSettingsSavePayload(settings: DeckGoSettings): DeckGoSettings {
  return {
    appearance: settings.appearance,
    notifications: settings.notifications,
    pairedDevices: settings.pairedDevices,
  };
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

function readRotatedToken(result: unknown) {
  if (isRecord(result) && typeof result.token === "string" && result.token.trim()) {
    return result.token;
  }
  return "";
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
  const {
    capabilities,
    loading: capabilitiesLoading,
    refresh: refreshCapabilities,
  } = useCapabilities();
  const locale = useLocale();
  const setLocale = useSetLocale();
  const [settings, setSettings] = useState<DeckGoSettings>({
    accessTokenConfigured: false,
    accessTokenSource: "",
  });
  const [endpoint, setEndpoint] = useState<DeckGoRuntimeEndpointResponse | null>(null);
  const [endpointLoading, setEndpointLoading] = useState(true);
  const [endpointError, setEndpointError] = useState("");
  const [settingsPath, setSettingsPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastSaved, setLastSaved] = useState<unknown>(null);
  const [versionInfo, setVersionInfo] = useState({ deck: "", gateway: "", cli: "" });
  const [pendingDevices, setPendingDevices] = useState<PendingDeviceRequest[]>([]);
  const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>([]);
  const [selfDeviceId, setSelfDeviceId] = useState<string | null>(null);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [deviceActionState, setDeviceActionState] = useState("idle");
  const [deviceActionResult, setDeviceActionResult] = useState<unknown>(null);
  const [pendingDeviceAction, setPendingDeviceAction] = useState<PendingDeviceAction | null>(null);
  const [confirmingDeviceAction, setConfirmingDeviceAction] = useState(false);
  const [deviceActionError, setDeviceActionError] = useState("");
  const [rotatedToken, setRotatedToken] = useState("");
  const [lastDeviceStreamEvent, setLastDeviceStreamEvent] = useState("");
  const [devicesError, setDevicesError] = useState("");

  const refreshSettings = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchSettings();
      const normalized = normalizeSettings(result);
      setSettings(normalized);
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

  const refreshEndpoint = useCallback(async () => {
    setEndpointLoading(true);
    try {
      const result = await fetchEndpoint();
      setEndpoint(result);
      setEndpointError("");
    } catch (loadError) {
      setEndpointError(loadError instanceof Error ? loadError.message : t("loadEndpointFailed"));
    } finally {
      setEndpointLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refreshEndpoint();
  }, [refreshEndpoint]);

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

  const onSave = async () => {
    setSaving(true);
    try {
      const result = await saveSettings(buildSettingsSavePayload(settings));
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

  const saveEndpoint = useCallback(
    async (payload: DeckGoRuntimeEndpointPutRequest) => {
      const result = await updateEndpoint(payload);
      setEndpoint(result);
      await refreshCapabilities();
      await refreshRuntimeSummary();
      return result;
    },
    [refreshCapabilities, refreshRuntimeSummary],
  );

  const testRuntimeEndpoint = useCallback(async (payload?: DeckGoRuntimeEndpointTestRequest) => {
    return testEndpoint(payload);
  }, []);

  const requestDeviceAction = (action: PendingDeviceAction) => {
    setDeviceActionError("");
    setPendingDeviceAction(action);
  };

  const confirmDeviceAction = async () => {
    if (!pendingDeviceAction) {
      return;
    }
    setConfirmingDeviceAction(true);
    setDeviceActionState(pendingDeviceAction.actionName);
    try {
      const result = await pendingDeviceAction.action();
      setDeviceActionResult(result ?? { ok: true });
      const token = pendingDeviceAction.showToken ? readRotatedToken(result) : "";
      if (token) {
        setRotatedToken(token);
      }
      await refreshDevices();
      setPendingDeviceAction(null);
      setDevicesError("");
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : t("deviceActionFailed");
      setDeviceActionError(message);
      setDevicesError(message);
    } finally {
      setDeviceActionState("idle");
      setConfirmingDeviceAction(false);
    }
  };

  const activeRuntimeUrl = runtime?.runtime.gatewayUrl || endpoint?.url || t("notResolved");

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
              {capabilities ? (
                <span className="deckgo-pill">{t("runtimeMode", { mode: capabilities.mode })}</span>
              ) : null}
            </div>

            {capabilities && endpoint ? (
              <EndpointSection
                capabilities={capabilities}
                value={endpoint}
                onSave={saveEndpoint}
                onTest={testRuntimeEndpoint}
              />
            ) : (
              <div className="deckgo-surface-tile deck-ui-settings-surface">
                <p className="deckgo-surface-label">{t("endpointTitle")}</p>
                <p className="deckgo-note">
                  {endpointLoading || capabilitiesLoading
                    ? t("loading")
                    : endpointError || t("notLoadedYet")}
                </p>
              </div>
            )}

            <ReadOnlyField
              badge={t("setViaEnv")}
              label={t("deckAccessToken")}
              value={settings.accessTokenConfigured ? t("configured") : t("notConfigured")}
            />

            <div className="deckgo-actions deck-ui-settings-actions">
              <button
                className="deckgo-button deck-ui-settings-button is-primary"
                type="button"
                disabled={saving}
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
            </div>

            <div className="deckgo-surface-tile deck-ui-settings-surface">
              <p className="deckgo-surface-label">{t("settingsFile")}</p>
              <strong>{settingsPath || t("notLoadedYet")}</strong>
              <p className="deckgo-note">
                {t("runtimeSettingsSummary", {
                  configured: capabilities?.configured ? "true" : "false",
                  mode: capabilities?.mode || t("notAvailable"),
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
            <p className="deckgo-note">{t("languageLocalDescription")}</p>
            <div className="deckgo-actions deck-ui-settings-actions">
              {LANGUAGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`deckgo-button deck-ui-settings-button ${locale === option.value ? "is-primary" : ""}`}
                  type="button"
                  onClick={() => setLocale(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </article>

        <article className="deckgo-card deck-ui-settings-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("notifications")}</h2>
          </div>
          <div className="deckgo-card-body deck-ui-settings-body deck-ui-settings-side-body">
            <p className="deckgo-note">{t("notificationPreferencesUnavailable")}</p>
            <div className="deckgo-surface-tile deck-ui-settings-surface">
              <p className="deckgo-surface-label">{t("notificationScope")}</p>
              <strong>{t("notifyApprovals")}</strong>
              <p className="deckgo-note">{t("notifyApprovalsDesc")}</p>
            </div>
            <div className="deckgo-surface-tile deck-ui-settings-surface">
              <p className="deckgo-surface-label">{t("notificationScope")}</p>
              <strong>{t("notifyBudget")}</strong>
              <p className="deckgo-note">{t("notifyBudgetDesc")}</p>
            </div>
            <div className="deckgo-surface-tile deck-ui-settings-surface">
              <p className="deckgo-surface-label">{t("notificationScope")}</p>
              <strong>{t("notifyAlerts")}</strong>
              <p className="deckgo-note">{t("notifyAlertsDesc")}</p>
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
                value: settings.accessTokenConfigured ? t("yes") : t("no"),
              })}
            </p>
            <p className="deckgo-note">
              {t("summaryRuntimeMode", {
                value: capabilities?.mode || t("notAvailable"),
              })}
            </p>
            <p className="deckgo-note">
              {t("summaryEndpointConfigured", {
                value: capabilities?.configured ? t("yes") : t("no"),
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
                              requestDeviceAction({
                                title: t("approveRequest"),
                                description: t("confirmApproveDevice", {
                                  requestId: request.requestId,
                                }),
                                confirmLabel: t("approveRequest"),
                                variant: "default",
                                actionName: "approving",
                                action: () => approveDeviceRequest(request.requestId),
                              })
                            }
                            disabled={deviceActionState !== "idle"}
                          >
                            {t("approveRequest")}
                          </button>
                          <button
                            className="deckgo-button deck-ui-settings-button is-danger"
                            type="button"
                            onClick={() =>
                              requestDeviceAction({
                                title: t("rejectRequest"),
                                description: t("confirmRejectDevice", {
                                  requestId: request.requestId,
                                }),
                                confirmLabel: t("rejectRequest"),
                                variant: "danger",
                                actionName: "rejecting",
                                action: () => rejectDeviceRequest(request.requestId),
                              })
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
                                          requestDeviceAction({
                                            title: t("rotateToken"),
                                            description: t("confirmRotateToken", {
                                              role: token.role,
                                              deviceId: device.deviceId,
                                            }),
                                            confirmLabel: t("rotateToken"),
                                            variant: "default",
                                            actionName: "rotating",
                                            showToken: true,
                                            action: () =>
                                              rotateDeviceToken(device.deviceId, token.role),
                                          })
                                        }
                                        disabled={deviceActionState !== "idle" || revoked}
                                      >
                                        {t("rotateToken")}
                                      </button>
                                      <button
                                        className="deckgo-button deck-ui-settings-button is-danger"
                                        type="button"
                                        onClick={() =>
                                          requestDeviceAction({
                                            title: t("revokeToken"),
                                            description: t("confirmRevokeToken", {
                                              role: token.role,
                                              deviceId: device.deviceId,
                                            }),
                                            confirmLabel: t("revokeToken"),
                                            variant: "danger",
                                            actionName: "revoking",
                                            action: () =>
                                              revokeDeviceToken(device.deviceId, token.role),
                                          })
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
                              requestDeviceAction({
                                title: t("removeDevice"),
                                description: t("confirmRemoveDevice", {
                                  deviceId: device.deviceId,
                                }),
                                confirmLabel: t("removeDevice"),
                                variant: "danger",
                                actionName: "removing",
                                action: () => removeDevice(device.deviceId),
                              })
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

      {pendingDeviceAction ? (
        <div
          aria-modal="true"
          className="deck-ui-settings-modal-backdrop"
          role="dialog"
          aria-labelledby="deck-ui-settings-confirm-title"
        >
          <article className="deck-ui-settings-modal deck-ui-settings-confirm-dialog">
            <header className="deck-ui-settings-modal-header">
              <h2 id="deck-ui-settings-confirm-title">{pendingDeviceAction.title}</h2>
              <button
                aria-label={t("closeDialog")}
                className="deckgo-button deck-ui-settings-button"
                type="button"
                disabled={confirmingDeviceAction}
                onClick={() => setPendingDeviceAction(null)}
              >
                {t("close")}
              </button>
            </header>
            <p className="deckgo-note">{pendingDeviceAction.description}</p>
            {deviceActionError ? (
              <p className="deckgo-note deck-ui-settings-error">{deviceActionError}</p>
            ) : null}
            <div className="deckgo-actions deck-ui-settings-actions">
              <button
                className="deckgo-button deck-ui-settings-button"
                type="button"
                disabled={confirmingDeviceAction}
                onClick={() => setPendingDeviceAction(null)}
              >
                {t("cancel")}
              </button>
              <button
                className={`deckgo-button deck-ui-settings-button ${
                  pendingDeviceAction.variant === "danger" ? "is-danger" : "is-primary"
                }`}
                type="button"
                disabled={confirmingDeviceAction}
                onClick={() => void confirmDeviceAction()}
              >
                {confirmingDeviceAction ? t("working") : pendingDeviceAction.confirmLabel}
              </button>
            </div>
          </article>
        </div>
      ) : null}

      {rotatedToken ? (
        <div
          aria-modal="true"
          className="deck-ui-settings-modal-backdrop"
          role="dialog"
          aria-labelledby="deck-ui-settings-token-title"
        >
          <article className="deck-ui-settings-modal deck-ui-settings-token-dialog">
            <header className="deck-ui-settings-modal-header">
              <h2 id="deck-ui-settings-token-title">{t("tokenGenerated")}</h2>
              <button
                aria-label={t("closeDialog")}
                className="deckgo-button deck-ui-settings-button"
                type="button"
                onClick={() => setRotatedToken("")}
              >
                {t("close")}
              </button>
            </header>
            <p className="deckgo-note">{t("tokenWarning")}</p>
            <pre className="deckgo-code deck-ui-settings-token-value">{rotatedToken}</pre>
            <div className="deckgo-actions deck-ui-settings-actions">
              <button
                className="deckgo-button deck-ui-settings-button"
                type="button"
                onClick={() => void navigator.clipboard?.writeText(rotatedToken)}
              >
                {t("copyToken")}
              </button>
              <button
                className="deckgo-button deck-ui-settings-button is-primary"
                type="button"
                onClick={() => setRotatedToken("")}
              >
                {t("close")}
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
