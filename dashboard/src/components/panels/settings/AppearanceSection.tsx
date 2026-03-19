"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";
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
      <h3 className="mb-3 text-sm font-semibold text-foreground">{t("appearance")}</h3>
      <Card size="sm">
        <CardContent className="flex flex-col gap-4">
          {/* Theme */}
          <div className="flex items-center gap-3">
            <span className="w-16 text-xs font-medium text-muted-foreground">{t("theme")}</span>
            <div className="flex gap-1">
              {THEMES.map(({ value, labelKey }) => (
                <Button
                  key={value}
                  size="xs"
                  variant={theme === value ? "default" : "outline"}
                  className={cn("font-medium", theme !== value && "text-muted-foreground")}
                  onClick={() => setTheme(value)}
                >
                  {t(labelKey)}
                </Button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div className="flex items-center gap-3">
            <span className="w-16 text-xs font-medium text-muted-foreground">{t("language")}</span>
            <div className="flex gap-1">
              {LANGUAGES.map(({ value, label }) => (
                <Button
                  key={value}
                  size="xs"
                  variant={locale === value ? "default" : "outline"}
                  className={cn("font-medium", locale !== value && "text-muted-foreground")}
                  onClick={() => setLocale(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
