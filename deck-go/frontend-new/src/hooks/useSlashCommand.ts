import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { PaletteCommand } from "@/components/panels/chat/SlashCommandPalette";
import { commandRegistry } from "@/lib/command-registry";
import type { RegisteredCommand } from "@/lib/command-types";

export type CommandSelectMode = "immediate" | "argOptions" | "tag";

export function resolveSelectMode(command: RegisteredCommand): CommandSelectMode {
  if (command.argOptions && command.argOptions.length > 0) {
    return "argOptions";
  }
  if (command.source === "skill" || command.source === "plugin") {
    return "tag";
  }
  if (command.args) {
    return "tag";
  }
  if (command.source === "builtin" && command.execMode === "remote") {
    return "tag";
  }
  return "immediate";
}

export type ArgOptionsState = {
  command: RegisteredCommand;
  options: string[];
  selectedIndex: number;
};

export function useSlashCommand(input: string) {
  const [showPalette, setShowPalette] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [argOptionsState, setArgOptionsState] = useState<ArgOptionsState | null>(null);
  const [activeTag, setActiveTag] = useState<RegisteredCommand | null>(null);
  const navigableCommandsRef = useRef<PaletteCommand[]>([]);

  const ghostHint = useMemo(() => {
    if (activeTag) {
      return "";
    }
    const match = /^\/([a-z0-9_-]+)\s+$/iu.exec(input);
    if (!match) {
      return "";
    }
    const command = commandRegistry.get(match[1].toLowerCase());
    return command?.args ?? "";
  }, [activeTag, input]);

  const handleSlashInput = useCallback((value: string) => {
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
      event: KeyboardEvent<HTMLTextAreaElement>,
      onSelect: (command: RegisteredCommand) => void,
      onSelectWithArg: (command: RegisteredCommand, arg: string) => void,
    ) => {
      if (!showPalette) {
        return false;
      }

      if (argOptionsState) {
        const options = argOptionsState.options;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setArgOptionsState((state) =>
            state ? { ...state, selectedIndex: (state.selectedIndex + 1) % options.length } : state,
          );
          return true;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setArgOptionsState((state) =>
            state
              ? {
                  ...state,
                  selectedIndex: (state.selectedIndex - 1 + options.length) % options.length,
                }
              : state,
          );
          return true;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          const option = options[argOptionsState.selectedIndex];
          if (option) {
            onSelectWithArg(argOptionsState.command, option);
          }
          setArgOptionsState(null);
          setShowPalette(false);
          return true;
        }
        if (event.key === "Escape" || event.key === "Backspace") {
          event.preventDefault();
          setArgOptionsState(null);
          return true;
        }
        return true;
      }

      const commands = navigableCommandsRef.current;
      if (commands.length > 0 && event.key === "ArrowDown") {
        event.preventDefault();
        setPaletteIndex((index) => (index + 1) % commands.length);
        return true;
      }
      if (commands.length > 0 && event.key === "ArrowUp") {
        event.preventDefault();
        setPaletteIndex((index) => (index - 1 + commands.length) % commands.length);
        return true;
      }
      if (commands.length > 0 && event.key === "Enter") {
        event.preventDefault();
        const selected = commands[paletteIndex] ?? commands[0];
        if (selected) {
          onSelect(selected.command);
        }
        return true;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setShowPalette(false);
        return true;
      }
      return false;
    },
    [argOptionsState, paletteIndex, showPalette],
  );

  const closePalette = useCallback(() => {
    setShowPalette(false);
    setArgOptionsState(null);
  }, []);

  const enterArgOptionsMode = useCallback((command: RegisteredCommand) => {
    if (!command.argOptions || command.argOptions.length === 0) {
      return;
    }
    setArgOptionsState({ command, options: command.argOptions, selectedIndex: 0 });
  }, []);

  const exitArgOptionsMode = useCallback(() => {
    setArgOptionsState(null);
  }, []);

  const enterTagMode = useCallback((command: RegisteredCommand) => {
    setActiveTag(command);
    setShowPalette(false);
    setArgOptionsState(null);
  }, []);

  const clearTag = useCallback(() => {
    setActiveTag(null);
  }, []);

  const setArgOptionsIndex = useCallback((index: number) => {
    setArgOptionsState((state) => (state ? { ...state, selectedIndex: index } : state));
  }, []);

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
    activeTag,
    clearTag,
    enterArgOptionsMode,
    enterTagMode,
    argOptionsState,
    exitArgOptionsMode,
    setArgOptionsIndex,
  };
}
