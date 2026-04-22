"use client";

/**
 * Popover command palette displayed above the input when user types `/`.
 * Keyboard events are piped from MessageInput (not global listeners) to avoid conflicts.
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
  ChevronDown,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type React from "react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { commandRegistry } from "@/lib/command-registry";
import type { CommandVisibilityContext, RegisteredCommand } from "@/lib/command-types";
import { cn } from "@/lib/utils";
import { CATEGORY_LABEL_KEYS } from "./slash-commands";

interface SlashCommandPaletteProps {
  filter: string;
  /** Controlled selection index — parent owns this state for keyboard/mouse unification. */
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  onSelect: (command: RegisteredCommand) => void;
  onSelectWithArg?: (command: RegisteredCommand, arg: string) => void;
  onDismiss: () => void;
  navigableCommandsRef: React.MutableRefObject<PaletteCommand[]>;
  visibilityContext?: CommandVisibilityContext;
  /** When set, shows a secondary options panel instead of the command list. */
  argOptionsState?: { command: RegisteredCommand; options: string[]; selectedIndex: number } | null;
  onArgOptionsBack?: () => void;
  onArgOptionsIndexChange?: (index: number) => void;
}

export interface PaletteCommand {
  command: RegisteredCommand;
  sectionKey: string;
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
};

const LOCAL_CATEGORY_ORDER = ["session", "model", "tools", "agents"] as const;

interface PaletteSection {
  key: string;
  label: string;
  commands: RegisteredCommand[];
  collapsible?: boolean;
  collapsed?: boolean;
}

function CommandIcon({ name, size = 14 }: { name: string; size?: number }) {
  const Icon = ICON_MAP[name];
  if (!Icon) {
    return <TerminalSquare size={size} />;
  }
  return <Icon size={size} />;
}

function SourceCommandIcon({ command }: { command: RegisteredCommand }) {
  if (command.source === "local") {
    return <CommandIcon name={command.icon ?? "terminal"} />;
  }
  if (command.source === "skill") {
    return <Sparkles size={14} />;
  }
  if (command.source === "plugin") {
    return <Plug2 size={14} />;
  }
  return <TerminalSquare size={14} />;
}

function resolveDescription(t: ReturnType<typeof useTranslations>, cmd: RegisteredCommand): string {
  if (cmd.descriptionKey) {
    return t(cmd.descriptionKey);
  }
  return cmd.description;
}

