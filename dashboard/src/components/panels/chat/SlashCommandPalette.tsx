"use client";

/**
 * Popover command palette displayed above the input when user types `/`.
 * Keyboard events are piped from MessageInput (not global listeners) to avoid conflicts.
 *
 * Supports mixed-source groups: local categories, Skills, Plugins, and a "More" section
 * for remote built-in commands (collapsed by default).
 */

import {
  Plus,
  RefreshCw,
  Minimize2,
  Square,
  Trash2,
  Eye,
  Cpu,
  Brain,
  Terminal,
  Zap,
  BookOpen,
  Download,
  BarChart2,
  Monitor,
  X,
  Sparkles,
  Plug2,
  TerminalSquare,
  ChevronRight,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { commandRegistry } from "@/lib/command-registry";
import type { CommandSource, CommandVisibilityContext } from "@/lib/command-types";
import { cn } from "@/lib/utils";
import { CATEGORY_LABEL_KEYS } from "./slash-commands";

interface PaletteCommand {
  name: string;
  descriptionKey: string;
  description?: string;
  args?: string;
  icon: string;
  category: string;
  argOptions?: string[];
  source: CommandSource;
}

interface SlashCommandPaletteProps {
  filter: string;
  /** Controlled selection index — parent owns this state for keyboard/mouse unification. */
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  onSelect: (command: PaletteCommand) => void;
  onDismiss: () => void;
  /** Context for visibility filtering — commands with visibleIf predicates are hidden when the predicate returns false. */
  visibilityContext?: CommandVisibilityContext;
}

/** Map from kebab-case icon names to lucide components. */
const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  plus: Plus,
  "refresh-cw": RefreshCw,
  "minimize-2": Minimize2,
  square: Square,
  "trash-2": Trash2,
  eye: Eye,
  cpu: Cpu,
  brain: Brain,
  terminal: Terminal,
  zap: Zap,
  "book-open": BookOpen,
  download: Download,
  "bar-chart-2": BarChart2,
  monitor: Monitor,
  x: X,
  sparkles: Sparkles,
  plug: Plug2,
  "terminal-square": TerminalSquare,
};

/** Default icons per source when no specific icon is set. */
const SOURCE_DEFAULT_ICONS: Record<string, string> = {
  skill: "sparkles",
  plugin: "plug",
  builtin: "terminal-square",
};

function CommandIcon({ name, source, size = 14 }: { name?: string; source?: string; size?: number }) {
  const iconName = name || (source ? SOURCE_DEFAULT_ICONS[source] : undefined);
  if (!iconName) return null;
  const Icon = ICON_MAP[iconName];
  if (!Icon) return null;
  return <Icon size={size} />;
}

