"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";

const VARIABLE_KEYS = ["agentName", "agentId", "model", "timestamp", "channelId"] as const;

interface PromptVariableInserterProps {
  onInsert: (variable: string) => void;
}

/**
 * Dropdown button that inserts {{variable}} at cursor position.
 */
export function PromptVariableInserter({ onInsert }: PromptVariableInserterProps) {
  const t = useTranslations("agentDetail");
  const [open, setOpen] = useState(false);

  const handleSelect = useCallback(
    (key: string) => {
      onInsert(`{{${key}}}`);
      setOpen(false);
    },
    [onInsert],
  );

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((prev) => !prev)}
        className="text-[10px] h-6 px-2"
      >
        {t("insertVariable")}
        <ChevronDown size={10} className="ml-1" />
      </Button>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-10 min-w-[160px] rounded-md border bg-[var(--popover)] shadow-md">
          {VARIABLE_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => handleSelect(key)}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--accent)] transition-colors"
              style={{ color: "var(--foreground)" }}
            >
              <code className="text-[10px] font-mono text-[var(--primary)]">{`{{${key}}}`}</code>
              <span className="ml-2 text-[var(--muted-foreground)]">{t(`variable.${key}`)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
