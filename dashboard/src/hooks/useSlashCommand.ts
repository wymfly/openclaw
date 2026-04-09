"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { PaletteCommand } from "@/components/panels/chat/SlashCommandPalette";
import { commandRegistry } from "@/lib/command-registry";
import type { RegisteredCommand } from "@/lib/command-types";

export interface SlashCommandState {
  showPalette: boolean;
  slashFilter: string;
  paletteIndex: number;
  ghostHint: string;
  navigableCommandsRef: React.RefObject<PaletteCommand[]>;
  /** Update input value — detects `/` prefix and opens palette. */
  handleSlashInput: (value: string) => boolean;
  /** Handle keyboard events when palette is open. Returns true if event was consumed. */
  handlePaletteKeyDown: (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    onSelect: (cmd: RegisteredCommand) => void,
  ) => boolean;
  closePalette: () => void;
  setPaletteIndex: (index: number) => void;
}

/**
 * Manages slash command palette state: open/close, filtering,
 * keyboard navigation, and ghost hint display.
 *
 * Extracted from MessageInput to keep it under 500 LOC.
 */
export function useSlashCommand(input: string): SlashCommandState {
  const [showPalette, setShowPalette] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const navigableCommandsRef = useRef<PaletteCommand[]>([]);

  const ghostHint = useMemo(() => {
    const match = /^\/([a-z0-9_-]+)\s+$/iu.exec(input);
    if (!match) {
      return "";
    }
    const cmd = commandRegistry.get(match[1].toLowerCase());
    if (!cmd?.args) {
      return "";
    }
    return cmd.args;
  }, [input]);

  const handleSlashInput = useCallback((value: string): boolean => {
    if (value.startsWith("/") && !value.includes(" ")) {
      setShowPalette(true);
      setSlashFilter(value.slice(1));
      setPaletteIndex(0);
      return true;
    }
    setShowPalette(false);
    return false;
  }, []);

  const handlePaletteKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLTextAreaElement>,
      onSelect: (cmd: RegisteredCommand) => void,
    ): boolean => {
      if (!showPalette) {
        return false;
      }

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
    [showPalette, paletteIndex],
  );

  const closePalette = useCallback(() => setShowPalette(false), []);

  return {
    showPalette,
    slashFilter,
    paletteIndex,
    ghostHint,
    navigableCommandsRef,
    handleSlashInput,
    handlePaletteKeyDown,
    closePalette,
    setPaletteIndex,
  };
}
