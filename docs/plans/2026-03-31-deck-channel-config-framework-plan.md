# Deck Channel Config Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded channel wizards with schema-driven config forms, dynamic channel discovery, and connection probing.

**Architecture:** Reuse existing `SchemaForm` + `schema-parser` + `ui-hints` infrastructure from config-editor. Add channel schema extraction logic to channels store. Add probe support via `channels.status` API with `probe: true`.

**Tech Stack:** React, Zustand, next-intl, existing SchemaForm/FormField/UiHints infra

---

### Task 1: Extend channels store with schema discovery and probe [frontend]

covers: channel-discovery/spec.md > ADDED > Auto-discover installed channels from config schema > Discover core channels
covers: channel-discovery/spec.md > ADDED > Auto-discover installed channels from config schema > Discover plugin channels
covers: channel-discovery/spec.md > ADDED > Channel list shows configuration status > Configured channel
covers: channel-discovery/spec.md > ADDED > Channel list shows configuration status > Unconfigured channel
covers: channel-probe/spec.md > ADDED > Channel probe button triggers active connection test > Probe success
covers: channel-probe/spec.md > ADDED > Channel probe button triggers active connection test > Probe failure
covers: channel-probe/spec.md > ADDED > Channel probe button triggers active connection test > Probe timeout
covers: channel-probe/spec.md > ADDED > Channel probe button triggers active connection test > Probe loading state

**Files:**

- Modify: `dashboard/src/stores/channels.ts`

- [ ] **Step 1: Add schema discovery types and state**

Add to channels store state:

```typescript
// New types
interface ChannelSchemaInfo {
  /** Config path (e.g. "channels.telegram" or "extensions.matrix.channel") */
  configPath: string;
  /** JSON Schema for this channel's config section */
  schema: Record<string, unknown>;
  /** Whether this channel is from a plugin extension */
  isPlugin: boolean;
}

interface ProbeResult {
  status: "success" | "failure" | "timeout";
  latencyMs?: number;
  error?: string;
  probedAt: number;
}

// Add to ChannelsState interface:
channelSchemas: Map<string, ChannelSchemaInfo>;
probeResults: Map<string, ProbeResult>;
probing: Set<string>;

fetchChannelSchemas: () => Promise<void>;
probeChannel: (channelId: string) => Promise<void>;
```

- [ ] **Step 2: Implement fetchChannelSchemas**

```typescript
fetchChannelSchemas: async () => {
  const configStore = useConfigStore.getState();
  if (!configStore.schema) {
    await configStore.fetchSchema();
  }
  const { schema } = useConfigStore.getState();
  if (!schema) return;

  const schemas = new Map<string, ChannelSchemaInfo>();
  const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;

  // Core channels: channels.* (each sub-key is a channel)
  const channelsSection = properties.channels;
  if (channelsSection?.properties) {
    const channelProps = channelsSection.properties as Record<string, Record<string, unknown>>;
    for (const [chId, chSchema] of Object.entries(channelProps)) {
      if (chSchema && typeof chSchema === "object") {
        schemas.set(chId, {
          configPath: `channels.${chId}`,
          schema: chSchema,
          isPlugin: false,
        });
      }
    }
  }

  // Plugin channels: extensions.*.channel
  const extensionsSection = properties.extensions;
  if (extensionsSection?.properties) {
    const extProps = extensionsSection.properties as Record<string, Record<string, unknown>>;
    for (const [extId, extSchema] of Object.entries(extProps)) {
      if (!extSchema?.properties) continue;
      const extChildProps = extSchema.properties as Record<string, Record<string, unknown>>;
      if (extChildProps.channel && typeof extChildProps.channel === "object") {
        schemas.set(extId, {
          configPath: `extensions.${extId}.channel`,
          schema: extChildProps.channel,
          isPlugin: true,
        });
      }
    }
  }

  set({ channelSchemas: schemas });
},
```

