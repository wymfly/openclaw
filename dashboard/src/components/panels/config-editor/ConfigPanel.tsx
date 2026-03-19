"use client";

import { Save, RefreshCw, Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseSchemaSection } from "@/lib/schema-parser";
import { useConfigStore } from "@/stores/config";
import { ConflictDialog } from "./ConflictDialog";
import { SchemaForm } from "./SchemaForm";
import { SectionNav } from "./SectionNav";

/**
 * Config Editor panel — entry point component.
 * Split: SectionNav (sidebar) + SchemaForm (main area).
 * Toolbar with Save/Reload buttons and "Unsaved changes" indicator.
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

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

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

  useEffect(() => {
    if (sections.length > 0 && !activeSection) {
      setActiveSection(sections[0]);
    }
  }, [sections, activeSection, setActiveSection]);

  const configObj = useMemo(() => {
    try {
      return JSON.parse(editedConfig || "{}") as Record<string, unknown>;
    } catch {
      return {} as Record<string, unknown>;
    }
  }, [editedConfig]);

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
        const parts = key.split(".");
        if (parts.length === 1) {
          sectionObj[key] = value;
        } else {
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
    <div className="flex flex-col h-full overflow-hidden rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t("title")}</h2>
          {isDirty && (
            <Badge className="bg-[var(--warning-muted)] text-[var(--warning-muted-text)] border-transparent text-[10px]">
              {t("unsavedChanges")}
            </Badge>
          )}
          {error && (
            <Badge className="bg-[var(--danger-muted)] text-[var(--danger-muted-text)] border-transparent text-[10px]">
              {error}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            onClick={handleReload}
            disabled={loading}
            className="gap-1 transition-colors duration-150"
          >
            <RefreshCw size={12} />
            {t("reload")}
          </Button>
          <Button size="xs" onClick={handleSave} disabled={!isDirty || saving} className="gap-1">
            <Save size={12} />
            {saving ? t("saving") : t("save")}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        {loading && !schema ? (
          <div className="flex flex-col items-center justify-center gap-3 w-full text-[var(--text-secondary)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-tertiary)] ring-1 ring-[var(--border-subtle)]">
              <Settings size={20} className="text-[var(--accent)] animate-pulse" />
            </div>
            <p className="text-sm">{tc("loading")}</p>
          </div>
        ) : (
          <>
            <SectionNav
              sections={sections}
              activeSection={activeSection}
              onSelect={setActiveSection}
            />
            <ScrollArea className="flex-1">
              <div className="px-4 py-3">
                {activeSection && (
                  <SchemaForm
                    fields={currentFields}
                    values={sectionValues}
                    onChange={handleFieldChange}
                  />
                )}
              </div>
            </ScrollArea>
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
