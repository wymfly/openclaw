"use client";

import {
  Bot,
  Brain,
  ChevronDown,
  ChevronRight,
  FileText,
  Globe,
  Lock,
  RefreshCw,
  Server,
  Share2,
  Webhook,
  Wrench,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentType } from "react";
import { useState } from "react";
import { SECTION_META } from "@/lib/section-metadata";
import { useConfigStore } from "@/stores/config";

/** Static icon map — matches SECTION_META.icon strings to lucide components */
const ICON_MAP: Record<string, ComponentType<{ size?: number }>> = {
  Bot,
  Brain,
  FileText,
  Globe,
  Lock,
  RefreshCw,
  Server,
  Share2,
  Webhook,
  Wrench,
};

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
 * Enhanced with section icons, field count badges, and advanced field indicators.
 */
export function SectionNav({ sections, activeSection, onSelect }: SectionNavProps) {
  const t = useTranslations("config");
  const schema = useConfigStore((s) => s.schema);
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

  /** Count configurable fields for a given section from the schema */
  const getFieldCount = (section: string): number | null => {
    if (!schema) return null;
    const props = schema.properties as Record<string, Record<string, unknown>> | undefined;
    if (!props) return null;
    const sectionSchema = props[section];
    if (!sectionSchema) return null;
    const sectionProps = sectionSchema.properties as Record<string, unknown> | undefined;
    if (!sectionProps) return null;
    return Object.keys(sectionProps).length;
  };

  const handleExpand = async (section: string) => {
    const isCurrentlyExpanded = expanded[section];
    setExpanded((prev) => ({ ...prev, [section]: !isCurrentlyExpanded }));

    // Only fetch when expanding and we haven't loaded children yet
    if (!isCurrentlyExpanded && !sectionChildren[section]) {
      const result = await lookupSchema(section);
      if (
        result &&
        typeof result === "object" &&
        Array.isArray((result as { children?: unknown }).children)
      ) {
        setSectionChildren((prev) => ({
          ...prev,
          [section]: (result as { children: ChildEntry[] }).children,
        }));
      }
    }
  };

  return (
    <nav
      className="flex flex-col w-48 shrink-0 border-r h-full overflow-y-auto"
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

        // Look up icon from SECTION_META
        const meta = SECTION_META[section];
        const Icon = meta ? ICON_MAP[meta.icon] : undefined;
        const fieldCount = getFieldCount(section);

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
                className="flex-1 flex items-center gap-1.5 text-left px-3 py-2 text-xs transition-colors"
                style={{
                  color: isActive ? "var(--primary)" : "var(--foreground)",
                }}
              >
                {Icon && <Icon size={13} />}
                <span className="flex-1 truncate">{label}</span>
                {fieldCount != null && (
                  <span
                    className="text-[10px] px-1 rounded-sm shrink-0"
                    style={{
                      backgroundColor: isActive
                        ? "color-mix(in srgb, var(--primary) 20%, transparent)"
                        : "var(--muted)",
                      color: isActive ? "var(--primary)" : "var(--muted-foreground)",
                    }}
                  >
                    {fieldCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => handleExpand(section)}
                className="px-1 py-2 text-xs transition-colors"
                style={{ color: "var(--muted-foreground)" }}
                aria-label={t("section")}
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