- [ ] **Step 3: Implement probeChannel**

```typescript
probeChannel: async (channelId: string) => {
  const probing = new Set(get().probing);
  probing.add(channelId);
  set({ probing });

  try {
    const res = await fetch("/api/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ probe: true }),
    });
    const probeResults = new Map(get().probeResults);

    if (!res.ok) {
      probeResults.set(channelId, {
        status: "failure",
        error: "Failed to probe",
        probedAt: Date.now(),
      });
    } else {
      const data = (await res.json()) as Record<string, unknown>;
      // channels.status returns channelAccounts with probeResult per account
      const accounts = (data.channelAccounts ?? {}) as Record<
        string,
        Record<string, { probeResult?: { ok?: boolean; error?: string; latencyMs?: number } }>
      >;
      const channelAccounts = accounts[channelId];
      if (!channelAccounts) {
        probeResults.set(channelId, {
          status: "failure",
          error: "Channel not found",
          probedAt: Date.now(),
        });
      } else {
        // Aggregate probe results from all accounts
        const results = Object.values(channelAccounts);
        const anyOk = results.some((a) => a.probeResult?.ok);
        const firstError = results.find((a) => a.probeResult?.error)?.probeResult?.error;
        const latency = results.find((a) => a.probeResult?.latencyMs)?.probeResult?.latencyMs;
        probeResults.set(channelId, {
          status: anyOk ? "success" : "failure",
          latencyMs: latency,
          error: anyOk ? undefined : firstError,
          probedAt: Date.now(),
        });
      }
    }

    set({ probeResults });
  } catch {
    const probeResults = new Map(get().probeResults);
    probeResults.set(channelId, {
      status: "timeout",
      error: "Network error or timeout",
      probedAt: Date.now(),
    });
    set({ probeResults });
  } finally {
    const remaining = new Set(get().probing);
    remaining.delete(channelId);
    set({ probing: remaining });
  }
},
```

- [ ] **Step 4: Add initial values for new state**

```typescript
// In create<ChannelsState> initial state:
channelSchemas: new Map(),
probeResults: new Map(),
probing: new Set(),
```

- [ ] **Step 5: Verify types compile**

Run: `cd dashboard && pnpm tsc --noEmit 2>&1 | head -20`
Expected: No new errors from channels.ts changes

---

### Task 2: Add probe API route [frontend]

covers: channel-probe/spec.md > ADDED > Channel probe button triggers active connection test > Probe success

**Files:**

- Create: `dashboard/src/app/api/channels/probe/route.ts`

- [ ] **Step 1: Create the probe API route**

```typescript
/**
 * /api/channels/probe — Trigger channel probe.
 *
 * POST — Calls channels.status with probe: true
 */
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async () => {
  return gatewayRequest("channels.status", { probe: true });
});
```

- [ ] **Step 2: Update probeChannel in store to use dedicated endpoint**

Change the fetch URL in `probeChannel` from `/api/channels` with POST body to `/api/channels/probe`.

```typescript
const res = await fetch("/api/channels/probe", { method: "POST" });
```

---

### Task 3: Create ChannelProbeStatus component [frontend]

covers: channel-probe/spec.md > ADDED > Channel probe button triggers active connection test > Probe success
covers: channel-probe/spec.md > ADDED > Channel probe button triggers active connection test > Probe failure
covers: channel-probe/spec.md > ADDED > Channel probe button triggers active connection test > Probe timeout
covers: channel-probe/spec.md > ADDED > Channel probe button triggers active connection test > Probe loading state

**Files:**

- Create: `dashboard/src/components/panels/channels/ChannelProbeStatus.tsx`

- [ ] **Step 1: Create ChannelProbeStatus component**

