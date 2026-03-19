"use client";

import { ShieldCheck, Wallet, Bell, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useSettingsStore, type NotificationPrefs } from "@/stores/settings";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const NOTIFICATION_OPTIONS: {
  key: keyof NotificationPrefs;
  labelKey: string;
  descKey: string;
  icon: LucideIcon;
}[] = [
  {
    key: "approvals",
    labelKey: "notifyApprovals",
    descKey: "notifyApprovalsDesc",
    icon: ShieldCheck,
  },
  { key: "budget", labelKey: "notifyBudget", descKey: "notifyBudgetDesc", icon: Wallet },
  { key: "alerts", labelKey: "notifyAlerts", descKey: "notifyAlertsDesc", icon: Bell },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function NotificationSection() {
  const t = useTranslations("settings");
  const notificationPrefs = useSettingsStore((s) => s.notificationPrefs);
  const setNotificationPrefs = useSettingsStore((s) => s.setNotificationPrefs);
  const saveSettings = useSettingsStore((s) => s.saveSettings);

  const handleToggle = (key: keyof NotificationPrefs) => {
    setNotificationPrefs({ [key]: !notificationPrefs[key] });
    void saveSettings();
  };

  return (
    <div className="space-y-5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
        {t("notifications")}
      </h3>

      <div className="space-y-2">
        {NOTIFICATION_OPTIONS.map(({ key, labelKey, descKey, icon: Icon }) => {
          const enabled = notificationPrefs[key];
          return (
            <Card
              key={key}
              className={cn(
                "ring-1 transition-all duration-150 cursor-pointer",
                enabled
                  ? "ring-[var(--accent)]/20 bg-[var(--accent-muted)]/30"
                  : "ring-[var(--border)]",
              )}
              onClick={() => handleToggle(key)}
            >
              <CardContent className="flex items-center gap-3 p-3">
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-colors duration-150",
                    enabled
                      ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                      : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
                  )}
                >
                  <Icon size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className={cn(
                      "text-xs font-medium transition-colors",
                      enabled ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]",
                    )}
                  >
                    {t(labelKey)}
                  </span>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 leading-tight">
                    {t(descKey)}
                  </p>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={() => handleToggle(key)}
                  onClick={(e) => e.stopPropagation()}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
