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
import { Badge, Button, Card, Code, Modal, Spinner } from "../../../design-system/atoms";
import { useCapabilities } from "../../../hooks/useCapabilities";
import type { Locale } from "../../../i18n/config";
import { useLocale, useSetLocale, useTranslations } from "../../../i18n/provider";
import { EndpointSection } from "../../runtime/EndpointSection";
import { ReadOnlyField } from "../../runtime/ReadOnlyField";
import { JsonDetails } from "../../shared/ShellComponents";
import "./settings-panel.css";

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

function readyVariant(loading: boolean) {
  return loading ? "running" : "ok";
}

function connectionVariant(connected: boolean | undefined) {
  return connected ? "ok" : "neutral";
}

function MetricTile(props: { hint?: string; label: string; value: string | number }) {
  return (
    <article className="settings-metric">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      {props.hint ? <small>{props.hint}</small> : null}
    </article>
  );
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
    <section className="settings-panel" data-testid="settings-panel">
      <div className="settings-panel__header">
        <div>
          <p className="settings-panel__eyebrow">control plane / settings</p>
          <h2>{t("title")}</h2>
          <p>{t("localSettingsDescription")}</p>
        </div>
        <div className="settings-panel__header-actions">
          <Badge variant={readyVariant(loading)}>
            {t("settingsStatus", { status: loading ? t("loading") : t("ready") })}
          </Badge>
          <Badge variant={connectionVariant(bootstrap?.gateway.connected)}>
            {t("gatewayStatus", {
              status: bootstrap?.gateway.connected ? t("linked") : t("pending"),
            })}
          </Badge>
          <Badge>{t("runtimeStatus", { status: runtime?.runtime.status || t("idle") })}</Badge>
          {loading || devicesLoading ? <Spinner aria-label={t("loading")} size="sm" /> : null}
          <Button size="sm" onClick={() => void refreshRuntimeSummary()}>
            {t("refreshRuntime")}
          </Button>
          <Button size="sm" variant="primary" disabled={saving} onClick={() => void onSave()}>
            {saving ? t("savingSettings") : t("saveSettings")}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="settings-panel__banner" role="status">
          <Badge variant="err">{t("saveSettingsFailed")}</Badge>
          <span>{error}</span>
        </div>
      ) : null}

      <div className="settings-panel__metrics">
        <MetricTile
          label={t("runtimeMode", { mode: capabilities?.mode || t("notAvailable") })}
          value={capabilities?.mode || t("notAvailable")}
          hint={t("summaryEndpointConfigured", {
            value: capabilities?.configured ? t("yes") : t("no"),
          })}
        />
        <MetricTile
          label={t("deckAccessToken")}
          value={settings.accessTokenConfigured ? t("configured") : t("notConfigured")}
          hint={settings.accessTokenSource || t("setViaEnv")}
        />
        <MetricTile
          label={t("pendingRequests")}
          value={pendingDevices.length}
          hint={t("pendingDevicesCount", { count: pendingDevices.length })}
        />
        <MetricTile
          label={t("pairedDevices")}
          value={pairedDevices.length}
          hint={t("pairedDevicesCount", { count: pairedDevices.length })}
        />
        <MetricTile
          label={t("settingsSummary")}
          value={[versionInfo.deck, versionInfo.gateway, versionInfo.cli].filter(Boolean).length}
          hint={t("summaryRuntimeUrl", { value: activeRuntimeUrl })}
        />
      </div>

      <div className="settings-workbench">
        <div className="settings-column">
          <Card className="settings-card settings-endpoint-card" padded={false}>
            <div className="settings-card__header">
              <div>
                <h3>{t("endpointTitle")}</h3>
                <p>{t("endpointDescription")}</p>
              </div>
              {capabilities ? <Badge>{t("runtimeMode", { mode: capabilities.mode })}</Badge> : null}
            </div>
            <div className="settings-card__body">
              {capabilities && endpoint ? (
                <EndpointSection
                  capabilities={capabilities}
                  value={endpoint}
                  onSave={saveEndpoint}
                  onTest={testRuntimeEndpoint}
                />
              ) : (
                <div className="settings-surface">
                  <h3>{t("endpointTitle")}</h3>
                  <p>
                    {endpointLoading || capabilitiesLoading
                      ? t("loading")
                      : endpointError || t("notLoadedYet")}
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Card className="settings-card settings-local-card" padded={false}>
            <div className="settings-card__header">
              <div>
                <h3>{t("localSettingsTitle")}</h3>
                <p>{t("localSettingsDescription")}</p>
              </div>
              <Badge variant={readyVariant(loading)}>{loading ? t("loading") : t("ready")}</Badge>
            </div>
            <div className="settings-card__body">
              <div className="settings-surface">
                <div className="settings-section-heading">
                  <div>
                    <h3>{t("settingsFile")}</h3>
                    <p>{settingsPath || t("notLoadedYet")}</p>
                  </div>
                  <Badge>{t("setViaEnv")}</Badge>
                </div>
                <p>
                  {t("runtimeSettingsSummary", {
                    configured: capabilities?.configured ? "true" : "false",
                    mode: capabilities?.mode || t("notAvailable"),
                  })}
                </p>
              </div>

              <ReadOnlyField
                badge={t("setViaEnv")}
                label={t("deckAccessToken")}
                value={settings.accessTokenConfigured ? t("configured") : t("notConfigured")}
              />

              <div className="settings-actions">
                <Button size="sm" variant="primary" disabled={saving} onClick={() => void onSave()}>
                  {saving ? t("savingSettings") : t("saveSettings")}
                </Button>
                <Button size="sm" onClick={() => void refreshSettings()}>
                  {t("refreshSettings")}
                </Button>
                <Button size="sm" onClick={() => void refreshRuntimeSummary()}>
                  {t("refreshRuntime")}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="settings-card settings-appearance-card" padded={false}>
            <div className="settings-card__header">
              <div>
                <h3>{t("appearance")}</h3>
                <p>{t("themeLocalDescription")}</p>
              </div>
              <Badge>{themeMode}</Badge>
            </div>
            <div className="settings-card__body">
              <div className="settings-actions">
                <Button
                  size="sm"
                  variant={themeMode === "dark" ? "primary" : "secondary"}
                  onClick={() => setThemeMode("dark")}
                >
                  {t("themeDark")}
                </Button>
                <Button
                  size="sm"
                  variant={themeMode === "light" ? "primary" : "secondary"}
                  onClick={() => setThemeMode("light")}
                >
                  {t("themeLight")}
                </Button>
                <Button
                  size="sm"
                  variant={themeMode === "system" ? "primary" : "secondary"}
                  onClick={() => setThemeMode("system")}
                >
                  {t("themeSystem")}
                </Button>
              </div>
              <p>{t("languageLocalDescription")}</p>
              <div className="settings-actions">
                {LANGUAGE_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    size="sm"
                    variant={locale === option.value ? "primary" : "secondary"}
                    onClick={() => setLocale(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <aside className="settings-column">
          <Card className="settings-card settings-notifications-card" padded={false}>
            <div className="settings-card__header">
              <div>
                <h3>{t("notifications")}</h3>
                <p>{t("notificationPreferencesUnavailable")}</p>
              </div>
            </div>
            <div className="settings-card__body">
              {[
                [t("notifyApprovals"), t("notifyApprovalsDesc")],
                [t("notifyBudget"), t("notifyBudgetDesc")],
                [t("notifyAlerts"), t("notifyAlertsDesc")],
              ].map(([title, description]) => (
                <section className="settings-surface" key={title}>
                  <Badge>{t("notificationScope")}</Badge>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </section>
              ))}
            </div>
          </Card>

          <Card className="settings-card settings-diagnostics-card" padded={false}>
            <div className="settings-card__header">
              <div>
                <h3>{t("settingsSummary")}</h3>
                <p>{t("summaryRuntimeUrl", { value: activeRuntimeUrl })}</p>
              </div>
            </div>
            <div className="settings-card__body">
              <div className="settings-surface">
                <p>
                  {t("summaryAccessTokenConfigured", {
                    value: settings.accessTokenConfigured ? t("yes") : t("no"),
                  })}
                </p>
                <p>{t("summaryRuntimeMode", { value: capabilities?.mode || t("notAvailable") })}</p>
                <p>
                  {t("summaryEndpointConfigured", {
                    value: capabilities?.configured ? t("yes") : t("no"),
                  })}
                </p>
                <p>{t("summaryRuntimeUrl", { value: activeRuntimeUrl })}</p>
                <p>{t("summaryDeckVersion", { value: versionInfo.deck || t("notAvailable") })}</p>
                <p>
                  {t("summaryGatewayVersion", {
                    value: versionInfo.gateway || t("notAvailable"),
                  })}
                </p>
                <p>{t("summaryCliVersion", { value: versionInfo.cli || t("notAvailable") })}</p>
              </div>
              <div className="settings-actions">
                <a
                  className="settings-link-button"
                  href="https://docs.openclaw.ai"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {t("openDocs")}
                </a>
                <a
                  className="settings-link-button"
                  href="https://github.com/openclaw/openclaw"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {t("openGitHub")}
                </a>
              </div>
            </div>
          </Card>

          {lastSaved ? (
            <Card className="settings-card settings-result-card" padded={false}>
              <div className="settings-card__header">
                <h3>{t("lastSaveResult")}</h3>
              </div>
              <div className="settings-card__body">
                <JsonDetails title={t("settingsSaveResult")} payload={lastSaved} />
              </div>
            </Card>
          ) : null}

          <Card className="settings-card settings-devices-card" padded={false}>
            <div className="settings-card__header">
              <div>
                <h3>{t("pairedDevices")}</h3>
                <p>{t("devicesStatus", { status: devicesLoading ? t("loading") : t("ready") })}</p>
              </div>
              <Badge variant={readyVariant(devicesLoading)}>
                {t("devicesStatus", { status: devicesLoading ? t("loading") : t("ready") })}
              </Badge>
            </div>
            <div className="settings-card__body">
              <div className="settings-status-row">
                <Badge>{t("pendingDevicesCount", { count: pendingDevices.length })}</Badge>
                <Badge>{t("pairedDevicesCount", { count: pairedDevices.length })}</Badge>
                <Button size="sm" onClick={() => void refreshDevices()} disabled={devicesLoading}>
                  {t("refreshDevices")}
                </Button>
              </div>
              {lastDeviceStreamEvent ? (
                <p>{t("lastDeviceStreamEvent", { event: lastDeviceStreamEvent })}</p>
              ) : null}
              {devicesError ? <p className="settings-panel__error">{devicesError}</p> : null}

              {pendingDevices.length ? (
                <section className="settings-surface">
                  <div className="settings-section-heading">
                    <h3>{t("pendingRequests")}</h3>
                    <Badge variant="warn">{pendingDevices.length}</Badge>
                  </div>
                  <ul className="settings-list">
                    {pendingDevices.map((request) => (
                      <li key={request.requestId}>
                        <article className="settings-device-row">
                          <div className="settings-row__top">
                            <strong>{deviceName(request)}</strong>
                            <Badge variant="warn">{deviceRoles(request).join(", ")}</Badge>
                          </div>
                          <p>
                            {t("pendingRequestMeta", {
                              requestId: request.requestId,
                              deviceId: request.deviceId,
                              roles: deviceRoles(request).join(", "),
                            })}
                          </p>
                          <div className="settings-actions">
                            <Button
                              size="sm"
                              variant="primary"
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
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
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
                            </Button>
                          </div>
                        </article>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {pairedDevices.length ? (
                <ul className="settings-list">
                  {pairedDevices.map((device) => {
                    const isSelf = device.deviceId === selfDeviceId;
                    const tokens = device.tokens ?? [];
                    return (
                      <li key={device.deviceId}>
                        <article className="settings-device-row">
                          <div className="settings-row__top">
                            <strong>
                              {deviceName(device)}
                              {isSelf ? ` ${t("thisDeviceSuffix")}` : ""}
                            </strong>
                            {isSelf ? <Badge variant="ok">{t("thisDeviceSuffix")}</Badge> : null}
                          </div>
                          <p>
                            {t("pairedDeviceMeta", {
                              deviceId: device.deviceId,
                              roles: deviceRoles(device).join(", "),
                            })}
                          </p>
                          <p>
                            {t("pairedDeviceNetworkMeta", {
                              platform: device.platform ?? t("notAvailable"),
                              ip: device.remoteIp ?? t("notAvailable"),
                            })}
                          </p>
                          {tokens.length ? (
                            <ul className="settings-list settings-token-list">
                              {tokens.map((token) => {
                                const revoked = token.revokedAtMs != null;
                                return (
                                  <li key={`${device.deviceId}-${token.role}`}>
                                    <section className="settings-surface settings-token-row">
                                      <div className="settings-row__top">
                                        <strong>
                                          {t("tokenStatus", {
                                            role: token.role,
                                            status: revoked ? t("revoked") : t("active"),
                                          })}
                                        </strong>
                                        <Badge variant={revoked ? "neutral" : "ok"}>
                                          {revoked ? t("revoked") : t("active")}
                                        </Badge>
                                      </div>
                                      <p>
                                        {t("tokenScopes", {
                                          scopes:
                                            (token.scopes ?? []).join(", ") || t("notAvailable"),
                                        })}
                                      </p>
                                      <div className="settings-actions">
                                        <Button
                                          size="sm"
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
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="danger"
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
                                          disabled={
                                            deviceActionState !== "idle" || revoked || isSelf
                                          }
                                        >
                                          {t("revokeToken")}
                                        </Button>
                                      </div>
                                    </section>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : null}
                          <div className="settings-actions">
                            <Button
                              size="sm"
                              variant="danger"
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
                            </Button>
                          </div>
                        </article>
                      </li>
                    );
                  })}
                </ul>
              ) : !devicesLoading ? (
                <p className="settings-panel__empty">{t("noPairedDevices")}</p>
              ) : null}

              {deviceActionResult ? (
                <JsonDetails title={t("lastDeviceAction")} payload={deviceActionResult} />
              ) : null}
            </div>
          </Card>
        </aside>
      </div>

      <Modal
        aria-labelledby="settings-confirm-title"
        className="settings-modal settings-confirm-dialog"
        dismissOnScrimClick={!confirmingDeviceAction}
        open={pendingDeviceAction !== null}
        onClose={() => {
          if (!confirmingDeviceAction) {
            setPendingDeviceAction(null);
          }
        }}
        size="md"
      >
        {pendingDeviceAction ? (
          <>
            <header className="settings-modal__header">
              <h2 id="settings-confirm-title">{pendingDeviceAction.title}</h2>
              <Button
                aria-label={t("closeDialog")}
                size="sm"
                disabled={confirmingDeviceAction}
                onClick={() => setPendingDeviceAction(null)}
              >
                {t("close")}
              </Button>
            </header>
            <p>{pendingDeviceAction.description}</p>
            {deviceActionError ? (
              <p className="settings-panel__error">{deviceActionError}</p>
            ) : null}
            <div className="settings-actions">
              <Button
                size="sm"
                disabled={confirmingDeviceAction}
                onClick={() => setPendingDeviceAction(null)}
              >
                {t("cancel")}
              </Button>
              <Button
                size="sm"
                variant={pendingDeviceAction.variant === "danger" ? "danger" : "primary"}
                disabled={confirmingDeviceAction}
                onClick={() => void confirmDeviceAction()}
              >
                {confirmingDeviceAction ? t("working") : pendingDeviceAction.confirmLabel}
              </Button>
            </div>
          </>
        ) : null}
      </Modal>

      <Modal
        aria-labelledby="settings-token-title"
        className="settings-modal settings-token-dialog"
        open={Boolean(rotatedToken)}
        onClose={() => setRotatedToken("")}
        size="md"
      >
        <header className="settings-modal__header">
          <h2 id="settings-token-title">{t("tokenGenerated")}</h2>
          <Button aria-label={t("closeDialog")} size="sm" onClick={() => setRotatedToken("")}>
            {t("close")}
          </Button>
        </header>
        <p>{t("tokenWarning")}</p>
        <Code
          aria-label={t("tokenGenerated")}
          className="settings-token-value"
          content={rotatedToken}
          language="text"
        />
        <div className="settings-actions">
          <Button size="sm" onClick={() => void navigator.clipboard?.writeText(rotatedToken)}>
            {t("copyToken")}
          </Button>
          <Button size="sm" variant="primary" onClick={() => setRotatedToken("")}>
            {t("close")}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