```tsx
"use client";

import { Loader2, Wifi, WifiOff, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { useChannelsStore } from "@/stores/channels";

interface ChannelProbeStatusProps {
  channelId: string;
}

export function ChannelProbeStatus({ channelId }: ChannelProbeStatusProps) {
  const t = useTranslations("channels.probe");
  const { probeResults, probing, probeChannel } = useChannelsStore();

  const isProbing = probing.has(channelId);
  const result = probeResults.get(channelId);

  const handleProbe = useCallback(() => {
    if (!isProbing) {
      void probeChannel(channelId);
    }
  }, [channelId, isProbing, probeChannel]);

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleProbe}
        disabled={isProbing}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-opacity hover:opacity-80 disabled:opacity-40"
        style={{
          border: "1px solid var(--border)",
          color: "var(--foreground)",
          backgroundColor: "var(--background)",
        }}
      >
        {isProbing ? (
          <>
            <Loader2 size={12} className="animate-spin" />
            {t("testing")}
          </>
        ) : (
          <>
            <Wifi size={12} />
            {t("testConnection")}
          </>
        )}
      </button>

      {result && !isProbing && (
        <ProbeResultBadge
          status={result.status}
          latencyMs={result.latencyMs}
          error={result.error}
        />
      )}
    </div>
  );
}

function ProbeResultBadge({
  status,
  latencyMs,
  error,
}: {
  status: "success" | "failure" | "timeout";
  latencyMs?: number;
  error?: string;
}) {
  const t = useTranslations("channels.probe");

  const config = {
    success: {
      icon: Wifi,
      color: "var(--status-connected)",
      bg: "color-mix(in srgb, var(--status-connected) 12%, transparent)",
      label: t("success"),
    },
    failure: {
      icon: WifiOff,
      color: "var(--status-disconnected)",
      bg: "color-mix(in srgb, var(--status-disconnected) 12%, transparent)",
      label: t("failure"),
    },
    timeout: {
      icon: Clock,
      color: "var(--warning)",
      bg: "color-mix(in srgb, var(--warning) 12%, transparent)",
      label: t("timeout"),
    },
  }[status];

  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
        style={{ backgroundColor: config.bg, color: config.color }}
      >
        <Icon size={10} />
        {config.label}
        {latencyMs != null && ` (${latencyMs}ms)`}
      </span>
      {error && (
        <span
          className="text-[10px] max-w-48 truncate"
          style={{ color: "var(--muted-foreground)" }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
```

---

### Task 4: Create ChannelSchemaSettings component [frontend]

covers: channel-schema-form/spec.md > ADDED > ChannelSchemaForm generates form from JSON Schema > String field rendering
covers: channel-schema-form/spec.md > ADDED > ChannelSchemaForm generates form from JSON Schema > Enum field rendering
covers: channel-schema-form/spec.md > ADDED > ChannelSchemaForm generates form from JSON Schema > Sensitive field rendering
covers: channel-schema-form/spec.md > ADDED > ChannelSchemaForm generates form from JSON Schema > Boolean field rendering
covers: channel-schema-form/spec.md > ADDED > ChannelSchemaForm generates form from JSON Schema > Unknown type fallback
covers: channel-schema-form/spec.md > ADDED > ChannelSchemaForm respects configUiHints > Field ordering
covers: channel-schema-form/spec.md > ADDED > ChannelSchemaForm respects configUiHints > Section grouping
covers: channel-schema-form/spec.md > ADDED > ChannelSchemaForm respects configUiHints > Help text display
covers: channel-schema-form/spec.md > ADDED > ChannelSchemaForm validates and saves > Required field validation
covers: channel-schema-form/spec.md > ADDED > ChannelSchemaForm validates and saves > Save configuration

**Files:**

- Create: `dashboard/src/components/panels/channels/ChannelSchemaSettings.tsx`
- Modify: `dashboard/src/components/panels/channels/ChannelSettingsTab.tsx`

- [ ] **Step 1: Create ChannelSchemaSettings component**

This wraps the existing SchemaForm with channel-specific schema extraction, validation, and save logic.

