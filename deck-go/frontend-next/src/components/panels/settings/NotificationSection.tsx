"use client";

import { useTranslations } from "next-intl";
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
    // Auto-save after toggle
    void saveSettings();
  };

  return (
    <section>
      <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
        {t("notifications")}
      </h3>
      <div
        className="rounded-lg border p-4 flex flex-col gap-3"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        {NOTIFICATION_OPTIONS.map(({ key, labelKey }) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={notificationPrefs[key]}
              onChange={() => handleToggle(key)}
              className="rounded"
              style={{ accentColor: "var(--primary)" }}
            />
            <span className="text-xs" style={{ color: "var(--foreground)" }}>
              {t(labelKey)}
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
