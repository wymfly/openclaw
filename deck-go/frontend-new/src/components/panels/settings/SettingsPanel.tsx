import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  DeckGoRuntimeEndpointPutRequest,
  DeckGoRuntimeEndpointResponse,
  DeckGoRuntimeEndpointTestRequest,
  DeckGoRuntimeEndpointTestResponse,
  DeckGoSettings,
  DeckGoSettingsResponse,
} from "../../../../../contracts/generated/ts/deck-api.generated";
import type {
  DeckGoPairedDevice as LocalPairedDevice,
  DeckGoPendingDeviceRequest as LocalPendingDeviceRequest,
} from "../../../api";
import {
  useDeviceActionMutations,
  useDevicePairingProjectionSubscription,
  useDevicesQuery,
  useRuntimeEndpointQuery,
  useSaveSettingsMutation,
  useSelfDeviceQuery,
  useSettingsQuery,
  useSettingsVersionQuery,
  useTestEndpointMutation,
  useUpdateEndpointMutation,
} from "../../../data/modules/settings";
import { useDeckUI } from "../../../deck-ui/ui-store";
import { Badge, Button, Code, Input, Modal, Spinner, Toggle } from "../../../design-system/atoms";
import { useCapabilities } from "../../../hooks/useCapabilities";
import type { Locale } from "../../../i18n/config";
import { useLocale, useSetLocale, useTranslations } from "../../../i18n/provider";
import { EndpointSection } from "../../runtime/EndpointSection";
import { ReadOnlyField } from "../../runtime/ReadOnlyField";
import { JsonDetails } from "../../shared/ShellComponents";
import "./settings-panel.css";

type PairedDevice = LocalPairedDevice;
type PendingDeviceRequest = LocalPendingDeviceRequest;

type SettingsSectionId =
  | "identity"
  | "runtime"
  | "appearance"
  | "notifications"
  | "devices"
  | "version";

type SectionDef = {
  id: SettingsSectionId;
  labelKey: string;
  descriptionKey: string;
};

type PendingDeviceAction = {
  title: string;
  description: string;
  confirmLabel: string;
  variant: "default" | "danger";
  actionName: string;
  showToken?: boolean;
  action: () => Promise<unknown>;
};

const LANGUAGE_OPTIONS: { value: Locale; label: string }[] = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
];

const SECTIONS: SectionDef[] = [
  {
    id: "identity",
    labelKey: "sectionIdentity",
    descriptionKey: "sectionIdentityDescription",
  },
  {
    id: "runtime",
    labelKey: "sectionRuntime",
    descriptionKey: "sectionRuntimeDescription",
  },
  {
    id: "appearance",
    labelKey: "sectionAppearance",
    descriptionKey: "sectionAppearanceDescription",
  },
  {
    id: "notifications",
    labelKey: "sectionNotifications",
    descriptionKey: "sectionNotificationsDescription",
  },
  {
    id: "devices",
    labelKey: "sectionDevices",
    descriptionKey: "sectionDevicesDescription",
  },
  {
    id: "version",
    labelKey: "sectionVersion",
    descriptionKey: "sectionVersionDescription",
  },
];

const DEFAULT_APPEARANCE: Record<string, unknown> = {
  density: "compact",
  fontSize: 14,
  reducedMotion: false,
  theme: "system",
};

const DEFAULT_NOTIFICATIONS: Record<string, unknown> = {
  desktop: true,
  quietHoursEnabled: false,
  quietHoursEnd: "08:00",
  quietHoursStart: "22:00",
  sound: false,
};