```tsx
"use client";

import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useEffect, useMemo, useCallback } from "react";
import { SchemaForm } from "@/components/panels/config-editor/SchemaForm";
import { parseSchemaSection, type FormField } from "@/lib/schema-parser";
import { applyUiHints } from "@/lib/ui-hints";
import { useChannelsStore, type ChannelSchemaInfo } from "@/stores/channels";
import { useConfigStore } from "@/stores/config";

interface ChannelSchemaSettingsProps {
  channelId: string;
  schemaInfo: ChannelSchemaInfo;
}

export function ChannelSchemaSettings({ channelId, schemaInfo }: ChannelSchemaSettingsProps) {
  const t = useTranslations("channels.schemaForm");
  const tc = useTranslations("common");
  const { channelConfig, fetchChannelConfig, saveChannelConfig, channelConfigSaveError } =
    useChannelsStore();
  const uiHints = useConfigStore((s) => s.uiHints);

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [initialValues, setInitialValues] = useState<Record<string, unknown>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Parse schema into FormField[] and apply uiHints
  const fields = useMemo(() => {
    const parsed = parseSchemaSection(schemaInfo.schema);
    if (uiHints) {
      return applyUiHints(parsed, uiHints, `${schemaInfo.configPath}.`);
    }
    return parsed;
  }, [schemaInfo.schema, schemaInfo.configPath, uiHints]);

  // Sort fields by order hint, then alphabetically
  const sortedFields = useMemo(() => {
    return [...fields].sort((a, b) => {
      const orderA = a.order ?? 999;
      const orderB = b.order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.key.localeCompare(b.key);
    });
  }, [fields]);

  // Load channel config on mount
  useEffect(() => {
    setLoaded(false);
    void fetchChannelConfig(channelId).then(() => setLoaded(true));
  }, [channelId, fetchChannelConfig]);

  // Sync store config → local values
  useEffect(() => {
    const cfg = (channelConfig ?? {}) as Record<string, unknown>;
    setValues({ ...cfg });
    setInitialValues({ ...cfg });
    setDirty(false);
    setValidationErrors([]);
  }, [channelConfig]);

  const handleChange = useCallback((key: string, value: unknown) => {
    setValues((prev) => {
      const next = { ...prev };
      // Handle nested keys (e.g. "retry.attempts")
      const parts = key.split(".");
      if (parts.length === 1) {
        next[key] = value;
      } else {
        // Nested set
        let current = next as Record<string, unknown>;
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (!current[part] || typeof current[part] !== "object") {
            current[part] = {};
          }
          current[part] = { ...(current[part] as Record<string, unknown>) };
          current = current[part] as Record<string, unknown>;
        }
        current[parts[parts.length - 1]] = value;
      }
      return next;
    });
    setDirty(true);
    setValidationErrors([]);
  }, []);

  // Validate required fields
  const validate = useCallback((): boolean => {
    const errors: string[] = [];
    for (const field of fields) {
      if (field.required) {
        const val = values[field.key];
        if (val === undefined || val === null || val === "") {
          errors.push(field.label ?? field.key);
        }
      }
    }
    setValidationErrors(errors);
    return errors.length === 0;
  }, [fields, values]);

  const handleSave = useCallback(async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const ok = await saveChannelConfig(channelId, values);
      if (ok) {
        setInitialValues({ ...values });
        setDirty(false);
      }
    } finally {
      setSaving(false);
    }
  }, [channelId, values, validate, saveChannelConfig]);

  const handleReset = useCallback(() => {
    setValues({ ...initialValues });
    setDirty(false);
    setValidationErrors([]);
  }, [initialValues]);

  if (!loaded) {
    return (
      <div className="p-4 text-sm" style={{ color: "var(--muted-foreground)" }}>
        {tc("loading")}
      </div>
    );
  }

  if (sortedFields.length === 0) {
    return (
      <div className="p-4">
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {t("noSchemaFields")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <SchemaForm fields={sortedFields} values={values} onChange={handleChange} />
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="shrink-0 px-4 py-1">
          <p className="text-xs" style={{ color: "var(--destructive)" }}>
            {t("requiredFields")}: {validationErrors.join(", ")}
          </p>
        </div>
      )}

      {/* Save error */}
      {channelConfigSaveError && (
        <div className="shrink-0 px-4 py-1">
          <p className="text-xs" style={{ color: "var(--destructive)" }}>
            {channelConfigSaveError}
          </p>
        </div>
      )}

      {/* Save/Reset bar */}
      {dirty && (
        <div
          className="shrink-0 flex items-center justify-end gap-2 px-4 py-2 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={handleReset}
            className="text-xs px-3 py-1 rounded transition-opacity hover:opacity-80"
            style={{
              border: "1px solid var(--border)",
              color: "var(--muted-foreground)",
              backgroundColor: "var(--background)",
            }}
          >
            {tc("cancel")}
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="text-xs px-3 py-1 rounded transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{
              backgroundColor: "var(--primary)",
              color: "var(--primary-foreground)",
            }}
          >
            {saving ? tc("loading") : tc("save")}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Modify ChannelSettingsTab to use ChannelSchemaSettings**

Replace the hardcoded DmPolicy + Retry form with a two-section layout: existing settings (DmPolicy, Retry) + schema-driven fields.

```tsx
// In ChannelSettingsTab.tsx, add after existing imports:
import { ChannelSchemaSettings } from "./ChannelSchemaSettings";
import { useChannelsStore } from "@/stores/channels";

