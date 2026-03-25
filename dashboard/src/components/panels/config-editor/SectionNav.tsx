"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useConfigStore } from "@/stores/config";

interface SectionNavProps {
  sections: string[];
  activeSection: string | null;
  onSelect: (section: string) => void;
}

interface ChildEntry {
  key: string;
  path: string;
  type: string;
  required?: boolean;
  hasChildren?: boolean;
  hint?: unknown;
}

/**
 * Sidebar navigation for config sections.
 * Sections are derived from the top-level keys of the config schema.
 * On expand, lazily fetches sub-section children via config.schema.lookup.
 * Falls back to the full schema tree when lookup is unavailable.
 */
export function SectionNav({ sections, activeSection, onSelect }: SectionNavProps) {
  const t = useTranslations("config");
  const lookupSchema = useConfigStore((s) => s.lookupSchema);

  // Track expanded sections and their lazy-loaded children
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sectionChildren, setSectionChildren] = useState<Record<string, ChildEntry[]>>({});

  // Map known section keys to translated labels
  const KNOWN_SECTIONS: Record<string, string> = {
    gateway: "gateway",
    agents: "agents",
    hooks: "hooks",
    models: "models",
    channels: "channels",
  };

  const handleExpand = async (section: string) => {
    const isCurrentlyExpanded = expanded[section];
    setExpanded((prev) => ({ ...prev, [section]: !isCurrentlyExpanded }));

    // Only fetch when expanding and we haven't loaded children yet
    if (!isCurrentlyExpanded && !sectionChildren[section]) {
      const result = await lookupSchema(section);
      if (result && typeof result === "object" && Array.isArray((result as { children?: unknown }).children)) {
        setSectionChildren((prev) => ({
          ...prev,
          [section]: (result as { children: ChildEntry[] }).children,
        }));
      }
      // If result is null (fallback mode), the full schema tree is already rendered via SchemaForm
    }
  };

  return (
    <nav
      className="flex flex-col w-44 shrink-0 border-r h-full overflow-y-auto"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
    >
      <div
        className="px-3 py-2 text-xs font-semibold border-b"
        style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
      >
        {t("section")}
      </div>
      {sections.map((section) => {
        const isActive = activeSection === section;
        const isExpanded = expanded[section] ?? false;
        const children = sectionChildren[section];
        const label = KNOWN_SECTIONS[section]
          ? t(
              KNOWN_SECTIONS[section] as
                | "gateway"
                | "agents"
                | "hooks"
                | "models"
                | "channels"
                | "advanced",
            )
          : section;

        return (
          <div key={section}>
            <div
              className="flex items-center"
              style={{
                backgroundColor: isActive
                  ? "color-mix(in srgb, var(--primary) 12%, transparent)"
                  : "transparent",
              }}
            >
              <button
                onClick={() => onSelect(section)}
                className="flex-1 text-left px-3 py-2 text-xs transition-colors"
                style={{
                  color: isActive ? "var(--primary)" : "var(--foreground)",
                }}
              >
                {label}
              </button>
              <button
                onClick={() => handleExpand(section)}
                className="px-1 py-2 text-xs transition-colors"
                style={{ color: "var(--muted-foreground)" }}
                aria-label={isExpanded ? t("section") : t("section")}
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
            </div>
            {isExpanded && children && children.length > 0 && (
              <div className="pl-4 border-l ml-3" style={{ borderColor: "var(--border)" }}>
                {children.map((child) => {
                  const childPath = child.path ?? `${section}.${child.key}`;
                  const isChildActive = activeSection === childPath;
                  return (
                    <button
                      key={child.key}
                      onClick={() => onSelect(childPath)}
                      className="w-full text-left px-2 py-1.5 text-xs transition-colors"
                      style={{
                        backgroundColor: isChildActive
                          ? "color-mix(in srgb, var(--primary) 8%, transparent)"
                          : "transparent",
                        color: isChildActive ? "var(--primary)" : "var(--muted-foreground)",
                      }}
                    >
                      {child.key}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
