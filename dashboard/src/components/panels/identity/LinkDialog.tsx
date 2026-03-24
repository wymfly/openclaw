"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useIdentityStore } from "@/stores/deck-identity";

interface LinkDialogProps {
  open: boolean;
  onClose: () => void;
}

export function LinkDialog({ open, onClose }: LinkDialogProps) {
  const t = useTranslations("identity");
  const tc = useTranslations("common");
  const linkPeer = useIdentityStore((s) => s.linkPeer);

  const [canonical, setCanonical] = useState("");
  const [channel, setChannel] = useState("");
  const [peerId, setPeerId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setCanonical("");
    setChannel("");
    setPeerId("");
    setErrorMsg(null);
    setSubmitting(false);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetForm();
        onClose();
      }
    },
    [resetForm, onClose],
  );

  const handleSubmit = useCallback(async () => {
    if (!canonical.trim() || !channel.trim() || !peerId.trim()) {
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const ok = await linkPeer(canonical.trim(), channel.trim(), peerId.trim());
      if (ok) {
        resetForm();
        onClose();
      } else {
        setErrorMsg(t("linkFailed"));
      }
    } catch {
      setErrorMsg(t("linkFailed"));
    } finally {
      setSubmitting(false);
    }
  }, [canonical, channel, peerId, linkPeer, resetForm, onClose, t]);

  const isValid = canonical.trim() && channel.trim() && peerId.trim();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("linkIdentity")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {/* Canonical */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--foreground)]">{t("canonical")}</label>
            <Input
              value={canonical}
              onChange={(e) => setCanonical(e.target.value)}
              placeholder="john-doe"
              className="h-8 text-xs"
            />
          </div>

          {/* Channel */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--foreground)]">{t("channel")}</label>
            <Input
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="telegram"
              className="h-8 text-xs"
            />
          </div>

          {/* Peer ID */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--foreground)]">{t("peerId")}</label>
            <Input
              value={peerId}
              onChange={(e) => setPeerId(e.target.value)}
              placeholder="123456789"
              className="h-8 text-xs"
            />
          </div>

          {/* Error message */}
          {errorMsg && (
            <div className="text-xs px-3 py-2 rounded-lg bg-[var(--destructive-muted)] text-[var(--destructive)]">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenChange(false)}
            className="cursor-pointer"
          >
            {tc("cancel")}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => void handleSubmit()}
            disabled={!isValid || submitting}
            className="cursor-pointer gap-1"
          >
            {submitting && <Loader2 size={12} className="animate-spin" />}
            {tc("save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
