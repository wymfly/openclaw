"use client";

import { useTranslations } from "next-intl";
import { ScrollArea } from "@/components/ui/scroll-area";
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

  const KNOWN_SECTIONS: Record<string, string> = {
    gateway: "gateway",
    agents: "agents",
    hooks: "hooks",
    models: "models",
    channels: "channels",
  };

  return (
    <nav className="flex flex-col w-44 shrink-0 border-r border-[var(--border)] h-full bg-[var(--bg-secondary)]">
      <div className="flex items-center px-4 h-10 border-b border-[var(--border-subtle)]">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
          {t("section")}
        </span>
      </div>
      <ScrollArea className="flex-1">
        <div className="px-2 py-1 space-y-0.5">
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
                  "relative w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
                  isActive
                    ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
                )}
              >
                {/* Active indicator */}
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"
                    aria-hidden
                  />
                )}
                {label}
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </nav>
  );
}
