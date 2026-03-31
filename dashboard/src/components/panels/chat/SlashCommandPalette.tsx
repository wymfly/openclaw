"use client";

/**
 * Popover command palette displayed above the input when user types `/`.
 * Keyboard events are piped from MessageInput (not global listeners) to avoid conflicts.
 */

import * as icons from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  getSlashCommandCompletions,
  CATEGORY_LABEL_KEYS,
} from "./slash-commands";
import type { SlashCommandDef, SlashCommandCategory } from "./slash-commands";

interface SlashCommandPaletteProps {
  filter: string;
  onSelect: (command: SlashCommandDef) => void;
  onDismiss: () => void;
}

/** Render a lucide icon by kebab-case name. */
function CommandIcon({ name, size = 14 }: { name: string; size?: number }) {
  const pascal = name
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  const Icon = (icons as unknown as Record<string, React.ComponentType<{ size?: number }>>)[pascal];
  if (!Icon) return null;
  return <Icon size={size} />;
}

export function SlashCommandPalette({ filter, onSelect, onDismiss }: SlashCommandPaletteProps) {
  const t = useTranslations("chat");
  const commands = getSlashCommandCompletions(filter);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

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
                onMouseEnter={() => setSelectedIndex(idx)}
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

// Re-export the handleKeyDown type for the parent component
export type { SlashCommandPaletteProps };

/**
 * Helper to create a palette keyboard handler.
 * Usage: const paletteKeyHandler = usePaletteKeyHandler(paletteRef);
 */
export function createPaletteKeyHandler(
  commands: SlashCommandDef[],
  selectedIndex: number,
  setSelectedIndex: (fn: (prev: number) => number) => void,
  onSelect: (cmd: SlashCommandDef) => void,
  onDismiss: () => void,
) {
  return (e: React.KeyboardEvent): boolean => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % commands.length);
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + commands.length) % commands.length);
      return true;
    }
    if (e.key === "Enter" && commands.length > 0) {
      e.preventDefault();
      onSelect(commands[selectedIndex]);
      return true;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onDismiss();
      return true;
    }
    return false;
  };
}