// Inside component, read schema info:
const { channelSchemas } = useChannelsStore();
const schemaInfo = channelSchemas.get(channelId);

// In JSX, after RetryStrategyEditor, add schema form section:
{
  schemaInfo && (
    <div className="pt-4 border-t" style={{ borderColor: "var(--border)" }}>
      <label className="block text-xs font-semibold mb-2" style={{ color: "var(--foreground)" }}>
        {t("schemaConfig")}
      </label>
      <ChannelSchemaSettings channelId={channelId} schemaInfo={schemaInfo} />
    </div>
  );
}
```

- [ ] **Step 3: Verify types compile**

Run: `cd dashboard && pnpm tsc --noEmit 2>&1 | head -20`

---

### Task 5: Enhance ChannelList with discovery metadata [frontend]

covers: channel-discovery/spec.md > ADDED > Auto-discover installed channels from config schema > Discover core channels
covers: channel-discovery/spec.md > ADDED > Auto-discover installed channels from config schema > Discover plugin channels
covers: channel-discovery/spec.md > ADDED > Auto-discover installed channels from config schema > New channel auto-appear
covers: channel-discovery/spec.md > ADDED > Channel list shows configuration status > Configured channel
covers: channel-discovery/spec.md > ADDED > Channel list shows configuration status > Unconfigured channel

**Files:**

- Modify: `dashboard/src/components/panels/channels/ChannelList.tsx`
- Modify: `dashboard/src/components/panels/channels/ChannelsPanel.tsx`

- [ ] **Step 1: Trigger schema discovery on mount**

In `ChannelsPanel.tsx`, add `fetchChannelSchemas` call alongside existing `fetchChannels`:

```tsx
const { selectedId, fetchChannels, fetchChannelSchemas } = useChannelsStore();

useEffect(() => {
  void fetchChannels();
  void fetchChannelSchemas();
}, [fetchChannels, fetchChannelSchemas]);
```

- [ ] **Step 2: Add source badge to ChannelList**

In `ChannelList.tsx`, read `channelSchemas` from store. For each channel, if schema info exists and `isPlugin === true`, show a small "plugin" badge.

```tsx
const { channels, channelOrder, selectedId, loading, selectChannel, channelSchemas } =
  useChannelsStore();

