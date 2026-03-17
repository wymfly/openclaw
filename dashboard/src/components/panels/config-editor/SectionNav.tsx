"use client";

import { useTranslations } from "next-intl";

interface SectionNavProps {
  sections: string[];
  activeSection: string | null;
  onSelect: (section: string) => void;
}

/**
 * Sidebar navigation for config sections.
 * Sections are derived from the top-level keys of the config schema.
 */
export function SectionNav({ sections, activeSection, onSelect }: SectionNavProps) {
  const t = useTranslations("config");

  // Map known section keys to translated labels
  const KNOWN_SECTIONS: Record<string, string> = {
    gateway: "gateway",
    agents: "agents",
    hooks: "hooks",
    models: "models",
    channels: "channels",
  };

  return (
    <nav
      className="flex flex-col w-44 shrink-0 border-r h-full overflow-y-auto"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}
    >
      <div
        className="px-3 py-2 text-xs font-semibold border-b"
        style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
      >
        {t("section")}
      </div>
      {sections.map((section) => {
        const isActive = activeSection === section;
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
          <button
            key={section}
            onClick={() => onSelect(section)}
            className="text-left px-3 py-2 text-xs transition-colors"
            style={{
              backgroundColor: isActive
                ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                : "transparent",
              color: isActive ? "var(--accent)" : "var(--text-primary)",
            }}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}
