"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect, useMemo, useCallback } from "react";
import { SchemaForm } from "@/components/panels/config-editor/SchemaForm";
import { parseSchemaSection } from "@/lib/schema-parser";
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

  // Sort fields by order hint, then key
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
      // SchemaForm uses dotted keys for nested fields
      const parts = key.split(".");
      if (parts.length === 1) {
        next[key] = value;
      } else {
        // Deep set for nested keys
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

  // Validate required fields (top-level only; nested validation is best-effort)
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
    } catch (err) {
      console.error("[ChannelSchemaSettings] Unexpected save error:", err);
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