// Inside the channel button JSX, after status indicator:
{
  channelSchemas.get(chId)?.isPlugin && (
    <span
      className="text-[9px] px-1 py-0.5 rounded"
      style={{
        backgroundColor: "var(--purple-muted)",
        color: "var(--purple-muted-text)",
      }}
    >
      {t("plugin")}
    </span>
  );
}
```

- [ ] **Step 3: Show discovered-but-not-configured channels**

Channels from schema discovery that don't appear in `channels.status` response should still be listed as "unconfigured":

```tsx
// After channelOrder.map, add channels discovered from schema but not in channelOrder:
const discoveredIds = Array.from(channelSchemas.keys()).filter(
  (id) => !channelOrder.includes(id) && !channels.has(id),
);

{
  discoveredIds.map((chId) => {
    const schema = channelSchemas.get(chId);
    const isActive = selectedId === chId;
    return (
      <button
        key={chId}
        onClick={() => selectChannel(chId)}
        className="flex items-center justify-between w-full px-3 py-2 text-xs transition-colors"
        style={{
          backgroundColor: isActive
            ? "color-mix(in srgb, var(--primary) 12%, transparent)"
            : "transparent",
          color: isActive ? "var(--primary)" : "var(--foreground)",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Radio size={14} className="shrink-0" />
          <div className="flex flex-col items-start min-w-0">
            <span className="truncate w-full text-left">{chId}</span>
            <div className="flex items-center gap-1">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: "var(--muted-foreground)" }}
              />
              <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                {t("unconfigured")}
              </span>
            </div>
          </div>
        </div>
        {schema?.isPlugin && (
          <span
            className="text-[9px] px-1 py-0.5 rounded"
            style={{ backgroundColor: "var(--purple-muted)", color: "var(--purple-muted-text)" }}
          >
            {t("plugin")}
          </span>
        )}
      </button>
    );
  });
}
```

---

### Task 6: Integrate probe into ChannelDetail [frontend]

covers: channel-probe/spec.md > ADDED > Channel probe button triggers active connection test > Probe success
covers: channel-probe/spec.md > ADDED > Channel probe button triggers active connection test > Probe failure
covers: channel-probe/spec.md > ADDED > Channel probe button triggers active connection test > Probe timeout
covers: channel-probe/spec.md > ADDED > Channel probe button triggers active connection test > Probe loading state

**Files:**

- Modify: `dashboard/src/components/panels/channels/ChannelDetail.tsx`

- [ ] **Step 1: Add probe status to Status tab**

In `ChannelDetail.tsx`, add the `ChannelProbeStatus` component in the Status tab, above the accounts section:

```tsx
import { ChannelProbeStatus } from "./ChannelProbeStatus";

// In the Status TabsContent, at the top of the space-y-4 div:
<div className="pb-3 border-b" style={{ borderColor: "var(--border)" }}>
  <label className="block text-xs font-medium mb-2" style={{ color: "var(--muted-foreground)" }}>
    {t("probe.title")}
  </label>
  <ChannelProbeStatus channelId={channelId} />
