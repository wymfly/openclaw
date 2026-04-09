"use client";

import { useTranslations } from "next-intl";
import { useState, useCallback, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useChannelsStore, type ChannelAccount } from "@/stores/channels";
import { DmPolicySelector } from "./DmPolicySelector";

interface AccountConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
  account: ChannelAccount;
}

/**
 * Per-account configuration dialog — DM policy, model override, routing.
 * Shows inherit/override badges for each field.
 */
export function AccountConfigDialog({
  open,
  onOpenChange,
  channelId,
  account,
}: AccountConfigDialogProps) {
  const t = useTranslations("channels");
  const tc = useTranslations("common");
  const { updateChannelConfig } = useChannelsStore();

  const [dmPolicy, setDmPolicy] = useState("pairing");
  const [overrideDm, setOverrideDm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setOverrideDm(false);
      setDmPolicy("pairing");
    }
  }, [open]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (overrideDm) {
        await updateChannelConfig(channelId, {
          accounts: {
            [account.accountId]: {
              dm: { policy: dmPolicy },
            },
          },
        });
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }, [channelId, account.accountId, dmPolicy, overrideDm, updateChannelConfig, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("accountConfig.title", { account: account.name ?? account.accountId })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Account info */}
          <div className="px-3 py-2 rounded-lg bg-[var(--muted)]">
            <dl className="text-xs space-y-1">
              <div className="flex justify-between">
                <dt className="text-[var(--muted-foreground)]">{t("accountConfig.accountId")}</dt>
                <dd className="font-mono text-[var(--foreground)]">{account.accountId}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--muted-foreground)]">{t("accountConfig.status")}</dt>
                <dd>
                  {account.connected ? (
                    <Badge className="text-[10px] border-0 bg-[var(--success-muted)] text-[var(--success-muted-text)]">
                      {t("linked")}
                    </Badge>
                  ) : (
                    <Badge className="text-[10px] border-0 bg-[var(--neutral-muted)] text-[var(--neutral-muted-text)]">
                      {t("disabled")}
                    </Badge>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {/* DM Policy override */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t("accountConfig.dmPolicy")}</Label>
              <button
                onClick={() => setOverrideDm((p) => !p)}
                className="text-[10px] px-2 py-0.5 rounded-full transition-colors"
                style={{
                  backgroundColor: overrideDm ? "var(--primary-muted)" : "var(--neutral-muted)",
                  color: overrideDm ? "var(--primary)" : "var(--muted-foreground)",
                }}
              >
                {overrideDm ? t("accountConfig.override") : t("accountConfig.inherit")}
              </button>
            </div>
            {overrideDm ? (
              <DmPolicySelector value={dmPolicy} onChange={setDmPolicy} />
            ) : (
              <p className="text-[11px] text-[var(--muted-foreground)]">
                {t("accountConfig.inheritDescription")}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? tc("saving") : tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
