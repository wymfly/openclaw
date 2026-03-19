"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConflictDialogProps {
  onReload: () => void;
  onCancel: () => void;
}

/**
 * Modal dialog shown when a save detects that the config was modified externally.
 * User can reload (discard local edits) or cancel (continue editing).
 */
export function ConflictDialog({ onReload, onCancel }: ConflictDialogProps) {
  const t = useTranslations("config");
  const tc = useTranslations("common");

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-sm">
            <AlertTriangle size={20} className="text-[var(--danger)]" />
            {t("conflict")}
          </DialogTitle>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>
            {tc("cancel")}
          </Button>
          <Button size="sm" onClick={onReload}>
            {t("reload")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
