"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface InstallOption {
  skillName: string;
  installId: string;
  label: string;
}

interface SkillInstallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstalled: () => void;
}

type InstallTab = "options" | "clawhub";

export function SkillInstallDialog({ open, onOpenChange, onInstalled }: SkillInstallDialogProps) {
  const t = useTranslations("agentDetail");
  const [tab, setTab] = useState<InstallTab>("clawhub");
  const [slug, setSlug] = useState("");
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [installOptions, setInstallOptions] = useState<InstallOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  const fetchInstallOptions = useCallback(async () => {
    setOptionsLoading(true);
    try {
      const res = await fetch("/api/skills");
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as {
        skills?: Array<{
          key: string;
          label?: string;
          metadata?: { install?: Array<{ kind?: string; id?: string }> };
        }>;
      };
      const options: InstallOption[] = [];
      for (const skill of data.skills ?? []) {
        const installs = skill.metadata?.install ?? [];
        for (const [idx, spec] of installs.entries()) {
          options.push({
            skillName: skill.key,
            installId: spec.id ?? `${spec.kind ?? "unknown"}-${idx}`,
            label: `${skill.label ?? skill.key} (${spec.kind ?? "install"})`,
          });
        }
      }
      setInstallOptions(options);
    } catch {
      // best-effort
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setError(null);
      setResult(null);
      void fetchInstallOptions();
    }
  }, [open, fetchInstallOptions]);

  const handleInstallOption = async (opt: InstallOption) => {
    setInstalling(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/skills/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: opt.skillName, installId: opt.installId }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        stderr?: string;
        error?: string;
      };
      if (!res.ok || data.ok === false) {
        setError(data.stderr || data.error || data.message || t("installFailed"));
      } else {
        setResult(data.message || t("installSuccess"));
        onInstalled();
      }
    } catch {
      setError(t("installFailed"));
    } finally {
      setInstalling(false);
    }
  };

  const handleInstallClawHub = async () => {
    setInstalling(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/skills/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "clawhub", slug: slug.trim() }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        stderr?: string;
        error?: string;
      };
      if (!res.ok || data.ok === false) {
        setError(data.stderr || data.error || data.message || t("installFailed"));
      } else {
        setResult(data.message || t("installSuccess"));
        onInstalled();
      }
    } catch {
      setError(t("installFailed"));
    } finally {
      setInstalling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">{t("installSkill")}</DialogTitle>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex gap-1 border-b border-[var(--border)] pb-0">
          {(["options", "clawhub"] as const).map((tabKey) => (
            <button
              key={tabKey}
              type="button"
              className="px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer"
              style={{
                color: tab === tabKey ? "var(--primary)" : "var(--muted-foreground)",
                borderBottom: tab === tabKey ? "2px solid var(--primary)" : "2px solid transparent",
              }}
              onClick={() => {
                setTab(tabKey);
                setError(null);
                setResult(null);
              }}
            >
              {tabKey === "options" ? t("installLocal") : t("installClawHub")}
            </button>
          ))}
        </div>

        <div className="space-y-3 pt-2">
          {tab === "options" ? (
            <div className="space-y-1">
              {optionsLoading ? (
                <div className="flex items-center gap-2 py-4 justify-center">
                  <Loader2 size={14} className="animate-spin text-[var(--muted-foreground)]" />
                </div>
              ) : installOptions.length === 0 ? (
                <p className="text-xs text-[var(--muted-foreground)] py-2">
                  {t("noSkillsAvailable")}
                </p>
              ) : (
                installOptions.map((opt) => (
                  <button
                    key={`${opt.skillName}-${opt.installId}`}
                    type="button"
                    disabled={installing}
                    onClick={() => void handleInstallOption(opt)}
                    className="w-full text-left px-3 py-2 rounded border border-[var(--border)] text-xs hover:bg-[var(--accent)] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {opt.label}
                  </button>
                ))
              )}
            </div>
          ) : (
            <div>
              <label className="text-xs text-[var(--muted-foreground)] block mb-1">
                {t("skillSlug")}
              </label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={t("skillSlugPlaceholder")}
                className="text-xs"
              />
              <Button
                onClick={() => void handleInstallClawHub()}
                disabled={!slug.trim() || installing}
                className="w-full mt-2 cursor-pointer"
                size="sm"
              >
                {installing ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-1" />
                    {t("installing")}
                  </>
                ) : (
                  t("installSkill")
                )}
              </Button>
            </div>
          )}

          {error && (
            <p className="text-xs text-[var(--destructive)] bg-[var(--destructive-muted)] p-2 rounded">
              {error}
            </p>
          )}
          {result && (
            <p className="text-xs text-[var(--success)] bg-[var(--success-muted)] p-2 rounded">
              {result}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
