"use client";

import { Save, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useCallback } from "react";
import { parseSchemaSection } from "@/lib/schema-parser";
import { useConfigStore } from "@/stores/config";
import { ConflictDialog } from "./ConflictDialog";
import { SchemaForm } from "./SchemaForm";
import { SectionNav } from "./SectionNav";

/**
 * Config Editor panel — entry point component.
 * Split: SectionNav (20%) + SchemaForm (80%).
 * Save/Reload buttons in toolbar. "Unsaved changes" indicator.
 */
export function ConfigPanel() {
  const t = useTranslations("config");
  const tc = useTranslations("common");

  const {
    schema,
    editedConfig,
    isDirty,
    saving,
    conflict,
    loading,
    error,
    activeSection,
    fetchSchema,
    fetchConfig,
    setEditedConfig,
    setActiveSection,
    saveConfig,
    reloadConfig,
  } = useConfigStore();

  useEffect(() => {
    void fetchSchema();
    void fetchConfig();
  }, [fetchSchema, fetchConfig]);

  // Navigation guard: warn about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Derive sections from schema top-level keys
  const sections = useMemo(() => {
    if (!schema) {
      return [];
    }
    const props = schema.properties;
    if (props && typeof props === "object") {
      return Object.keys(props as Record<string, unknown>);
    }
    return Object.keys(schema);
  }, [schema]);

  // Auto-select first section
  useEffect(() => {
    if (sections.length > 0 && !activeSection) {
      setActiveSection(sections[0]);
    }
  }, [sections, activeSection, setActiveSection]);

  // Parse config JSON to object for form values
  const configObj = useMemo(() => {
    try {
      return JSON.parse(editedConfig || "{}") as Record<string, unknown>;
    } catch {
      return {} as Record<string, unknown>;
    }
  }, [editedConfig]);

  // Get fields for current section from schema
  const currentFields = useMemo(() => {
    if (!schema || !activeSection) {
      return [];
    }
    const props = schema.properties as Record<string, Record<string, unknown>> | undefined;
    const sectionSchema = props?.[activeSection];
    if (!sectionSchema || typeof sectionSchema !== "object") {
      return [];
    }
    return parseSchemaSection(sectionSchema);
  }, [schema, activeSection]);

  // Get values for the active section
  const sectionValues = useMemo(() => {
    if (!activeSection) {
      return {};
    }
    return (configObj[activeSection] as Record<string, unknown>) ?? {};
  }, [configObj, activeSection]);

  const handleFieldChange = useCallback(
    (key: string, value: unknown) => {
      const newConfig = { ...configObj };
      if (activeSection) {
        const existing = newConfig[activeSection];
        const sectionObj: Record<string, unknown> =
          typeof existing === "object" && existing !== null
            ? { ...(existing as Record<string, unknown>) }
            : {};
        // Handle nested keys like "gateway.port"
        const parts = key.split(".");
        if (parts.length === 1) {
          sectionObj[key] = value;
        } else {
          // Walk the nesting
          let current: Record<string, unknown> = sectionObj;
          for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (typeof current[part] !== "object" || current[part] === null) {
              current[part] = {};
            }
            current[part] = { ...(current[part] as Record<string, unknown>) };
            current = current[part] as Record<string, unknown>;
          }
          current[parts[parts.length - 1]] = value;
        }
        newConfig[activeSection] = sectionObj;
      }
      setEditedConfig(JSON.stringify(newConfig, null, 2));
    },
    [configObj, activeSection, setEditedConfig],
  );

  const handleSave = useCallback(() => {
    void saveConfig();
  }, [saveConfig]);

  const handleReload = useCallback(() => {
    void reloadConfig();
  }, [reloadConfig]);

  return (
    <div
      className="flex flex-col h-full rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {t("title")}
          </h2>
          {isDirty && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: "color-mix(in srgb, var(--accent) 15%, transparent)",
                color: "var(--accent)",
              }}
            >
              {t("unsavedChanges")}
            </span>
          )}
          {error && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: "color-mix(in srgb, var(--status-disconnected) 15%, transparent)",
                color: "var(--status-disconnected)",
              }}
            >
              {error}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReload}
            disabled={loading}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:opacity-80 transition-opacity disabled:opacity-40"
            style={{
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              backgroundColor: "var(--bg-primary)",
            }}
          >
            <RefreshCw size={12} />
            {t("reload")}
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:opacity-80 transition-opacity disabled:opacity-40"
            style={{ backgroundColor: "var(--accent)", color: "#fff" }}
          >
            <Save size={12} />
            {saving ? t("saving") : t("save")}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        {loading && !schema ? (
          <div
            className="flex items-center justify-center w-full"
            style={{ color: "var(--text-secondary)" }}
          >
            <p className="text-sm">{tc("loading")}</p>
          </div>
        ) : (
          <>
            <SectionNav
              sections={sections}
              activeSection={activeSection}
              onSelect={setActiveSection}
            />
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {activeSection && (
                <SchemaForm
                  fields={currentFields}
                  values={sectionValues}
                  onChange={handleFieldChange}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Conflict dialog */}
      {conflict && (
        <ConflictDialog
          onReload={handleReload}
          onCancel={() => useConfigStore.setState({ conflict: false })}
        />
      )}
    </div>
  );
}
