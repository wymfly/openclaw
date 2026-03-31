"use client";

/**
 * Popover command palette displayed above the input when user types `/`.
 * Keyboard events are piped from MessageInput (not global listeners) to avoid conflicts.
 */

import {
  Plus, RefreshCw, Minimize2, Square, Trash2, Eye,
  Cpu, Brain, Terminal, Zap,
  BookOpen, Download, BarChart2,
  Monitor, X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  getSlashCommandCompletions,
  CATEGORY_LABEL_KEYS,
} from "./slash-commands";
import type { SlashCommandDef, SlashCommandCategory } from "./slash-commands";

interface SlashCommandPaletteProps {
  filter: string;
  /** Controlled selection index — parent owns this state for keyboard/mouse unification. */
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  onSelect: (command: SlashCommandDef) => void;
  onDismiss: () => void;
}

/** Map from kebab-case icon names to lucide components. */
const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  "plus": Plus,
  "refresh-cw": RefreshCw,
  "minimize-2": Minimize2,
  "square": Square,
  "trash-2": Trash2,
  "eye": Eye,
  "cpu": Cpu,
  "brain": Brain,
  "terminal": Terminal,
  "zap": Zap,
  "book-open": BookOpen,
  "download": Download,
  "bar-chart-2": BarChart2,
  "monitor": Monitor,
  "x": X,
};

function CommandIcon({ name, size = 14 }: { name: string; size?: number }) {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon size={size} />;
}

export function SlashCommandPalette({
  filter,
  selectedIndex,
  onSelectedIndexChange,
  onSelect,
  onDismiss,
}: SlashCommandPaletteProps) {
  const t = useTranslations("chat");
  const commands = getSlashCommandCompletions(filter);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Outside-click dismiss
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onDismiss]);

  if (commands.length === 0) return null;

  // Group by category — track current to insert headers
  let currentCategory: SlashCommandCategory | null = null;
  let globalIndex = -1;

  return (
    <div ref={containerRef} className="absolute bottom-full left-0 right-0 mb-1 z-50">
      <div
        ref={listRef}
        className="max-h-64 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--popover)] shadow-lg"
        // Expose handleKeyDown for parent via data attribute or callback
        data-palette-active="true"
      >
        {commands.map((cmd) => {
          globalIndex++;
          const idx = globalIndex;
          const showCategory = cmd.category !== currentCategory;
          if (showCategory) currentCategory = cmd.category;

          return (
            <div key={cmd.name}>
              {showCategory && (
                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  {t(CATEGORY_LABEL_KEYS[cmd.category])}
                </div>
              )}
              <div
                data-index={idx}
                role="option"
                aria-selected={idx === selectedIndex}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs transition-colors",
                  idx === selectedIndex
                    ? "bg-[var(--accent)] text-[var(--foreground)]"
                    : "text-[var(--foreground)] hover:bg-[var(--accent)]",
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(cmd);
                }}
                onMouseEnter={() => onSelectedIndexChange(idx)}
              >
                <span className="text-[var(--muted-foreground)] shrink-0">
                  <CommandIcon name={cmd.icon} />
                </span>
                <span className="font-mono text-[var(--primary)]">/{cmd.name}</span>
                {cmd.args && (
                  <span className="text-[var(--muted-foreground)]">{cmd.args}</span>
                )}
                <span className="ml-auto text-[10px] text-[var(--muted-foreground)] truncate max-w-[200px]">
                  {t(cmd.descriptionKey)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type { SlashCommandPaletteProps };
