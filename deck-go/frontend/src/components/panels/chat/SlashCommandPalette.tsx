import { useTranslations } from "next-intl";
import { useEffect, useSyncExternalStore, type MutableRefObject } from "react";
import {
  ArrowDownIcon,
  BarChartIcon,
  BotIcon,
  BrainIcon,
  CpuIcon,
  FileTextIcon,
  MonitorIcon,
  PanelCollapseIcon,
  PlusIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  SquareIcon,
  TrashIcon,
  WrenchIcon,
  ZapIcon,
  type IconComponent,
} from "@/deck-ui/icons";
import { commandRegistry } from "@/lib/command-registry";
import type { RegisteredCommand } from "@/lib/command-types";
import type { CommandVisibilityContext } from "@/lib/command-types";
import "./chat-popover.css";
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

const COMMAND_ICONS: Record<string, IconComponent> = {
  "bar-chart-2": BarChartIcon,
  book: FileTextIcon,
  "book-open": FileTextIcon,
  brain: BrainIcon,
  cpu: CpuIcon,
  download: ArrowDownIcon,
  lightbulb: BrainIcon,
  "minimize-2": PanelCollapseIcon,
  monitor: MonitorIcon,
  plus: PlusIcon,
  "refresh-cw": RotateCcwIcon,
  shield: ShieldCheckIcon,
  square: SquareIcon,
  "trash-2": TrashIcon,
  zap: ZapIcon,
};

function CommandIcon({ command }: { command: RegisteredCommand }) {
  if (command.source === "skill" || command.source === "plugin") {
    return <BotIcon />;
  }
  const Icon = command.icon ? COMMAND_ICONS[command.icon] : undefined;
  return Icon ? <Icon /> : <WrenchIcon />;
}

function translatedOrFallback(
  t: ReturnType<typeof useTranslations>,
  key: string | undefined,
  fallback: string,
) {
  if (key && (typeof t.has !== "function" || t.has(key))) {
    return t(key);
  }
  return fallback;
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
  initializeLocalCommands();
  useSyncExternalStore(commandRegistry.subscribe.bind(commandRegistry), () =>
    commandRegistry.getVersion(),
  );

  const commandLabel = `/${argOptionsState?.command.name ?? ""}`;

  if (argOptionsState) {
    return (
      <div
        className="ds-command-palette deck-ui-command-palette is-arg-options"
        role="listbox"
        aria-label={t("cmdOptionsFor", { command: argOptionsState.command.name })}
      >
        <button
          className="ds-command-palette__back deck-ui-command-palette-back"
          type="button"
          onMouseDown={() => onArgOptionsBack?.()}
        >
          {t("cmdBack")}
        </button>
        <div className="ds-command-palette__section-title deck-ui-command-section-title">
          {commandLabel}
        </div>
        {argOptionsState.options.map((option, index) => {
          const optionClasses = ["ds-command-palette__option", "deck-ui-command-option"];
          if (index === argOptionsState.selectedIndex) {
            optionClasses.push("ds-command-palette__option--selected", "is-selected");
          }
          return (
            <div
              className={optionClasses.join(" ")}
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
          );
        })}
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
      className="ds-command-palette deck-ui-command-palette"
      role="listbox"
      aria-label={t("slashCommands")}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onDismiss();
        }
      }}
    >
      {[...sections.entries()].map(([sectionKey, sectionCommands]) => (
        <div className="ds-command-palette__section deck-ui-command-section" key={sectionKey}>
          <div className="ds-command-palette__section-title deck-ui-command-section-title">
            {translatedOrFallback(t, CATEGORY_LABEL_KEYS[sectionKey], sectionKey)}
          </div>
          {sectionCommands.map((command) => {
            globalIndex++;
            const index = globalIndex;
            const description = translatedOrFallback(
              t,
              command.descriptionKey,
              command.description,
            );
            const optionClasses = ["ds-command-palette__option", "deck-ui-command-option"];
            if (index === selectedIndex) {
              optionClasses.push("ds-command-palette__option--selected", "is-selected");
            }
            return (
              <div
                className={optionClasses.join(" ")}
                key={`${command.source}:${command.name}`}
                role="option"
                aria-selected={index === selectedIndex}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelect(command);
                }}
                onMouseEnter={() => onSelectedIndexChange(index)}
              >
                <span className="ds-command-palette__primary deck-ui-command-primary">
                  <CommandIcon command={command} />
                  <span className="ds-command-palette__name deck-ui-command-name">
                    /{command.name}
                  </span>
                  {command.args ? (
                    <span className="ds-command-palette__args deck-ui-command-args">
                      {command.args}
                    </span>
                  ) : null}
                </span>
                <span
                  className="ds-command-palette__description deck-ui-command-description"
                  title={description}
                >
                  {description}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
