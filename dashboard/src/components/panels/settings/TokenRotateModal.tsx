"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TokenRotateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string | null;
}

export function TokenRotateModal({ open, onOpenChange, token }: TokenRotateModalProps) {
  const t = useTranslations("devices");
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Reset copied state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setCopied(false);
    }
  }, [open]);

  const handleSelectAll = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const range = document.createRange();
    range.selectNodeContents(e.currentTarget);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!token) {
      return;
    }
    await navigator.clipboard.writeText(token);
    setCopied(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  }, [token]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("tokenGenerated")}</DialogTitle>
        </DialogHeader>

        {/* Token display */}
        <div
          className="cursor-pointer rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground break-all select-all"
          onClick={handleSelectAll}
        >
          {token ?? ""}
        </div>

        {/* Warning text */}
        <p className="text-xs text-[var(--warning-muted-text)]">{t("tokenWarning")}</p>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleCopy()}
            className="cursor-pointer gap-1.5"
          >
            {copied ? (
              <>
                <CheckIcon size={14} />
                {t("copied")}
              </>
            ) : (
              <>
                <CopyIcon size={14} />
                {t("copyToken")}
              </>
            )}
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)} className="cursor-pointer">
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
