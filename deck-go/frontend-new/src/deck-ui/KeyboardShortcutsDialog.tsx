import { useTranslations } from "../i18n/provider";
import { XIcon } from "./icons";

type KeyboardShortcutsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SHORTCUTS = [
  { keys: "Alt + 1-9", descKey: "switchPanel" },
  { keys: "Ctrl/Cmd + K", descKey: "focusSearch" },
  { keys: "Ctrl/Cmd + Enter", descKey: "sendMessage" },
  { keys: "Escape", descKey: "closeCancel" },
  { keys: "Ctrl/Cmd + ,", descKey: "openSettings" },
  { keys: "Ctrl/Cmd + /", descKey: "toggleNavRail" },
  { keys: "Ctrl/Cmd + Shift + /", descKey: "showHelp" },
  { keys: "Alt + N", descKey: "newSession" },
  { keys: "Ctrl/Cmd + Shift + K", descKey: "commandPalette" },
  { keys: "Ctrl/Cmd + [ / ]", descKey: "prevNextPanel" },
  { keys: "Ctrl/Cmd + Shift + C", descKey: "copyLastReply" },
] as const;

export function KeyboardShortcutsDialog(props: KeyboardShortcutsDialogProps) {
  const t = useTranslations("shortcuts");

  if (!props.open) {
    return null;
  }

  return (
    <div
      className="deck-ui-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          props.onOpenChange(false);
        }
      }}
    >
      <section
        aria-labelledby="deck-ui-shortcuts-title"
        className="deck-ui-dialog"
        role="dialog"
        aria-modal="true"
      >
        <header className="deck-ui-dialog-header">
          <h2 id="deck-ui-shortcuts-title">{t("title")}</h2>
          <button
            aria-label={t("close")}
            className="deck-ui-icon-button"
            type="button"
            onClick={() => props.onOpenChange(false)}
          >
            <XIcon />
          </button>
        </header>
        <div className="deck-ui-shortcut-list">
          {SHORTCUTS.map((shortcut) => (
            <div className="deck-ui-shortcut-row" key={shortcut.descKey}>
              <span>{t(shortcut.descKey)}</span>
              <kbd>{shortcut.keys}</kbd>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