export function SlashCommandPalette({
  filter,
  selectedIndex,
  onSelectedIndexChange,
  onSelect,
  onDismiss,
  visibilityContext,
}: SlashCommandPaletteProps) {
  const t = useTranslations("chat");
  const allCommands = commandRegistry.filter(filter);
  // Apply visibility filtering — commands with visibleIf predicates are hidden
  // when the predicate returns false. Manual input bypasses this (user can still type /stop).
  const registryCommands = visibilityContext
    ? allCommands.filter((cmd) => !cmd.visibleIf || cmd.visibleIf(visibilityContext))
    : allCommands;
  const commands: PaletteCommand[] = registryCommands.map((cmd) => ({
    name: cmd.name,
    descriptionKey: cmd.descriptionKey ?? "",
    description: cmd.description,
    args: cmd.args,
    icon: cmd.icon ?? "",
    category: cmd.category,
    argOptions: cmd.argOptions,
    source: cmd.source,
  }));

  const [moreExpanded, setMoreExpanded] = useState(false);
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

  if (commands.length === 0) {
    // Show "no matching commands" hint when searching
    if (filter.length > 0) {
      return (
        <div ref={containerRef} className="absolute bottom-full left-0 right-0 mb-1 z-50">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--popover)] shadow-lg px-3 py-2 text-xs text-[var(--muted-foreground)]">
            {t("noMatchingCommands")}
          </div>
        </div>
      );
    }
    return null;
  }

  // Split commands into display groups
  const localCategories = ["session", "model", "tools", "agents"];
  const localCommands = commands.filter((c) => localCategories.includes(c.category));
  const skillCommands = commands.filter((c) => c.category === "skills");
  const pluginCommands = commands.filter((c) => c.category === "plugins");
  const moreCommands = commands.filter(
    (c) => !localCategories.includes(c.category) && c.category !== "skills" && c.category !== "plugins",
  );

  const hasFilter = filter.length > 0;
  // When searching, show all results flat (no "More" collapse)
  const showMoreCollapsed = !hasFilter && moreCommands.length > 0;

  let globalIndex = -1;

  function renderCommand(cmd: PaletteCommand) {
    globalIndex++;
    const idx = globalIndex;
    return (
      <div
        key={`${cmd.source}:${cmd.name}`}
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
          <CommandIcon name={cmd.icon || undefined} source={cmd.source} />
        </span>
        <span className="font-mono text-[var(--primary)]">/{cmd.name}</span>
        {cmd.args && <span className="text-[var(--muted-foreground)]">{cmd.args}</span>}
        <span className="ml-auto text-[10px] text-[var(--muted-foreground)] truncate max-w-[200px]">
          {cmd.descriptionKey ? t(cmd.descriptionKey) : cmd.description ?? ""}
        </span>
      </div>
    );
  }

  function renderCategoryHeader(category: string) {
    const labelKey = CATEGORY_LABEL_KEYS[category];
    if (!labelKey) return null;
    return (
      <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
        {t(labelKey)}
      </div>
    );
  }

  // Group local commands by category
  let currentLocalCategory: string | null = null;

  return (
    <div ref={containerRef} className="absolute bottom-full left-0 right-0 mb-1 z-50">
      <div
        ref={listRef}
        className="max-h-64 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--popover)] shadow-lg"
        data-palette-active="true"
      >
        {/* Local commands grouped by category */}
        {localCommands.map((cmd) => {
          const showHeader = cmd.category !== currentLocalCategory;
          if (showHeader) currentLocalCategory = cmd.category;
          return (
            <div key={cmd.name}>
              {showHeader && renderCategoryHeader(cmd.category)}
              {renderCommand(cmd)}
            </div>
          );
        })}

        {/* Skills group */}
        {skillCommands.length > 0 && (
          <>
            {renderCategoryHeader("skills")}
            {skillCommands.map((cmd) => (
              <div key={`skill:${cmd.name}`}>{renderCommand(cmd)}</div>
            ))}
          </>
        )}

        {/* Plugins group */}
        {pluginCommands.length > 0 && (
          <>
            {renderCategoryHeader("plugins")}
            {pluginCommands.map((cmd) => (
              <div key={`plugin:${cmd.name}`}>{renderCommand(cmd)}</div>
            ))}
          </>
        )}

        {/* More commands — collapsible when not searching */}
        {showMoreCollapsed ? (
          <>
            <div
              className="flex items-center gap-1 px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--foreground)]"
              onMouseDown={(e) => {
                e.preventDefault();
                setMoreExpanded((v) => !v);
              }}
            >
              <ChevronRight
                size={10}
                className={cn("transition-transform", moreExpanded && "rotate-90")}
              />
              {t("cmdCatMore")} ({moreCommands.length})
            </div>
            {moreExpanded && moreCommands.map((cmd) => (
              <div key={`more:${cmd.name}`}>{renderCommand(cmd)}</div>
            ))}
          </>
        ) : hasFilter && moreCommands.length > 0 ? (
          // When searching, show all more commands flat
          <>
            {renderCategoryHeader("more")}
            {moreCommands.map((cmd) => (
              <div key={`more:${cmd.name}`}>{renderCommand(cmd)}</div>
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}

export type { SlashCommandPaletteProps, PaletteCommand };
