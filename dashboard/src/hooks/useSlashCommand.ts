"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { PaletteCommand } from "@/components/panels/chat/SlashCommandPalette";
import { commandRegistry } from "@/lib/command-registry";
import type { RegisteredCommand } from "@/lib/command-types";

/** Determines how a command should behave when selected from palette. */
export type CommandSelectMode = "immediate" | "argOptions" | "tag";

/**
 * Classify how a command should behave when selected from the palette.
 * - argOptions: show secondary picker (e.g. /think → off|low|medium|high)
 * - tag: pin command as tag, user types text after it (skills, plugins, /model)
 * - immediate: execute right away (no-arg local commands like /new, /clear)
 *
 * Note: `builtin` remote commands without argOptions route to "tag" since they
 * typically need freeform input. Local builtins without args fall to "immediate".
 */
export function resolveSelectMode(cmd: RegisteredCommand): CommandSelectMode {
  if (cmd.argOptions && cmd.argOptions.length > 0) return "argOptions";
  if (cmd.source === "skill" || cmd.source === "plugin") return "tag";
  if (cmd.args) return "tag";
  if (cmd.source === "builtin" && cmd.execMode === "remote") return "tag";
  return "immediate";
}

export interface ArgOptionsState {
  command: RegisteredCommand;
  options: string[];
  selectedIndex: number;
}

export interface SlashCommandState {
  showPalette: boolean;
  slashFilter: string;
  paletteIndex: number;
  ghostHint: string;
  navigableCommandsRef: React.RefObject<PaletteCommand[]>;
  /** Secondary options panel state (for commands with argOptions). */
  argOptionsState: ArgOptionsState | null;
  /** Active tag command (for commands needing text input). */
  activeTag: RegisteredCommand | null;
  /** Update input value — detects `/` prefix and opens palette. */
  handleSlashInput: (value: string) => boolean;
  /** Handle keyboard events when palette is open. Returns true if event was consumed. */
  handlePaletteKeyDown: (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    onSelect: (cmd: RegisteredCommand) => void,
    onSelectWithArg: (cmd: RegisteredCommand, arg: string) => void,
  ) => boolean;
  closePalette: () => void;
  setPaletteIndex: (index: number) => void;
  /** Enter secondary options mode for a command with argOptions. */
  enterArgOptionsMode: (cmd: RegisteredCommand) => void;
  /** Exit argOptions mode back to command list. */
  exitArgOptionsMode: () => void;
  /** Set an active tag (command pinned in input). */
  enterTagMode: (cmd: RegisteredCommand) => void;
  /** Clear the active tag. */
  clearTag: () => void;
  /** Update the selected index within argOptions panel (for mouse hover). */
  setArgOptionsIndex: (index: number) => void;
}

/**
 * Manages slash command palette state: open/close, filtering,
 * keyboard navigation, ghost hint display, argOptions mode, and tag mode.
 */
export function useSlashCommand(input: string): SlashCommandState {
  const [showPalette, setShowPalette] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [argOptionsState, setArgOptionsState] = useState<ArgOptionsState | null>(null);
  const [activeTag, setActiveTag] = useState<RegisteredCommand | null>(null);
  const navigableCommandsRef = useRef<PaletteCommand[]>([]);

  const ghostHint = useMemo(() => {
    if (activeTag) return "";
    const match = /^\/([a-z0-9_-]+)\s+$/iu.exec(input);
    if (!match) {
      return "";
    }
    const cmd = commandRegistry.get(match[1].toLowerCase());
    if (!cmd?.args) {
      return "";
    }
    return cmd.args;
  }, [input, activeTag]);

  const handleSlashInput = useCallback((value: string): boolean => {
    if (value.startsWith("/") && !value.includes(" ")) {
      setShowPalette(true);
      setSlashFilter(value.slice(1));
      setPaletteIndex(0);
      setArgOptionsState(null);
      return true;
    }
    setShowPalette(false);
    setArgOptionsState(null);
    return false;
  }, []);

  const handlePaletteKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLTextAreaElement>,
      onSelect: (cmd: RegisteredCommand) => void,
      onSelectWithArg: (cmd: RegisteredCommand, arg: string) => void,
    ): boolean => {
      if (!showPalette) {
        return false;
      }

      // ArgOptions mode — navigate and select within options
      if (argOptionsState) {
        const opts = argOptionsState.options;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setArgOptionsState((s) =>
            s ? { ...s, selectedIndex: (s.selectedIndex + 1) % opts.length } : s,
          );
          return true;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setArgOptionsState((s) =>
            s ? { ...s, selectedIndex: (s.selectedIndex - 1 + opts.length) % opts.length } : s,
          );
          return true;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const arg = opts[argOptionsState.selectedIndex];
          if (arg) {
            onSelectWithArg(argOptionsState.command, arg);
          }
          setArgOptionsState(null);
          setShowPalette(false);
          return true;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setArgOptionsState(null);
          return true;
        }
        if (e.key === "Backspace") {
          e.preventDefault();
          setArgOptionsState(null);
          return true;
        }
        return true;
      }

      // Normal palette mode — navigate and select commands
      const commands = navigableCommandsRef.current;
      if (commands.length > 0 && e.key === "ArrowDown") {
        e.preventDefault();
        setPaletteIndex((prev) => (prev + 1) % commands.length);
        return true;
      }
      if (commands.length > 0 && e.key === "ArrowUp") {
        e.preventDefault();
        setPaletteIndex((prev) => (prev - 1 + commands.length) % commands.length);
        return true;
      }
      if (e.key === "Enter" && commands.length > 0) {
        e.preventDefault();
        const selected = commands[paletteIndex] ?? commands[0];
        if (selected) {
          onSelect(selected.command);
        }
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowPalette(false);
        return true;
      }
      return false;
    },
    [showPalette, paletteIndex, argOptionsState],
  );

  const closePalette = useCallback(() => {
    setShowPalette(false);
    setArgOptionsState(null);
  }, []);

  const enterArgOptionsMode = useCallback((cmd: RegisteredCommand) => {
    if (!cmd.argOptions || cmd.argOptions.length === 0) return;
    setArgOptionsState({ command: cmd, options: cmd.argOptions, selectedIndex: 0 });
  }, []);

  const exitArgOptionsMode = useCallback(() => {
    setArgOptionsState(null);
  }, []);

  const enterTagMode = useCallback((cmd: RegisteredCommand) => {
    setActiveTag(cmd);
    setShowPalette(false);
    setArgOptionsState(null);
  }, []);

  const clearTag = useCallback(() => {
    setActiveTag(null);
  }, []);

  const setArgOptionsIndex = useCallback((index: number) => {
    setArgOptionsState((s) => (s ? { ...s, selectedIndex: index } : s));
  }, []);

  return {
    showPalette,
    slashFilter,
    paletteIndex,
    ghostHint,
    navigableCommandsRef,
    argOptionsState,
    activeTag,
    handleSlashInput,
    handlePaletteKeyDown,
    closePalette,
    setPaletteIndex,
    enterArgOptionsMode,
    exitArgOptionsMode,
    enterTagMode,
    clearTag,
    setArgOptionsIndex,
  };
}
