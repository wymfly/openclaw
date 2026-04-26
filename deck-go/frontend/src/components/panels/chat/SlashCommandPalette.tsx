import { useEffect, useSyncExternalStore, type MutableRefObject } from "react";
import { commandRegistry } from "@/lib/command-registry";
import type { RegisteredCommand } from "@/lib/command-types";
import type { CommandVisibilityContext } from "@/lib/command-types";
import { initializeLocalCommands } from "./slash-command-executor";
import { CATEGORY_LABEL_KEYS } from "./slash-commands";

export type PaletteCommand = {
  command: RegisteredCommand;
  sectionKey: string;
};

export type SlashCommandPaletteProps = {
  filter: string;
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  onSelect: (command: RegisteredCommand) => void;
  onSelectWithArg?: (command: RegisteredCommand, arg: string) => void;
  onDismiss: () => void;
  navigableCommandsRef: MutableRefObject<PaletteCommand[]>;
  visibilityContext?: CommandVisibilityContext;
  argOptionsState?: { command: RegisteredCommand; options: string[]; selectedIndex: number } | null;
  onArgOptionsBack?: () => void;
  onArgOptionsIndexChange?: (index: number) => void;
};

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
  initializeLocalCommands();
  useSyncExternalStore(commandRegistry.subscribe.bind(commandRegistry), () =>
    commandRegistry.getVersion(),
  );

  if (argOptionsState) {
    return (
      <div
        className="deck-ui-command-palette is-arg-options"
        role="listbox"
        aria-label={`/${argOptionsState.command.name}`}
      >
        <button
          className="deck-ui-command-palette-back"
          type="button"
          onMouseDown={() => onArgOptionsBack?.()}
        >
          Back
        </button>
        {argOptionsState.options.map((option, index) => (
          <div
            className={`deck-ui-command-option ${
              index === argOptionsState.selectedIndex ? "is-selected" : ""
            }`}
            key={option}
            role="option"
            aria-selected={index === argOptionsState.selectedIndex}
            onMouseDown={(event) => {
              event.preventDefault();
              onSelectWithArg?.(argOptionsState.command, option);
            }}
            onMouseEnter={() => onArgOptionsIndexChange?.(index)}
          >
            {option}
          </div>
        ))}
      </div>
    );
  }

  const commands = commandRegistry.filter(filter, visibilityContext);
  const sections = new Map<string, RegisteredCommand[]>();
  for (const command of commands) {
    const section = command.category || "more";
    const list = sections.get(section) ?? [];
    list.push(command);
    sections.set(section, list);
  }

  const navigableCommands: PaletteCommand[] = [];
  for (const [sectionKey, sectionCommands] of sections) {
    for (const command of sectionCommands) {
      navigableCommands.push({ command, sectionKey });
    }
  }
  navigableCommandsRef.current = navigableCommands;

  useEffect(() => {
    if (navigableCommands.length === 0) {
      onSelectedIndexChange(0);
      return;
    }
    if (selectedIndex >= navigableCommands.length) {
      onSelectedIndexChange(navigableCommands.length - 1);
    }
  }, [navigableCommands.length, onSelectedIndexChange, selectedIndex]);

  if (commands.length === 0) {
    return null;
  }

  let globalIndex = -1;
  return (
    <div
      className="deck-ui-command-palette"
      role="listbox"
      aria-label="Slash commands"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onDismiss();
        }
      }}
    >
      {[...sections.entries()].map(([sectionKey, sectionCommands]) => (
        <div className="deck-ui-command-section" key={sectionKey}>
          <div className="deck-ui-command-section-title">
            {CATEGORY_LABEL_KEYS[sectionKey] ?? sectionKey}
          </div>
          {sectionCommands.map((command) => {
            globalIndex++;
            const index = globalIndex;
            return (
              <div
                className={`deck-ui-command-option ${index === selectedIndex ? "is-selected" : ""}`}
                key={`${command.source}:${command.name}`}
                role="option"
                aria-selected={index === selectedIndex}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelect(command);
                }}
                onMouseEnter={() => onSelectedIndexChange(index)}
              >
                <span className="deck-ui-command-name">/{command.name}</span>
                {command.args ? (
                  <span className="deck-ui-command-args"> {command.args}</span>
                ) : null}
                <span className="deck-ui-command-description">
                  {command.descriptionKey ?? command.description}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
