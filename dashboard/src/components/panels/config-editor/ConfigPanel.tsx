"use client";

import { RefreshCw, Save, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useCallback, useState } from "react";
import { parseConfigSearch, filterFields, buildTagIndex } from "@/lib/config-search";
import type { FormField } from "@/lib/schema-parser";
import { parseSchemaSection } from "@/lib/schema-parser";
import { applyUiHints } from "@/lib/ui-hints";
import { useConfigStore } from "@/stores/config";
import { ConflictDialog } from "./ConflictDialog";
import { SchemaForm } from "./SchemaForm";
import { SectionIntroCard } from "./SectionIntroCard";
import { SectionNav } from "./SectionNav";
import { TagFilterPanel } from "./TagFilterPanel";

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
    uiHints,
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

  const [searchQuery, setSearchQuery] = useState("");

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

  // Build tag index from all fields across all sections
  const allSectionFields = useMemo(() => {
    if (!schema) {
      return [] as FormField[];
    }
    const props = schema.properties as Record<string, Record<string, unknown>> | undefined;
    if (!props) {
      return [] as FormField[];
    }

    const all: FormField[] = [];
    for (const sectionKey of Object.keys(props)) {
      const sectionSchema = props[sectionKey];
      if (!sectionSchema || typeof sectionSchema !== "object") {
        continue;
      }
      let fields = parseSchemaSection(sectionSchema);
      if (uiHints) {
        fields = applyUiHints(fields, uiHints, `${sectionKey}.`);
      }
      all.push(...fields);
    }
    return all;
  }, [schema, uiHints]);

  const tagIndex = useMemo(() => buildTagIndex(allSectionFields), [allSectionFields]);
  const parsedSearch = useMemo(() => parseConfigSearch(searchQuery), [searchQuery]);

  const handleToggleTag = useCallback((tag: string) => {
    setSearchQuery((prev) => {
      const parsed = parseConfigSearch(prev);
      const tagToken = `tag:${tag}`;
      if (parsed.tags.includes(tag)) {
        return prev
          .split(/\s+/)
          .filter((t) => t.toLowerCase() !== tagToken.toLowerCase())
          .join(" ")
          .trim();
      }
      return prev ? `${prev} ${tagToken}` : tagToken;
    });
  }, []);

  // Parse config JSON to object for form values
  const configObj = useMemo(() => {
    try {
      return JSON.parse(editedConfig || "{}") as Record<string, unknown>;
    } catch {
      return {} as Record<string, unknown>;
    }
  }, [editedConfig]);

  // Get fields for current section from schema, apply uiHints, then apply search filter
  const currentFields = useMemo(() => {
    if (!schema || !activeSection) {
      return [];
    }
    const props = schema.properties as Record<string, Record<string, unknown>> | undefined;
    if (!props) {
      return [];
    }
    const parts = activeSection.split(".");
    let node: Record<string, unknown> | undefined = props[parts[0]];
    for (let i = 1; i < parts.length && node; i++) {
      const nested = node.properties as Record<string, Record<string, unknown>> | undefined;
      node = nested?.[parts[i]];
    }
    if (!node || typeof node !== "object") {
      return [];
    }
    let fields = parseSchemaSection(node);
    if (uiHints) {
      fields = applyUiHints(fields, uiHints, `${activeSection}.`);
    }
    return filterFields(fields, parsedSearch, `${activeSection}.`);
  }, [schema, activeSection, uiHints, parsedSearch]);

  // Get values for the active section (supports dotted paths)
  const sectionValues = useMemo(() => {
    if (!activeSection) {
      return {};
    }
    const parts = activeSection.split(".");
    let val: unknown = configObj;
    for (const p of parts) {
      if (val && typeof val === "object") {
        val = (val as Record<string, unknown>)[p];
      } else {
        return {};
      }
    }
    return (val as Record<string, unknown>) ?? {};
  }, [configObj, activeSection]);

  const handleFieldChange = useCallback(
    (key: string, value: unknown) => {
      const newConfig = { ...configObj };
      if (activeSection) {
        // Walk into the config object along the section path (supports dotted paths like "agents.main")
        const sectionParts = activeSection.split(".");
        // Deep-clone path to section
        let parent: Record<string, unknown> = newConfig;
        for (let i = 0; i < sectionParts.length; i++) {
          const sp = sectionParts[i];
          const existing = parent[sp];
          parent[sp] =
            typeof existing === "object" && existing !== null
              ? { ...(existing as Record<string, unknown>) }
              : {};
          if (i < sectionParts.length - 1) {
            parent = parent[sp] as Record<string, unknown>;
          }
        }
        const sectionObj = parent[sectionParts[sectionParts.length - 1]] as Record<string, unknown>;

        // Handle nested field keys like "port" or "nested.field"
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
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {t("title")}
          </h2>
          {isDirty && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: "color-mix(in srgb, var(--primary) 15%, transparent)",
                color: "var(--primary)",
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
        {/* Search bar */}
        <div className="flex-1 max-w-xs mx-4 relative">
          <Search
            size={13}
            className="absolute left-2 top-1/2 -translate-y-1/2"
            style={{ color: "var(--muted-foreground)" }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full text-xs rounded pl-7 pr-7 py-1.5"
            style={{
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2"
              style={{ color: "var(--muted-foreground)" }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReload}
            disabled={loading}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:opacity-80 transition-opacity disabled:opacity-40"
            style={{
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              backgroundColor: "var(--background)",
            }}
          >
            <RefreshCw size={12} />
            {t("reload")}
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:opacity-80 transition-opacity disabled:opacity-40"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            <Save size={12} />
            {saving ? t("saving") : t("save")}
          </button>
        </div>
      </div>

      {/* Tag filter chips */}
      <TagFilterPanel
        tags={tagIndex}
        activeTags={parsedSearch.tags}
        onToggleTag={handleToggleTag}
      />

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        {loading && !schema ? (
          <div
            className="flex items-center justify-center w-full"
            style={{ color: "var(--muted-foreground)" }}
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
              {activeSection && <SectionIntroCard sectionKey={activeSection} />}
              {activeSection && currentFields.length === 0 && searchQuery ? (
                <div className="text-xs py-4" style={{ color: "var(--muted-foreground)" }}>
                  {t("noSearchResults")}
                </div>
              ) : (
                activeSection && (
                  <SchemaForm
                    fields={currentFields}
                    values={sectionValues}
                    onChange={handleFieldChange}
                    searchQuery={parsedSearch.text}
                  />
                )
              )}
            </div>
          </>
        )}
      </div>

      {/* Conflict dialog */}
      {conflict && (
        <ConflictDialog
          onReload={handleReload}
          onCancel={() => useConfigStore.setState({ conflict: false, remoteConfig: null })}
        />
      )}
    </div>
  );
}
