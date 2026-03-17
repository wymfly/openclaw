"use client";

import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/config";
import { useUIStore, type Theme } from "@/stores/ui";

const THEMES: { value: Theme; labelKey: string }[] = [
  { value: "system", labelKey: "themeSystem" },
  { value: "dark", labelKey: "themeDark" },
  { value: "light", labelKey: "themeLight" },
];

const LANGUAGES: { value: Locale; label: string }[] = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
];

export function AppearanceSection() {
  const t = useTranslations("settings");
  const theme = useUIStore((s) => s.theme);
  const locale = useUIStore((s) => s.locale);
  const setTheme = useUIStore((s) => s.setTheme);
  const setLocale = useUIStore((s) => s.setLocale);

  return (
    <section>
      <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
        {t("appearance")}
      </h3>
      <div
        className="rounded-lg border p-4 flex flex-col gap-4"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}
      >
        {/* Theme */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium w-16" style={{ color: "var(--text-secondary)" }}>
            {t("theme")}
          </span>
          <div className="flex gap-1">
            {THEMES.map(({ value, labelKey }) => (
              <button
                key={value}
                type="button"
                className="px-3 py-1.5 text-xs rounded-md font-medium transition-colors"
                style={{
                  backgroundColor: theme === value ? "var(--accent)" : "var(--bg-primary)",
                  color: theme === value ? "var(--accent-fg)" : "var(--text-secondary)",
                  border: theme === value ? "none" : "1px solid var(--border)",
                }}
                onClick={() => setTheme(value)}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium w-16" style={{ color: "var(--text-secondary)" }}>
            {t("language")}
          </span>
          <div className="flex gap-1">
            {LANGUAGES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className="px-3 py-1.5 text-xs rounded-md font-medium transition-colors"
                style={{
                  backgroundColor: locale === value ? "var(--accent)" : "var(--bg-primary)",
                  color: locale === value ? "var(--accent-fg)" : "var(--text-secondary)",
                  border: locale === value ? "none" : "1px solid var(--border)",
                }}
                onClick={() => setLocale(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