export function SlashCommandPalette({
  filter,
  selectedIndex,
  onSelectedIndexChange,
  onSelect,
  onSelectWithArg,
  onDismiss,
  navigableCommandsRef,
  visibilityContext,
  argOptionsState,
  onArgOptionsBack,
  onArgOptionsIndexChange,
}: SlashCommandPaletteProps) {
  const t = useTranslations("chat");
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMoreExpanded, setIsMoreExpanded] = useState(false);
  const subscribe = useCallback((listener: () => void) => commandRegistry.subscribe(listener), []);
  const getSnapshot = useCallback(() => commandRegistry.getVersion(), []);

  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const allCommands = commandRegistry.filter(filter, visibilityContext);
  const localBuckets = new Map<string, RegisteredCommand[]>();
  const skillCommands: RegisteredCommand[] = [];
  const pluginCommands: RegisteredCommand[] = [];
  const moreCommands: RegisteredCommand[] = [];

  for (const cmd of allCommands) {
    if (cmd.source === "local") {
      const list = localBuckets.get(cmd.category) ?? [];
      list.push(cmd);
      localBuckets.set(cmd.category, list);
      continue;
    }
    if (cmd.source === "skill") {
      skillCommands.push(cmd);
      continue;
    }
    if (cmd.source === "plugin") {
      pluginCommands.push(cmd);
      continue;
    }
    moreCommands.push(cmd);
  }

  const localCategorySet = new Set<string>(LOCAL_CATEGORY_ORDER);
  const orderedLocalCategories = [
    ...LOCAL_CATEGORY_ORDER.filter((key) => localBuckets.has(key)),
    ...[...localBuckets.keys()].filter((key) => !localCategorySet.has(key)).toSorted(),
  ];

  const sections: PaletteSection[] = [];

  for (const category of orderedLocalCategories) {
    const commands = localBuckets.get(category);
    if (!commands || commands.length === 0) {
      continue;
    }
    sections.push({
      key: `local:${category}`,
      label: t(CATEGORY_LABEL_KEYS[category] ?? category),
      commands,
    });
  }

  if (skillCommands.length > 0) {
    sections.push({
      key: "skills",
      label: t(CATEGORY_LABEL_KEYS.skills),
      commands: skillCommands,
    });
  }

  if (pluginCommands.length > 0) {
    sections.push({
      key: "plugins",
      label: t(CATEGORY_LABEL_KEYS.plugins),
      commands: pluginCommands,
    });
  }

  const showMoreCommands = isMoreExpanded || filter.trim().length > 0;
  if (moreCommands.length > 0) {
    sections.push({
      key: "more",
      label: t(CATEGORY_LABEL_KEYS.more),
      commands: showMoreCommands ? moreCommands : [],
      collapsible: true,
      collapsed: !showMoreCommands,
    });
  }

  const navigableCommands: PaletteCommand[] = sections.flatMap((section) =>
    section.commands.map((command) => ({ command, sectionKey: section.key })),
  );
  navigableCommandsRef.current = navigableCommands;

  // Keep selected index valid as command visibility changes.
  useEffect(() => {
    if (navigableCommands.length === 0) {
      onSelectedIndexChange(0);
      return;
    }
    if (selectedIndex >= navigableCommands.length) {
      onSelectedIndexChange(navigableCommands.length - 1);
    }
  }, [navigableCommands.length, onSelectedIndexChange, selectedIndex]);

  // Scroll selected item into view.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Outside-click dismiss.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onDismiss]);

  if (!argOptionsState && allCommands.length === 0) {
    return null;
  }

  // ArgOptions secondary panel
  if (argOptionsState) {
    return (
      <div ref={containerRef} className="absolute bottom-full left-0 right-0 mb-1 z-50">
        <div
          ref={listRef}
          className="max-h-64 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--popover)] shadow-lg"
          data-palette-active="true"
        >
          <div className="flex items-center gap-2 px-3 pt-2 pb-1">
            <button
              type="button"
              className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
              onMouseDown={(e) => {
                e.preventDefault();
                onArgOptionsBack?.();
              }}
            >
              ← {t("cmdBack")}
            </button>
            <span className="text-[10px] font-semibold text-[var(--muted-foreground)]">
              /{argOptionsState.command.name}
            </span>
          </div>
          {argOptionsState.options.map((opt, idx) => (
            <div
              key={opt}
              data-index={idx}
              role="option"
              aria-selected={idx === argOptionsState.selectedIndex}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs transition-colors",
                idx === argOptionsState.selectedIndex
                  ? "bg-[var(--accent)] text-[var(--foreground)]"
                  : "text-[var(--foreground)] hover:bg-[var(--accent)]",
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectWithArg?.(argOptionsState.command, opt);
              }}
              onMouseEnter={() => onArgOptionsIndexChange?.(idx)}
            >
              <span className="font-mono text-[var(--primary)]">{opt}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  let globalIndex = -1;

  return (
    <div ref={containerRef} className="absolute bottom-full left-0 right-0 mb-1 z-50">
      <div
        ref={listRef}
        className="max-h-64 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--popover)] shadow-lg"
        data-palette-active="true"
      >
        {sections.map((section) => (
          <div key={section.key}>
            <button
              type="button"
              className={cn(
                "w-full flex items-center gap-1 px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]",
                section.collapsible
                  ? "cursor-pointer hover:text-[var(--foreground)]"
                  : "cursor-default",
              )}
              onMouseDown={(e) => {
                if (!section.collapsible) {
                  return;
                }
                e.preventDefault();
                setIsMoreExpanded((prev) => !prev);
              }}
            >
              {section.collapsible &&
                (section.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />)}
              <span>{section.label}</span>
            </button>
            {section.commands.map((cmd) => {
              globalIndex++;
              const idx = globalIndex;
              return (
                <div
                  key={`${section.key}:${cmd.source}:${cmd.name}`}
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
                    <SourceCommandIcon command={cmd} />
                  </span>
                  <span className="font-mono text-[var(--primary)]">/{cmd.name}</span>
                  {cmd.args && <span className="text-[var(--muted-foreground)]">{cmd.args}</span>}
                  <span className="ml-auto text-[10px] text-[var(--muted-foreground)] truncate max-w-[200px]">
                    {resolveDescription(t, cmd)}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export type { SlashCommandPaletteProps };