</div>;
```

---

### Task 7: Add i18n keys [frontend]

covers: channel-discovery/spec.md > ADDED > Auto-discover installed channels from config schema > Discover core channels
covers: channel-schema-form/spec.md > ADDED > ChannelSchemaForm validates and saves > Required field validation

**Files:**

- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

- [ ] **Step 1: Add Chinese i18n keys**

In `zh.json`, inside the `channels` namespace, add:

```json
"plugin": "插件",
"schemaForm": {
  "noSchemaFields": "此渠道无可配置项。",
  "requiredFields": "以下必填字段未填写",
  "schemaConfig": "渠道配置",
  "editInConfigEditor": "在配置编辑器中编辑"
},
"probe": {
  "title": "连接探测",
  "testConnection": "测试连接",
  "testing": "探测中...",
  "success": "连接成功",
  "failure": "连接失败",
  "timeout": "连接超时"
}
```

- [ ] **Step 2: Add English i18n keys**

In `en.json`, inside the `channels` namespace, add:

```json
"plugin": "Plugin",
"schemaForm": {
  "noSchemaFields": "No configurable fields for this channel.",
  "requiredFields": "Required fields missing",
  "schemaConfig": "Channel Configuration",
  "editInConfigEditor": "Edit in Config Editor"
},
"probe": {
  "title": "Connection Probe",
  "testConnection": "Test Connection",
  "testing": "Probing...",
  "success": "Connected",
  "failure": "Connection Failed",
  "timeout": "Connection Timeout"
}
```

- [ ] **Step 3: Also add settings.schemaConfig key for ChannelSettingsTab**

In both `zh.json` and `en.json`, inside `channels.settings`:

```json
// zh.json channels.settings
"schemaConfig": "渠道参数"

// en.json channels.settings
"schemaConfig": "Channel Parameters"
```

---

### Task 8: Verification [frontend]

- [ ] **Step 1: Run TypeScript type check**

Run: `cd dashboard && pnpm tsc --noEmit 2>&1 | grep -c "error TS"` (excluding pre-existing wecom errors)
Expected: 0 new errors

- [ ] **Step 2: Verify dark mode compatibility**

All new components use CSS variables from the design system (var(--\*)), no hardcoded colors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/stores/channels.ts \
  dashboard/src/app/api/channels/probe/route.ts \
  dashboard/src/components/panels/channels/ChannelProbeStatus.tsx \
  dashboard/src/components/panels/channels/ChannelSchemaSettings.tsx \
  dashboard/src/components/panels/channels/ChannelSettingsTab.tsx \
  dashboard/src/components/panels/channels/ChannelList.tsx \
  dashboard/src/components/panels/channels/ChannelsPanel.tsx \
  dashboard/src/components/panels/channels/ChannelDetail.tsx \
  dashboard/src/i18n/zh.json \
  dashboard/src/i18n/en.json
git commit -m "[enhanced] feat(channels): schema-driven config forms, channel discovery, connection probe"
```

---

## Requirement Coverage Matrix

| Spec Requirement                                | Task                                            |
| ----------------------------------------------- | ----------------------------------------------- |
| channel-discovery > Discover core channels      | Task 1, 5                                       |
| channel-discovery > Discover plugin channels    | Task 1, 5                                       |
| channel-discovery > New channel auto-appear     | Task 5                                          |
| channel-discovery > Configured channel status   | Task 1, 5                                       |
| channel-discovery > Unconfigured channel status | Task 1, 5                                       |
| channel-probe > Probe success                   | Task 1, 2, 3, 6                                 |
| channel-probe > Probe failure                   | Task 1, 3, 6                                    |
| channel-probe > Probe timeout                   | Task 1, 3, 6                                    |
| channel-probe > Probe loading state             | Task 3, 6                                       |
| channel-schema-form > String field rendering    | Task 4 (via SchemaForm)                         |
| channel-schema-form > Enum field rendering      | Task 4 (via SchemaForm)                         |
| channel-schema-form > Sensitive field rendering | Task 4 (via SchemaForm+PasswordField)           |
| channel-schema-form > Boolean field rendering   | Task 4 (via SchemaForm)                         |
| channel-schema-form > Unknown type fallback     | Task 4 (SchemaForm falls back to JSON textarea) |
| channel-schema-form > Field ordering            | Task 4 (via applyUiHints order)                 |
| channel-schema-form > Section grouping          | Task 4 (via SchemaForm group support)           |
| channel-schema-form > Help text display         | Task 4 (via FieldHelpPopover)                   |
| channel-schema-form > Required field validation | Task 4                                          |
| channel-schema-form > Save configuration        | Task 4 (via saveChannelConfig)                  |
