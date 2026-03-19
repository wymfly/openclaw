"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSettingsStore, type NotificationPrefs } from "@/stores/settings";

const NOTIFICATION_OPTIONS: { key: keyof NotificationPrefs; labelKey: string }[] = [
  { key: "approvals", labelKey: "notifyApprovals" },
  { key: "budget", labelKey: "notifyBudget" },
  { key: "alerts", labelKey: "notifyAlerts" },
];

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
    <section>
      <h3 className="mb-3 text-sm font-semibold text-foreground">{t("notifications")}</h3>
      <Card size="sm">
        <CardContent className="flex flex-col gap-3">
          {NOTIFICATION_OPTIONS.map(({ key, labelKey }) => (
            <div key={key} className="flex items-center justify-between">
              <Label className="cursor-pointer text-xs text-foreground">{t(labelKey)}</Label>
              <Switch checked={notificationPrefs[key]} onCheckedChange={() => handleToggle(key)} />
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
