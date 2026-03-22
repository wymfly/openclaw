"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNotificationsStore } from "@/stores/notifications";

interface SteerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runId: string;
  onSteer: (instruction: string) => Promise<void>;
}

export function SteerDialog({ open, onOpenChange, runId, onSteer }: SteerDialogProps) {
  const t = useTranslations("subagents");
  const addToast = useNotificationsStore((s) => s.addToast);
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(async () => {
    if (!instruction.trim() || loading) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSteer(instruction.trim());
      addToast("success", t("steerSuccess"));
      setInstruction("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("steerError"));
    } finally {
      setLoading(false);
    }
  }, [instruction, loading, onSteer, addToast, t, onOpenChange]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setInstruction("");
        setError(null);
        setLoading(false);
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-[var(--bg-secondary)] border-[var(--border)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-primary)]">{t("steerTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-[var(--text-secondary)]">
            {t("steerRunId")}: <code className="font-mono text-[10px]">{runId}</code>
          </p>

          <textarea
            ref={textareaRef}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            // biome-ignore lint: autoFocus is intentional in dialog
            autoFocus
            placeholder={t("steerPlaceholder")}
            className="w-full min-h-[100px] rounded-md border border-[var(--border)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] p-3 resize-y focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                void handleSubmit();
              }
            }}
          />

          {/* Warning banner */}
          <div className="rounded-md px-3 py-2 text-xs bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/25">
            {t("steerWarning")}
          </div>

          {/* Inline error */}
          {error && (
            <div className="rounded-md px-3 py-2 text-xs bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/25">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
            className="cursor-pointer"
          >
            {t("steerCancel")}
          </Button>
          <Button
            variant="default"
            onClick={() => void handleSubmit()}
            disabled={!instruction.trim() || loading}
            className="cursor-pointer"
          >
            {loading && <Loader2 size={14} className="animate-spin mr-1.5" />}
            {t("steerConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
