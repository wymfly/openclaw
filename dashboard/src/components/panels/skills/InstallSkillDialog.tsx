"use client";

import { Download, Loader2, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useNotificationsStore } from "@/stores/notifications";
import { useSkillsStore, type SkillEntry, type SkillInstallOption } from "@/stores/skills";

interface InstallSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InstallSkillDialog({ open, onOpenChange }: InstallSkillDialogProps) {
  const t = useTranslations("skills");
  const tc = useTranslations("common");
  const { skills, fetchSkills, installSkill } = useSkillsStore();
  const addToast = useNotificationsStore((s) => s.addToast);

  const [search, setSearch] = useState("");
  const [installingIds, setInstallingIds] = useState<Record<string, boolean>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Refresh skills list when dialog opens
  useEffect(() => {
    if (open) {
      setSearch("");
      setErrorMsg(null);
      setRefreshing(true);
      void fetchSkills().finally(() => setRefreshing(false));
    }
  }, [open, fetchSkills]);

  // Filter skills that have installOptions
  const installableSkills = useMemo(() => {
    const withOptions = skills.filter((s) => s.installOptions && s.installOptions.length > 0);
    if (!search.trim()) {
      return withOptions;
    }
    const q = search.toLowerCase();
    return withOptions.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q),
    );
  }, [skills, search]);

  const handleInstall = useCallback(
    async (skill: SkillEntry, opt: SkillInstallOption) => {
      const compositeKey = `${skill.key}:${opt.id}`;
      setInstallingIds((prev) => ({ ...prev, [compositeKey]: true }));
      setErrorMsg(null);
      try {
        const ok = await installSkill(skill.name, opt.id);
        if (ok) {
          addToast("success", t("installSuccess", { name: opt.label }));
          onOpenChange(false);
        } else {
          setErrorMsg(t("installFailed", { name: opt.label }));
        }
      } catch {
        setErrorMsg(t("installFailed", { name: opt.label }));
      } finally {
        setInstallingIds((prev) => ({ ...prev, [compositeKey]: false }));
      }
    },
    [installSkill, addToast, t, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("installDialogTitle")}</DialogTitle>
          <DialogDescription>{t("installDialogDescription")}</DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-8 h-8 text-xs"
          />
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="text-xs px-3 py-2 rounded-lg bg-[var(--skill-warning-bg)] text-[var(--destructive)]">
            {errorMsg}
          </div>
        )}

        {/* Skills list */}
        <div className="flex flex-col gap-2 min-h-[120px]">
          {refreshing ? (
            <div className="flex items-center justify-center py-8 text-[var(--muted-foreground)]">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : installableSkills.length === 0 ? (
            <div className="text-xs text-center py-8 text-[var(--muted-foreground)]">
              {t("noInstallableSkills")}
            </div>
          ) : (
            installableSkills.map((skill) => (
              <div
                key={skill.key}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] p-3 space-y-2"
              >
                {/* Skill header */}
                <div className="flex items-start gap-2">
                  {skill.emoji && <span className="text-sm shrink-0">{skill.emoji}</span>}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[var(--foreground)] truncate">
                      {skill.name}
                    </p>
                    {skill.description && (
                      <p className="text-[11px] text-[var(--muted-foreground)] line-clamp-2 mt-0.5">
                        {skill.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Install options */}
                {skill.installOptions?.map((opt) => {
                  const compositeKey = `${skill.key}:${opt.id}`;
                  const isInstalling = !!installingIds[compositeKey];
                  return (
                    <div
                      key={opt.id}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-[var(--muted)] ring-1 ring-[var(--border-subtle)]"
                    >
                      <div className="text-xs min-w-0">
                        <span className="font-medium text-[var(--foreground)]">{opt.label}</span>
                        {opt.bins.length > 0 && (
                          <span className="ml-1.5 text-[var(--muted-foreground)]">
                            ({t("requiredBins")}: {opt.bins.join(", ")})
                          </span>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="xs"
                        className="gap-1 shrink-0 ml-2"
                        onClick={() => void handleInstall(skill, opt)}
                        disabled={isInstalling}
                      >
                        {isInstalling ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            {t("installing")}
                          </>
                        ) : (
                          <>
                            <Download size={12} />
                            {t("install")}
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer with close */}
        <div className="flex justify-end pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer"
          >
            {tc("cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
