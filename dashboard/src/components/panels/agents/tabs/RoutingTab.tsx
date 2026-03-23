"use client";

import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { BindingDialog } from "@/components/shared/BindingDialog";
import { TierBadge } from "@/components/shared/TierBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { navigateToRouting } from "@/lib/panel-navigation";
import { useDeckRoutingStore, type BindingMatch } from "@/stores/deck-routing";

interface RoutingTabProps {
  agentId: string;
}

export function RoutingTab({ agentId }: RoutingTabProps) {
  const t = useTranslations("agentDetail");
  const { bindings, configHash, loading, fetchBindings, addBinding, removeBinding } =
    useDeckRoutingStore();
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    void fetchBindings(agentId);
  }, [agentId, fetchBindings]);

  const handleAddBinding = useCallback(
    async (match: BindingMatch, targetAgentId: string) => {
      if (!configHash) {
        return;
      }
      const ok = await addBinding(match, targetAgentId, configHash);
      if (ok) {
        setDialogOpen(false);
        void fetchBindings(agentId);
      }
    },
    [addBinding, configHash, fetchBindings, agentId],
  );

  const handleRemove = useCallback(
    async (bindingId: string) => {
      if (!configHash) {
        return;
      }
      await removeBinding(bindingId, configHash);
      void fetchBindings(agentId);
    },
    [removeBinding, configHash, fetchBindings, agentId],
  );

  return (
    <div className="space-y-3">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDialogOpen(true)}
          className="gap-1.5 text-xs cursor-pointer"
        >
          <Plus size={14} />
          {t("addBinding")}
        </Button>
        <button
          onClick={() => navigateToRouting(agentId)}
          className="flex items-center gap-1 text-[10px] text-[var(--accent)] hover:underline cursor-pointer"
        >
          {t("viewAllRouting")}
          <ExternalLink size={10} />
        </button>
      </div>

      {/* Bindings list */}
      {loading && bindings.length === 0 && (
        <div className="py-6 text-center text-xs text-[var(--text-secondary)]">Loading...</div>
      )}

      {!loading && bindings.length === 0 && (
        <div className="py-6 text-center text-xs text-[var(--text-secondary)]">
          {t("noBindings")}
        </div>
      )}

      <div className="space-y-2">
        {bindings.map((binding) => (
          <Card
            key={binding.id}
            className="p-3 bg-[var(--bg-primary)] border-[var(--border)] group"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <TierBadge tier={binding.tier} />
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono border-[var(--border-subtle)]"
                >
                  {binding.match.channel}
                </Badge>
                {binding.match.accountId && (
                  <span className="text-[10px] text-[var(--text-secondary)] font-mono truncate">
                    {binding.match.accountId}
                  </span>
                )}
                {binding.match.peer && (
                  <span className="text-[10px] text-[var(--text-secondary)] font-mono truncate">
                    {binding.match.peer.kind}:{binding.match.peer.id}
                  </span>
                )}
              </div>
              <button
                onClick={() => void handleRemove(binding.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-secondary)] hover:text-[var(--danger)] cursor-pointer"
                aria-label="Remove binding"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </Card>
        ))}
      </div>

      <BindingDialog
        open={dialogOpen}
        mode="add"
        prefill={{ agentId }}
        onSave={(match, targetAgentId) => void handleAddBinding(match, targetAgentId)}
        onCancel={() => setDialogOpen(false)}
      />
    </div>
  );
}
