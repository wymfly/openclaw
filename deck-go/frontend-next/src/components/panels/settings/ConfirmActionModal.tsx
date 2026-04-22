"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: "default" | "destructive";
  onConfirm: () => Promise<void>;
}

export function ConfirmActionModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  variant = "default",
  onConfirm,
}: ConfirmActionModalProps) {
  const tc = useTranslations("common");
  const td = useTranslations("devices");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : td("operationFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (loading) {
      return;
    }
    setError(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{description}</p>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => handleOpenChange(false)}
            className="cursor-pointer"
          >
            {tc("cancel")}
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            size="sm"
            disabled={loading}
            onClick={() => void handleConfirm()}
            className="cursor-pointer"
          >
            {loading ? tc("loading") : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
