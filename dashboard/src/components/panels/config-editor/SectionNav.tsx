"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

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
    <nav className="flex flex-col w-44 shrink-0 border-r border-border h-full overflow-y-auto bg-card">
      <div className="px-3 py-2 text-xs font-semibold border-b border-border text-foreground">
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
            className={cn(
              "text-left px-3 py-2 text-xs transition-colors",
              isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted",
            )}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}
