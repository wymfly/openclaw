"use client";

import { Check, Loader2, X, Plug } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deckFetch } from "@/lib/deck-client";

interface PluginApprovalEntry {
  id: string;
  pluginId?: string;
  command?: string;
  description?: string;
  createdAtMs?: number;
  expiresAtMs?: number;
  status?: string;
  decision?: string | null;
}

export function PluginApprovalList() {
  const t = useTranslations("approvals");
  const [entries, setEntries] = useState<PluginApprovalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await deckFetch("/api/approvals/plugins");
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: "Request failed" }))) as {
          error?: string;
        };
        setError(err.error ?? "Request failed");
        return;
      }
      const data = (await res.json()) as
        | PluginApprovalEntry[]
        | { entries?: PluginApprovalEntry[] };
      // Handle both raw array and wrapped response
      const list = Array.isArray(data) ? data : (data.entries ?? []);
      setEntries(list);
    } catch {
      setError("Failed to fetch plugin approvals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  const handleResolve = useCallback(
    async (id: string, decision: "allow-once" | "allow-always" | "deny") => {
      setResolving(id);
      setError(null);
      try {
        const res = await deckFetch("/api/approvals/plugins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, decision }),
        });
        if (res.ok) {
          setEntries((prev) => prev.filter((e) => e.id !== id));
        } else {
          const err = (await res.json().catch(() => ({ error: "Resolve failed" }))) as {
            error?: string;
          };
          setError(err.error ?? t("pluginResolveFailed"));
        }
      } catch {
        setError(t("pluginResolveFailed"));
      } finally {
        setResolving(null);
      }
    },
    [t],
  );

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center gap-2 justify-center h-full">
        <Loader2 size={14} className="animate-spin text-[var(--muted-foreground)]" />
        <span className="text-xs text-[var(--muted-foreground)]">{t("pluginLoading")}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <span className="text-sm text-[var(--destructive)]">{error}</span>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <span className="text-sm text-[var(--muted-foreground)]">{t("pluginNoPending")}</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {entries.map((entry) => {
        const isResolving = resolving === entry.id;
        const isExpired =
          entry.expiresAtMs && Number.isFinite(entry.expiresAtMs)
            ? entry.expiresAtMs <= Date.now()
            : false;

        return (
          <div
            key={entry.id}
            className="rounded-lg border p-3"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--card)",
              opacity: isExpired ? 0.5 : 1,
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Plug size={14} className="text-purple-400 shrink-0" />
              <span className="text-xs font-medium text-[var(--foreground)] truncate">
                {entry.pluginId ?? entry.id}
              </span>
              {entry.status && (
                <Badge
                  variant="outline"
                  className="text-[10px] border-[var(--border)] text-[var(--muted-foreground)]"
                >
                  {entry.status}
                </Badge>
              )}
              {entry.decision && (
                <Badge
                  variant="outline"
                  className={`text-[10px] ${entry.decision === "allow" ? "bg-[var(--success-muted)] text-[var(--success)]" : "bg-[var(--destructive-muted)] text-[var(--destructive)]"}`}
                >
                  {entry.decision}
                </Badge>
              )}
              {isExpired && (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-[var(--warning-muted)] text-[var(--warning-muted-text)]"
                >
                  {t("pluginExpired")}
                </Badge>
              )}
            </div>

            {entry.command && (
              <code
                className="text-xs font-mono block mb-2 truncate"
                style={{ color: "var(--foreground)" }}
              >
                {entry.command}
              </code>
            )}

            {entry.description && (
              <p className="text-[10px] text-[var(--muted-foreground)] mb-2 line-clamp-2">
                {entry.description}
              </p>
            )}

            <div className="flex items-center gap-4 text-[10px] text-[var(--muted-foreground)] mb-2">
              {entry.createdAtMs && <span>{new Date(entry.createdAtMs).toLocaleString()}</span>}
              <span className="font-mono">{entry.id.slice(0, 12)}</span>
            </div>

            {/* Resolve actions — only for unresolved entries */}
            {!entry.decision && !isExpired && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[10px] text-[var(--success)] border-[var(--success)]/20 hover:bg-[var(--success-muted)] cursor-pointer"
                  disabled={isResolving}
                  onClick={() => handleResolve(entry.id, "allow-once")}
                >
                  {isResolving ? (
                    <Loader2 size={10} className="animate-spin mr-1" />
                  ) : (
                    <Check size={10} className="mr-1" />
                  )}
                  {t("pluginAllowOnce")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[10px] text-[var(--primary)] border-[var(--primary)]/20 hover:bg-[var(--primary-muted)] cursor-pointer"
                  disabled={isResolving}
                  onClick={() => handleResolve(entry.id, "allow-always")}
                >
                  <Check size={10} className="mr-1" />
                  {t("pluginAllowAlways")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[10px] text-[var(--destructive)] border-[var(--destructive)]/20 hover:bg-[var(--destructive-muted)] cursor-pointer"
                  disabled={isResolving}
                  onClick={() => handleResolve(entry.id, "deny")}
                >
                  <X size={10} className="mr-1" />
                  {t("pluginDeny")}
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
