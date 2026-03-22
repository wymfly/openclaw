"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeckRoutingStore } from "@/stores/deck-routing";
import { ScopeStrategyCard } from "./ScopeStrategyCard";

const SCOPE_MODES = ["main", "per-peer", "per-channel-peer", "per-account-channel-peer"] as const;

export function ScopeSelector() {
  const t = useTranslations("sessions");
  const tc = useTranslations("common");
  const { dmScope, fetchBindings } = useDeckRoutingStore();
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchBindings();
  }, [fetchBindings]);

  const currentScope = dmScope ?? "main";

  const handleCardClick = (mode: string) => {
    if (mode === currentScope) {
      return;
    }
    setConfirmTarget(mode);
  };

  const handleConfirm = async () => {
    if (!confirmTarget) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/config/patch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patch: { session: { dmScope: confirmTarget } },
        }),
      });
      if (res.ok) {
        await fetchBindings();
      }
    } finally {
      setSaving(false);
      setConfirmTarget(null);
    }
  };

  return (
    <div className="p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t("scopeTitle")}</h3>
        <p className="text-xs text-[var(--text-secondary)] mt-1">{t("scopeDescription")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SCOPE_MODES.map((mode) => (
          <ScopeStrategyCard
            key={mode}
            mode={mode}
            title={t(`scopeMode.${mode}.title`)}
            description={t(`scopeMode.${mode}.description`)}
            selected={currentScope === mode}
            onClick={() => handleCardClick(mode)}
          />
        ))}
      </div>

      {/* Confirmation dialog */}
      <Dialog
        open={confirmTarget !== null}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("confirmScopeChange")}</DialogTitle>
            <DialogDescription>
              {t("confirmScopeChangeDesc", {
                from: currentScope,
                to: confirmTarget ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmTarget(null)} disabled={saving}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleConfirm} disabled={saving}>
              {saving ? tc("loading") : t("changeScope")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
