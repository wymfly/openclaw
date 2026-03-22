"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ConditionBuilder } from "@/components/panels/routing/ConditionBuilder";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAgentsStore } from "@/stores/agents";
import { useDeckRoutingStore, type BindingMatch } from "@/stores/deck-routing";

interface BindingDialogProps {
  open: boolean;
  mode: "add" | "edit";
  prefill?: {
    agentId?: string;
    channel?: string;
    accountId?: string;
  };
  onSave: (match: BindingMatch, agentId: string) => void;
  onCancel: () => void;
}

/**
 * Dialog for adding/editing a routing binding.
 * Uses ConditionBuilder for dynamic match-condition editing
 * and real-time validation via deck.routing.validate.
 */
export function BindingDialog({ open, mode, prefill, onSave, onCancel }: BindingDialogProps) {
  const t = useTranslations("routing");
  const tc = useTranslations("common");
  const agents = useAgentsStore((s) => s.agents);
  const validateBinding = useDeckRoutingStore((s) => s.validateBinding);
  const validating = useDeckRoutingStore((s) => s.validating);
  const validationResult = useDeckRoutingStore((s) => s.validationResult);

  const [agentId, setAgentId] = useState("");
  const [match, setMatch] = useState<Partial<BindingMatch>>({});

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      const initial: Partial<BindingMatch> = {};
      if (prefill?.channel) {
        initial.channel = prefill.channel;
      } else {
        initial.channel = ""; // pre-add channel dimension
      }
      if (prefill?.accountId) {
        initial.accountId = prefill.accountId;
      }
      setMatch(initial);
      setAgentId(prefill?.agentId ?? "");
    }
  }, [open, prefill]);

  // Real-time validation when fields change (debounced)
  useEffect(() => {
    if (!match.channel || !agentId) {
      return;
    }
    const timer = setTimeout(() => {
      void validateBinding(match as BindingMatch, agentId);
    }, 500);
    return () => clearTimeout(timer);
  }, [match, agentId, validateBinding]);

  const canSave = Boolean(match.channel && agentId);

  const handleSave = () => {
    if (!canSave) {
      return;
    }
    onSave(match as BindingMatch, agentId);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="bg-[var(--bg-secondary)] border-[var(--border)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-primary)]">
            {mode === "add" ? t("addRule") : t("editRule")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Agent */}
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--text-secondary)]">{t("targetAgent")}</Label>
            <Select value={agentId} onValueChange={(v) => setAgentId(v ?? "")}>
              <SelectTrigger className="bg-[var(--bg-primary)] border-[var(--border)] cursor-pointer">
                <SelectValue placeholder={t("selectAgent")} />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name || a.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Match conditions via ConditionBuilder */}
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--text-secondary)]">{t("matchConditions")}</Label>
            <ConditionBuilder match={match} onChange={setMatch} />
          </div>

          {/* Validation result */}
          {validationResult && (
            <div
              className={cn(
                "rounded-md p-2.5 text-xs border",
                validationResult.ok
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-red-500/10 border-red-500/20 text-red-400",
              )}
            >
              {validationResult.tier && (
                <p>
                  {t("predictedTier")}: <strong>{validationResult.tier}</strong>
                </p>
              )}
              {validationResult.conflicts?.map((c, i) => (
                <p key={i} className="mt-1">
                  {c.type}: {c.detail}
                </p>
              ))}
            </div>
          )}
          {validating && (
            <Badge variant="outline" className="text-[10px] text-[var(--text-secondary)]">
              {t("validating")}
            </Badge>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} className="cursor-pointer">
            {tc("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!canSave} className="cursor-pointer">
            {mode === "add" ? t("addBinding") : tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
