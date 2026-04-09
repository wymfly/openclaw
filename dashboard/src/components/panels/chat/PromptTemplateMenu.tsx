"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

interface PromptTemplateMenuProps {
  onSelect: (template: string) => void;
}

interface TemplateEntry {
  key: string;
  icon: string;
}

const TEMPLATES: TemplateEntry[] = [
  { key: "templateAnalyze", icon: "🔍" },
  { key: "templateExplain", icon: "💡" },
  { key: "templateWrite", icon: "✍️" },
  { key: "templateDebug", icon: "🐛" },
  { key: "templateSummarize", icon: "📋" },
];

/**
 * A small button + dropdown menu that lets users quickly insert
 * predefined prompt templates into the chat input.
 */
export function PromptTemplateMenu({ onSelect }: PromptTemplateMenuProps) {
  const t = useTranslations("chat");
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded hover:opacity-80 transition-opacity shrink-0"
        style={{ color: "var(--muted-foreground)" }}
        title={t("promptTemplates")}
      >
        <Sparkles size={16} />
      </button>
      {open && (
        <div
          className="absolute bottom-full left-0 mb-1 w-64 rounded-lg border shadow-lg z-30"
          style={{
            backgroundColor: "var(--popover)",
            borderColor: "var(--border)",
          }}
        >
          <div className="px-2 py-1.5 text-[10px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
            {t("promptTemplates")}
          </div>
          {TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.key}
              type="button"
              onClick={() => {
                onSelect(t(tmpl.key));
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left hover:bg-[var(--accent)] transition-colors"
              style={{ color: "var(--foreground)" }}
            >
              <span>{tmpl.icon}</span>
              <span className="truncate">{t(tmpl.key)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
