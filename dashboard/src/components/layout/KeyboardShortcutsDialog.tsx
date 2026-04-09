"use client";

import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutEntry {
  keys: string;
  descKey: string;
}

const SHORTCUTS: ShortcutEntry[] = [
  { keys: "Alt + 1-9", descKey: "switchPanel" },
  { keys: "Ctrl/⌘ + K", descKey: "focusSearch" },
  { keys: "Ctrl/⌘ + Enter", descKey: "sendMessage" },
  { keys: "Escape", descKey: "closeCancel" },
  { keys: "Ctrl/⌘ + ,", descKey: "openSettings" },
  { keys: "Ctrl/⌘ + /", descKey: "toggleNavRail" },
  { keys: "Ctrl/⌘ + Shift + /", descKey: "showHelp" },
  { keys: "Alt + N", descKey: "newSession" },
  { keys: "Ctrl/⌘ + Shift + K", descKey: "commandPalette" },
  { keys: "Ctrl/⌘ + [ / ]", descKey: "prevNextPanel" },
  { keys: "Ctrl/⌘ + Shift + C", descKey: "copyLastReply" },
];

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  const t = useTranslations("shortcuts");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">{t("title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 mt-2">
          {SHORTCUTS.map((s) => (
            <div key={s.descKey} className="flex items-center justify-between py-1.5 px-1">
              <span className="text-xs text-[var(--foreground)]">{t(s.descKey)}</span>
              <kbd
                className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: "var(--muted)",
                  color: "var(--muted-foreground)",
                }}
              >
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