function normalizeSettings(result: DeckGoSettingsResponse): DeckGoSettings {
  return {
    accessTokenConfigured: result.settings.accessTokenConfigured ?? false,
    accessTokenSource: result.settings.accessTokenSource ?? "",
    appearance: {
      ...DEFAULT_APPEARANCE,
      ...(isRecord(result.settings.appearance) ? result.settings.appearance : {}),
    },
    notifications: {
      ...DEFAULT_NOTIFICATIONS,
      ...(isRecord(result.settings.notifications) ? result.settings.notifications : {}),
    },
    pairedDevices: Array.isArray(result.settings.pairedDevices)
      ? result.settings.pairedDevices
      : [],
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

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readyVariant(loading: boolean) {
  return loading ? "running" : "ok";
}

function connectionVariant(connected: boolean | undefined) {
  return connected ? "ok" : "neutral";
}

function stable(value: unknown) {
  return JSON.stringify(value ?? null);
}

function countChangedKeys(
  left: Record<string, unknown> | undefined,
  right: Record<string, unknown> | undefined,
) {
  const keys = new Set([...Object.keys(left ?? {}), ...Object.keys(right ?? {})]);
  let changed = 0;
  for (const key of keys) {
    if (stable(left?.[key]) !== stable(right?.[key])) {
      changed += 1;
    }
  }
  return changed;
}

function useDirtyBySection(baseline: DeckGoSettings, draft: DeckGoSettings) {
  return useMemo(() => {
    const next: Partial<Record<SettingsSectionId, number>> = {};
    const appearance = countChangedKeys(baseline.appearance, draft.appearance);
    const notifications = countChangedKeys(baseline.notifications, draft.notifications);
    if (appearance > 0) {
      next.appearance = appearance;
    }
    if (notifications > 0) {
      next.notifications = notifications;
    }
    if (stable(baseline.pairedDevices) !== stable(draft.pairedDevices)) {
      next.devices = 1;
    }
    return next;
  }, [baseline, draft]);
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
  const settingsQuery = useSettingsQuery();
  const endpointQuery = useRuntimeEndpointQuery();
  const versionQuery = useSettingsVersionQuery();
  const devicesQuery = useDevicesQuery();
  const selfDeviceQuery = useSelfDeviceQuery();
  const saveSettingsMutation = useSaveSettingsMutation();
  const updateEndpointMutation = useUpdateEndpointMutation();
  const testEndpointMutation = useTestEndpointMutation();
  const deviceActionMutations = useDeviceActionMutations();
  const locale = useLocale();
  const setLocale = useSetLocale();
  const [baselineSettings, setBaselineSettings] = useState<DeckGoSettings>({
    accessTokenConfigured: false,
    accessTokenSource: "",
    appearance: { ...DEFAULT_APPEARANCE },
    notifications: { ...DEFAULT_NOTIFICATIONS },
    pairedDevices: [],
  });
  const [draftSettings, setDraftSettings] = useState(baselineSettings);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("identity");
  const [sectionQuery, setSectionQuery] = useState("");
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
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [accessTokenDialogOpen, setAccessTokenDialogOpen] = useState(false);
  const deviceActions = useMemo(
    () => ({
      approve: (requestId: string) => deviceActionMutations.approve.mutateAsync(requestId),
      reject: (requestId: string) => deviceActionMutations.reject.mutateAsync(requestId),
      remove: (deviceId: string) => deviceActionMutations.remove.mutateAsync(deviceId),
      revokeToken: (deviceId: string, role: string) =>
        deviceActionMutations.revokeToken.mutateAsync({ deviceId, role }),
      rotateToken: (deviceId: string, role: string) =>
        deviceActionMutations.rotateToken.mutateAsync({ deviceId, role }),
    }),
    [deviceActionMutations],
  );

  const dirtyBySection = useDirtyBySection(baselineSettings, draftSettings);
  const dirtyTotal = Object.values(dirtyBySection).reduce((sum, value) => sum + value, 0);

  const refreshSettings = useCallback(async () => {
    setLoading(true);
    try {
      const result = await settingsQuery.refetch();
      if (!result.data) {
        throw result.error ?? new Error(t("loadSettingsFailed"));
      }
      const normalized = normalizeSettings(result.data);
      setBaselineSettings(normalized);
      setDraftSettings(normalized);
      setSettingsPath(result.data.path);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("loadSettingsFailed"));
    } finally {
      setLoading(false);
    }
  }, [settingsQuery, t]);

  useEffect(() => {
    if (settingsQuery.data) {
      const normalized = normalizeSettings(settingsQuery.data);
      setBaselineSettings(normalized);
      setDraftSettings(normalized);
      setSettingsPath(settingsQuery.data.path);
      setError("");
    }
    if (settingsQuery.error) {
      setError(
        settingsQuery.error instanceof Error
          ? settingsQuery.error.message
          : t("loadSettingsFailed"),
      );
    }
    setLoading(settingsQuery.isLoading);
  }, [settingsQuery.data, settingsQuery.error, settingsQuery.isLoading, t]);

  useEffect(() => {
    if (endpointQuery.data) {
      setEndpoint(endpointQuery.data);
      setEndpointError("");
    }
    if (endpointQuery.error) {
      setEndpointError(
        endpointQuery.error instanceof Error
          ? endpointQuery.error.message
          : t("loadEndpointFailed"),
      );
    }
    setEndpointLoading(endpointQuery.isLoading);
  }, [endpointQuery.data, endpointQuery.error, endpointQuery.isLoading, t]);

  useEffect(() => {
    if (versionQuery.data) {
      setVersionInfo({
        deck: versionQuery.data.deck ?? "",
        gateway: versionQuery.data.gateway ?? "",
        cli: versionQuery.data.cli ?? "",
      });
    } else if (versionQuery.error) {
      setVersionInfo({ deck: "", gateway: "", cli: "" });
    }
  }, [versionQuery.data, versionQuery.error]);

  const refreshDevices = useCallback(async () => {
    setDevicesLoading(true);
    try {
      const [devices, self] = await Promise.all([
        devicesQuery.refetch(),
        selfDeviceQuery.refetch(),
      ]);
      if (!devices.data) {
        throw devices.error ?? new Error(t("loadDevicesFailed"));
      }
      setPendingDevices(devices.data.pending ?? []);
      setPairedDevices(devices.data.paired ?? []);
      setSelfDeviceId(self.data?.deviceId ?? null);
      setDevicesError("");
    } catch (loadError) {
      setDevicesError(loadError instanceof Error ? loadError.message : t("loadDevicesFailed"));
    } finally {
      setDevicesLoading(false);
    }
  }, [devicesQuery, selfDeviceQuery, t]);

  useEffect(() => {
    if (devicesQuery.data) {
      setPendingDevices(devicesQuery.data.pending ?? []);
      setPairedDevices(devicesQuery.data.paired ?? []);
      setDevicesError("");
    }
    if (selfDeviceQuery.data) {
      setSelfDeviceId(selfDeviceQuery.data.deviceId ?? null);
    }
    const loadError = devicesQuery.error ?? selfDeviceQuery.error;
    if (loadError) {
      setDevicesError(loadError instanceof Error ? loadError.message : t("loadDevicesFailed"));
    }
    setDevicesLoading(devicesQuery.isLoading || selfDeviceQuery.isLoading);
  }, [
    devicesQuery.data,
    devicesQuery.error,
    devicesQuery.isLoading,
    selfDeviceQuery.data,
    selfDeviceQuery.error,
    selfDeviceQuery.isLoading,
    t,
  ]);

  const handleDeviceStreamEvent = useCallback(
    (event: { data?: string; event?: string; json?: unknown }) => {
      setLastDeviceStreamEvent(
        deviceStreamLabel(event, {
          deviceEvent: t("deviceEvent"),
          unknownDevice: t("unknownDevice"),
        }),
      );
    },
    [t],
  );

  useDevicePairingProjectionSubscription({
    onDeviceEvent: handleDeviceStreamEvent,
    retryDelayMs: 1_000,
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".settings-nav__search input")?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const filteredSections = useMemo(() => {
    const query = sectionQuery.trim().toLowerCase();
    if (!query) {
      return SECTIONS;
    }
    return SECTIONS.filter((section) => {
      const label = t(section.labelKey).toLowerCase();
      const description = t(section.descriptionKey).toLowerCase();
      return label.includes(query) || description.includes(query) || section.id.includes(query);
    });
  }, [sectionQuery, t]);

  const activeRuntimeUrl = runtime?.runtime.gatewayUrl || endpoint?.url || t("notResolved");
  const activeSectionDef = SECTIONS.find((section) => section.id === activeSection) ?? SECTIONS[0];

  const updateAppearance = (key: string, value: unknown) => {
    setDraftSettings((current) => ({
      ...current,
      appearance: { ...current.appearance, [key]: value },
    }));
  };

  const updateNotification = (key: string, value: unknown) => {
    setDraftSettings((current) => ({
      ...current,
      notifications: { ...current.notifications, [key]: value },
    }));
  };

  const resetDraft = () => {
    setDraftSettings(baselineSettings);
    setSaveDialogOpen(false);
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const result = await saveSettingsMutation.mutateAsync(
        buildSettingsSavePayload(draftSettings),
      );
      const normalized = normalizeSettings({
        ok: result.ok,
        path: settingsPath,
        settings: result.settings,
      });
      setLastSaved(result);
      setBaselineSettings(normalized);
      setDraftSettings(normalized);
      setSaveDialogOpen(false);
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
      const result = await updateEndpointMutation.mutateAsync(payload);
      setEndpoint(result);
      await refreshCapabilities();
      await refreshRuntimeSummary();
      return result;
    },
    [refreshCapabilities, refreshRuntimeSummary, updateEndpointMutation],
  );

  const testRuntimeEndpoint = useCallback(
    async (payload?: DeckGoRuntimeEndpointTestRequest) => {
      return testEndpointMutation.mutateAsync(payload);
    },
    [testEndpointMutation],
  );

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

  const sectionBody =
    activeSection === "identity" ? (
      <IdentitySection
        settings={draftSettings}
        settingsPath={settingsPath}
        onRotate={() => setAccessTokenDialogOpen(true)}
      />
    ) : activeSection === "runtime" ? (
      <RuntimeSection
        activeRuntimeUrl={activeRuntimeUrl}
        capabilities={capabilities}
        capabilitiesLoading={capabilitiesLoading}
        endpoint={endpoint}
        endpointError={endpointError}
        endpointLoading={endpointLoading}
        runtimeStatus={runtime?.runtime.status || t("idle")}
        saveEndpoint={saveEndpoint}
        testRuntimeEndpoint={testRuntimeEndpoint}
      />
    ) : activeSection === "appearance" ? (
      <AppearanceSection
        draftSettings={draftSettings}
        locale={locale}
        setLocale={setLocale}
        setThemeMode={setThemeMode}
        themeMode={themeMode}
        updateAppearance={updateAppearance}
      />
    ) : activeSection === "notifications" ? (
      <NotificationsSection draftSettings={draftSettings} updateNotification={updateNotification} />
    ) : activeSection === "devices" ? (
      <DevicesSection
        deviceActionState={deviceActionState}
        deviceActionResult={deviceActionResult}
        deviceActions={deviceActions}
        devicesError={devicesError}
        devicesLoading={devicesLoading}
        lastDeviceStreamEvent={lastDeviceStreamEvent}
        localPairedDevices={draftSettings.pairedDevices ?? []}
        pairedDevices={pairedDevices}
        pendingDevices={pendingDevices}
        refreshDevices={refreshDevices}
        requestDeviceAction={requestDeviceAction}
        selfDeviceId={selfDeviceId}
      />
    ) : (
      <VersionSection
        activeRuntimeUrl={activeRuntimeUrl}
        capabilitiesMode={capabilities?.mode || t("notAvailable")}
        versionInfo={versionInfo}
      />
    );

  return (
    <section className="settings-panel" data-testid="settings-panel">
      <header className="settings-topbar">
        <div className="settings-topbar__lead">
          <p className="settings-panel__eyebrow">{t("settingsEyebrow")}</p>
          <h2>{t("title")}</h2>
          <p>{t("settingsPrototypeSubtitle", { path: settingsPath || t("notLoadedYet") })}</p>
        </div>
        <div className="settings-topbar__trail">
          <Badge variant={readyVariant(loading)}>
            {t("settingsStatus", { status: loading ? t("loading") : t("ready") })}
          </Badge>
          <Badge variant={readyVariant(devicesLoading)}>
            {t("devicesStatus", { status: devicesLoading ? t("loading") : t("ready") })}
          </Badge>
          {dirtyTotal > 0 ? (
            <Badge variant="warn">{t("unsavedChanges", { count: dirtyTotal })}</Badge>
          ) : (
            <Badge variant={readyVariant(loading)}>{t("allSaved")}</Badge>
          )}
          <Badge variant={connectionVariant(bootstrap?.gateway.connected)}>
            {t("gatewayStatus", {
              status: bootstrap?.gateway.connected ? t("linked") : t("pending"),
            })}
          </Badge>
          <Badge>{t("runtimeStatus", { status: runtime?.runtime.status || t("idle") })}</Badge>
          {loading || devicesLoading || endpointLoading ? (
            <Spinner aria-label={t("loading")} size="sm" />
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="settings-panel__banner" role="status">
          <Badge variant="err">{t("saveSettingsFailed")}</Badge>
          <span>{error}</span>
        </div>
      ) : null}

      <main className="settings-layout">
        <aside className="settings-nav" aria-label={t("settingsSections")}>
          <div className="settings-nav__head">
            <p className="settings-nav__eyebrow">{t("settingsFile")}</p>
            <h3>{t("title")}</h3>
            <span>{settingsPath || t("notLoadedYet")}</span>
          </div>
          <label className="settings-nav__search">
            <span className="settings-panel__sr-only">{t("searchSettings")}</span>
            <Input
              value={sectionQuery}
              placeholder={t("searchSettings")}
              type="search"
              onChange={(event) => setSectionQuery(event.target.value)}
            />
          </label>
          <ul className="settings-nav__list" role="tablist">
            {filteredSections.map((section) => {
              const dirty = dirtyBySection[section.id] ?? 0;
              const selected = activeSection === section.id;
              return (
                <li key={section.id}>
                  <button
                    type="button"
                    className={`settings-nav__item${selected ? " settings-nav__item--on" : ""}`}
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveSection(section.id)}
                  >
                    <span className="settings-nav__icon">
                      {section.id.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="settings-nav__body">
                      <span>{t(section.labelKey)}</span>
                      <small>{t(section.descriptionKey)}</small>
                    </span>
                    {dirty > 0 ? (
                      <span
                        className="settings-nav__dirty"
                        aria-label={t("dirtyCount", { count: dirty })}
                      >
                        {dirty}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
            {filteredSections.length === 0 ? (
              <li className="settings-nav__empty">{t("noSectionsMatch")}</li>
            ) : null}
          </ul>
        </aside>

        <section className="setting-group" aria-labelledby="settings-active-section">
          <header className="setting-group__head">
            <div>
              <p className="setting-group__eyebrow">{t("sectionLabel")}</p>
              <h3 id="settings-active-section">{t(activeSectionDef.labelKey)}</h3>
              <p>{t(activeSectionDef.descriptionKey)}</p>
            </div>
            <div className="setting-group__actions">
              <Button size="sm" disabled={dirtyTotal === 0 || saving} onClick={resetDraft}>
                {t("reset")}
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={dirtyTotal === 0 || saving}
                onClick={() => setSaveDialogOpen(true)}
              >
                {saving ? t("savingSettings") : t("saveWithCount", { count: dirtyTotal })}
              </Button>
            </div>
          </header>
          <div className="setting-group__body">{sectionBody}</div>
          <footer className="setting-group__footer">
            <span>{lastSaved ? t("lastSaveResult") : t("recentSavesUnavailable")}</span>
            <Button size="sm" onClick={() => void refreshSettings()}>
              {t("refreshSettings")}
            </Button>
            <Button size="sm" onClick={() => void refreshRuntimeSummary()}>
              {t("refreshRuntime")}
            </Button>
          </footer>
        </section>
      </main>

      <Modal
        aria-labelledby="settings-save-title"
        className="settings-modal settings-save-dialog"
        dismissOnScrimClick={!saving}
        open={saveDialogOpen}
        onClose={() => {
          if (!saving) {
            setSaveDialogOpen(false);
          }
        }}
        size="md"
      >
        <header className="settings-modal__header">
          <h2 id="settings-save-title">{t("saveDialogTitle")}</h2>
          <Button
            aria-label={t("closeDialog")}
            size="sm"
            disabled={saving}
            onClick={() => setSaveDialogOpen(false)}
          >
            {t("close")}
          </Button>
        </header>
        <p>{t("saveDialogDescription")}</p>
        <ul className="settings-diff-list">
          {Object.entries(dirtyBySection).map(([section, count]) => (
            <li key={section}>
              <code>{section}</code>
              <span>{t("changedFields", { count })}</span>
            </li>
          ))}
        </ul>
        <div className="settings-actions">
          <Button size="sm" disabled={saving} onClick={() => setSaveDialogOpen(false)}>
            {t("cancel")}
          </Button>
          <Button size="sm" variant="primary" disabled={saving} onClick={() => void onSave()}>
            {saving ? t("savingSettings") : t("saveWithCount", { count: dirtyTotal })}
          </Button>
        </div>
      </Modal>

      <Modal
        aria-labelledby="settings-access-token-title"
        className="settings-modal settings-access-token-dialog"
        open={accessTokenDialogOpen}
        onClose={() => setAccessTokenDialogOpen(false)}
        size="md"
      >
        <header className="settings-modal__header">
          <h2 id="settings-access-token-title">{t("accessTokenRotationUnavailable")}</h2>
          <Button
            aria-label={t("closeDialog")}
            size="sm"
            onClick={() => setAccessTokenDialogOpen(false)}
          >
            {t("close")}
          </Button>
        </header>
        <p>{t("accessTokenRotationUnavailableDesc")}</p>
      </Modal>

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

function IdentitySection(props: {
  settings: DeckGoSettings;
  settingsPath: string;
  onRotate: () => void;
}) {
  const t = useTranslations("settings");
  return (
    <div className="settings-section-stack">
      <FieldRow
        label={t("deckAccessToken")}
        hint={
          props.settings.accessTokenSource === "env"
            ? t("accessTokenEnvHint")
            : t("accessTokenJsonHint")
        }
        locked
      >
        <div className="settings-token-field">
          <Input
            aria-label={t("deckAccessToken")}
            readOnly
            value={props.settings.accessTokenConfigured ? "••••••••••••••••" : t("notConfigured")}
          />
          <Button size="sm" onClick={props.onRotate}>
            {t("rotateToken")}
          </Button>
        </div>
      </FieldRow>
      <ReadOnlyField
        badge={props.settings.accessTokenSource || t("notAvailable")}
        label={t("settingsFile")}
        value={props.settingsPath || t("notLoadedYet")}
      />
      <section className="settings-surface">
        <Badge>{t("unsupportedByContract")}</Badge>
        <strong>{t("identityReadOnlyTitle")}</strong>
        <p>{t("identityReadOnlyDescription")}</p>
      </section>
    </div>
  );
}

function RuntimeSection(props: {
  activeRuntimeUrl: string;
  capabilities: ReturnType<typeof useCapabilities>["capabilities"];
  capabilitiesLoading: boolean;
  endpoint: DeckGoRuntimeEndpointResponse | null;
  endpointError: string;
  endpointLoading: boolean;
  runtimeStatus: string;
  saveEndpoint: (
    payload: DeckGoRuntimeEndpointPutRequest,
  ) => Promise<DeckGoRuntimeEndpointResponse>;
  testRuntimeEndpoint: (
    payload?: DeckGoRuntimeEndpointTestRequest,
  ) => Promise<DeckGoRuntimeEndpointTestResponse>;
}) {
  const t = useTranslations("settings");
  return (
    <div className="settings-section-stack">
      <div className="settings-runtime-summary">
        <Metric label={t("runtimeStatus", { status: "" }).trim()} value={props.runtimeStatus} />
        <Metric
          label={t("runtimeMode", { mode: "" }).trim()}
          value={props.capabilities?.mode || t("notAvailable")}
        />
        <Metric label={t("gatewayUrl")} value={props.activeRuntimeUrl} />
      </div>
      {props.capabilities && props.endpoint ? (
        <EndpointSection
          capabilities={props.capabilities}
          value={props.endpoint}
          onSave={props.saveEndpoint}
          onTest={props.testRuntimeEndpoint}
        />
      ) : (
        <section className="settings-surface">
          <Badge>
            {props.capabilitiesLoading || props.endpointLoading ? t("loading") : t("notAvailable")}
          </Badge>
          <strong>{t("endpointTitle")}</strong>
          <p>{props.endpointError || t("notLoadedYet")}</p>
        </section>
      )}
      <section className="settings-surface">
        <Badge>{props.capabilities?.endpointMutable ? t("remoteEditable") : t("readOnly")}</Badge>
        <strong>{t("runtimeOwnershipTitle")}</strong>
        <p>
          {props.capabilities?.endpointMutable
            ? t("remoteRuntimeEditableHint")
            : t("localRuntimeReadOnlyHint")}
        </p>
      </section>
    </div>
  );
}

function AppearanceSection(props: {
  draftSettings: DeckGoSettings;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  setThemeMode: (mode: "system" | "dark" | "light") => void;
  themeMode: "system" | "dark" | "light";
  updateAppearance: (key: string, value: unknown) => void;
}) {
  const t = useTranslations("settings");
  const appearance = props.draftSettings.appearance ?? DEFAULT_APPEARANCE;
  const draftTheme = readString(appearance.theme, props.themeMode);
  const density = readString(appearance.density, "compact");
  const fontSize = readNumber(appearance.fontSize, 14);
  const reducedMotion = readBoolean(appearance.reducedMotion);
  return (
    <div className="settings-section-stack">
      <FieldRow label={t("theme")} hint={t("themeLocalDescription")}>
        <SegmentedButtons
          label={t("theme")}
          options={[
            { label: t("themeSystem"), value: "system" },
            { label: t("themeDark"), value: "dark" },
            { label: t("themeLight"), value: "light" },
          ]}
          value={draftTheme}
          onChange={(value) => {
            props.updateAppearance("theme", value);
            props.setThemeMode(value as "system" | "dark" | "light");
          }}
        />
      </FieldRow>
      <FieldRow label={t("density")} hint={t("densityHint")}>
        <SegmentedButtons
          label={t("density")}
          options={[
            { label: t("densityCompact"), value: "compact" },
            { label: t("densityCozy"), value: "cozy" },
          ]}
          value={density}
          onChange={(value) => props.updateAppearance("density", value)}
        />
      </FieldRow>
      <FieldRow label={t("fontSize")} hint={t("fontSizeHint")}>
        <Input
          className="settings-number-input"
          max={18}
          min={12}
          type="number"
          value={String(fontSize)}
          onChange={(event) => props.updateAppearance("fontSize", Number(event.target.value))}
        />
      </FieldRow>
      <FieldRow label={t("reduceMotion")} hint={t("reduceMotionHint")}>
        <label className="settings-toggle-field">
          <Toggle
            aria-label={t("reduceMotion")}
            checked={reducedMotion}
            onCheckedChange={(value) => props.updateAppearance("reducedMotion", value)}
          />
          <span>{reducedMotion ? t("motionReduced") : t("motionFull")}</span>
        </label>
      </FieldRow>
      <FieldRow label={t("language")} hint={t("languageLocalDescription")}>
        <SegmentedButtons
          label={t("language")}
          options={LANGUAGE_OPTIONS.map((option) => ({
            label: option.label,
            value: option.value,
          }))}
          value={props.locale}
          onChange={(value) => props.setLocale(value as Locale)}
        />
      </FieldRow>
    </div>
  );
}

function NotificationsSection(props: {
  draftSettings: DeckGoSettings;
  updateNotification: (key: string, value: unknown) => void;
}) {
  const t = useTranslations("settings");
  const notifications = props.draftSettings.notifications ?? DEFAULT_NOTIFICATIONS;
  const quietEnabled = readBoolean(notifications.quietHoursEnabled);
  return (
    <div className="settings-section-stack">
      <FieldRow label={t("desktopAlerts")} hint={t("notifyApprovalsDesc")}>
        <SettingsToggle
          checked={readBoolean(notifications.desktop)}
          label={readBoolean(notifications.desktop) ? t("enabled") : t("disabled")}
          onChange={(value) => props.updateNotification("desktop", value)}
        />
      </FieldRow>
      <FieldRow label={t("soundAlerts")} hint={t("notifyBudgetDesc")}>
        <SettingsToggle
          checked={readBoolean(notifications.sound)}
          label={readBoolean(notifications.sound) ? t("enabled") : t("disabled")}
          onChange={(value) => props.updateNotification("sound", value)}
        />
      </FieldRow>
      <FieldRow label={t("quietHours")} hint={t("quietHoursHint")}>
        <SettingsToggle
          checked={quietEnabled}
          label={quietEnabled ? t("enabled") : t("disabled")}
          onChange={(value) => props.updateNotification("quietHoursEnabled", value)}
        />
      </FieldRow>
      {quietEnabled ? (
        <div className="settings-row-pair">
          <FieldRow label={t("quietHoursStart")}>
            <Input
              type="time"
              value={readString(notifications.quietHoursStart, "22:00")}
              onChange={(event) => props.updateNotification("quietHoursStart", event.target.value)}
            />
          </FieldRow>
          <FieldRow label={t("quietHoursEnd")}>
            <Input
              type="time"
              value={readString(notifications.quietHoursEnd, "08:00")}
              onChange={(event) => props.updateNotification("quietHoursEnd", event.target.value)}
            />
          </FieldRow>
        </div>
      ) : null}
      <section className="settings-surface">
        <Badge>{t("unsupportedByContract")}</Badge>
        <strong>{t("notificationDeliveryTitle")}</strong>
        <p>{t("notificationPreferencesUnavailable")}</p>
      </section>
    </div>
  );
}

function DevicesSection(props: {
  deviceActionState: string;
  deviceActionResult: unknown;
  deviceActions: {
    approve: (requestId: string) => Promise<unknown>;
    reject: (requestId: string) => Promise<unknown>;
    remove: (deviceId: string) => Promise<unknown>;
    revokeToken: (deviceId: string, role: string) => Promise<unknown>;
    rotateToken: (deviceId: string, role: string) => Promise<unknown>;
  };
  devicesError: string;
  devicesLoading: boolean;
  lastDeviceStreamEvent: string;
  localPairedDevices: Array<Record<string, unknown>>;
  pairedDevices: PairedDevice[];
  pendingDevices: PendingDeviceRequest[];
  refreshDevices: () => Promise<void>;
  requestDeviceAction: (action: PendingDeviceAction) => void;
  selfDeviceId: string | null;
}) {
  const t = useTranslations("settings");
  return (
    <div className="settings-section-stack">
      <div className="settings-status-row">
        <Badge variant={readyVariant(props.devicesLoading)}>
          {t("devicesStatus", { status: props.devicesLoading ? t("loading") : t("ready") })}
        </Badge>
        <Badge>{t("pendingDevicesCount", { count: props.pendingDevices.length })}</Badge>
        <Badge>{t("pairedDevicesCount", { count: props.pairedDevices.length })}</Badge>
        <Button
          size="sm"
          onClick={() => void props.refreshDevices()}
          disabled={props.devicesLoading}
        >
          {t("refreshDevices")}
        </Button>
      </div>
      {props.lastDeviceStreamEvent ? (
        <p>{t("lastDeviceStreamEvent", { event: props.lastDeviceStreamEvent })}</p>
      ) : null}
      {props.devicesError ? <p className="settings-panel__error">{props.devicesError}</p> : null}
      {props.localPairedDevices.length ? (
        <section className="settings-device-block">
          <h4>{t("localPairedDevices")}</h4>
          <ul className="settings-list">
            {props.localPairedDevices.map((device, index) => {
              const id = readString(device.id, readString(device.deviceId, `local-${index}`));
              const name = readString(device.name, readString(device.displayName, id));
              return (
                <li key={`${id}-${index}`}>
                  <article className="settings-device-row">
                    <div className="settings-row__top">
                      <strong>{name}</strong>
                      <Badge>{t("settingsFile")}</Badge>
                    </div>
                    <p>
                      {t("localPairedDeviceMeta", {
                        id,
                        platform: readString(device.platform, t("notAvailable")),
                        ip: readString(device.ip, readString(device.remoteIp, t("notAvailable"))),
                      })}
                    </p>
                  </article>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {props.pendingDevices.length ? (
        <section className="settings-device-block">
          <h4>{t("pendingRequests")}</h4>
          <ul className="settings-list">
            {props.pendingDevices.map((request) => (
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
                        props.requestDeviceAction({
                          title: t("approveRequest"),
                          description: t("confirmApproveDevice", {
                            requestId: request.requestId,
                          }),
                          confirmLabel: t("approveRequest"),
                          variant: "default",
                          actionName: "approving",
                          action: () => props.deviceActions.approve(request.requestId),
                        })
                      }
                      disabled={props.deviceActionState !== "idle"}
                    >
                      {t("approveRequest")}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() =>
                        props.requestDeviceAction({
                          title: t("rejectRequest"),
                          description: t("confirmRejectDevice", {
                            requestId: request.requestId,
                          }),
                          confirmLabel: t("rejectRequest"),
                          variant: "danger",
                          actionName: "rejecting",
                          action: () => props.deviceActions.reject(request.requestId),
                        })
                      }
                      disabled={props.deviceActionState !== "idle"}
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
      {props.pairedDevices.length ? (
        <section className="settings-device-block">
          <h4>{t("pairedDevices")}</h4>
          <ul className="settings-list">
            {props.pairedDevices.map((device) => {
              const isSelf = device.deviceId === props.selfDeviceId;
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
                                    scopes: (token.scopes ?? []).join(", ") || t("notAvailable"),
                                  })}
                                </p>
                                <div className="settings-actions">
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      props.requestDeviceAction({
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
                                          props.deviceActions.rotateToken(
                                            device.deviceId,
                                            token.role,
                                          ),
                                      })
                                    }
                                    disabled={props.deviceActionState !== "idle" || revoked}
                                  >
                                    {t("rotateToken")}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={() =>
                                      props.requestDeviceAction({
                                        title: t("revokeToken"),
                                        description: t("confirmRevokeToken", {
                                          role: token.role,
                                          deviceId: device.deviceId,
                                        }),
                                        confirmLabel: t("revokeToken"),
                                        variant: "danger",
                                        actionName: "revoking",
                                        action: () =>
                                          props.deviceActions.revokeToken(
                                            device.deviceId,
                                            token.role,
                                          ),
                                      })
                                    }
                                    disabled={
                                      props.deviceActionState !== "idle" || revoked || isSelf
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
                          props.requestDeviceAction({
                            title: t("removeDevice"),
                            description: t("confirmRemoveDevice", {
                              deviceId: device.deviceId,
                            }),
                            confirmLabel: t("removeDevice"),
                            variant: "danger",
                            actionName: "removing",
                            action: () => props.deviceActions.remove(device.deviceId),
                          })
                        }
                        disabled={props.deviceActionState !== "idle" || isSelf}
                      >
                        {t("removeDevice")}
                      </Button>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        </section>
      ) : !props.devicesLoading ? (
        <p className="settings-panel__empty">{t("noPairedDevices")}</p>
      ) : null}
      {props.deviceActionResult ? (
        <JsonDetails title={t("lastDeviceAction")} payload={props.deviceActionResult} />
      ) : null}
    </div>
  );
}

function VersionSection(props: {
  activeRuntimeUrl: string;
  capabilitiesMode: string;
  versionInfo: { deck: string; gateway: string; cli: string };
}) {
  const t = useTranslations("settings");
  return (
    <div className="settings-section-stack">
      <dl className="settings-version-grid">
        <KeyValue label={t("deckVersion")} value={props.versionInfo.deck || t("notAvailable")} />
        <KeyValue
          label={t("gatewayVersion")}
          value={props.versionInfo.gateway || t("notAvailable")}
        />
        <KeyValue label={t("cliVersion")} value={props.versionInfo.cli || t("notAvailable")} />
        <KeyValue label={t("runtimeMode", { mode: "" }).trim()} value={props.capabilitiesMode} />
        <KeyValue label={t("gatewayUrl")} value={props.activeRuntimeUrl} />
      </dl>
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
  );
}

function FieldRow(props: { children: ReactNode; hint?: string; label: string; locked?: boolean }) {
  const t = useTranslations("settings");
  return (
    <div className={`setting-row${props.locked ? " setting-row--locked" : ""}`}>
      <div className="setting-row__head">
        <label className="setting-row__label">{props.label}</label>
        {props.locked ? <Badge>{t("readOnly")}</Badge> : null}
      </div>
      {props.hint ? <p className="setting-row__hint">{props.hint}</p> : null}
      <div className="setting-row__control">{props.children}</div>
    </div>
  );
}

function SegmentedButtons(props: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <div className="settings-segmented" role="radiogroup" aria-label={props.label}>
      {props.options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={props.value === option.value}
          className={`settings-segmented__button${
            props.value === option.value ? " settings-segmented__button--on" : ""
          }`}
          onClick={() => props.onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SettingsToggle(props: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="settings-toggle-field">
      <Toggle aria-label={props.label} checked={props.checked} onCheckedChange={props.onChange} />
      <span>{props.label}</span>
    </label>
  );
}

function Metric(props: { label: string; value: string }) {
  return (
    <article className="settings-metric">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </article>
  );
}

function KeyValue(props: { label: string; value: string }) {
  return (
    <div className="settings-kv">
      <dt>{props.label}</dt>
      <dd>{props.value}</dd>
    </div>
  );
}
