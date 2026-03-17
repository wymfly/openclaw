"use client";

import { Globe, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useGatewayStore } from "@/stores/gateway";
import { useUIStore } from "@/stores/ui";

const statusColors: Record<string, string> = {
  connected: "var(--status-connected)",
  disconnected: "var(--status-disconnected)",
  reconnecting: "var(--status-reconnecting)",
  connecting: "var(--status-reconnecting)",
  error: "var(--status-disconnected)",
};

export function HeaderBar() {
  const tNav = useTranslations("nav");
  const tHeader = useTranslations("header");
  const { status } = useGatewayStore();
  const { activePanel, theme, locale, setTheme, setLocale } = useUIStore();

  const statusLabel =
    status === "connected"
      ? tHeader("connected")
      : status === "reconnecting" || status === "connecting"
        ? tHeader("reconnecting")
        : tHeader("disconnected");

  const toggleTheme = () => {
    if (theme === "dark") {
      setTheme("light");
    } else if (theme === "light") {
      setTheme("system");
    } else {
      setTheme("dark");
    }
  };

  const toggleLocale = () => {
    setLocale(locale === "zh" ? "en" : "zh");
  };

  return (
    <header
      className="flex items-center justify-between h-12 px-4 border-b shrink-0"
      style={{
        borderColor: "var(--border)",
        backgroundColor: "var(--bg-secondary)",
      }}
    >
      {/* Current panel name */}
      <h1 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {tNav(activePanel)}
      </h1>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* Gateway status */}
        <div
          className="flex items-center gap-1.5 text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: statusColors[status] ?? "var(--status-disconnected)" }}
          />
          {statusLabel}
        </div>

        {/* Locale toggle */}
        <button
          onClick={toggleLocale}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:opacity-80 transition-opacity"
          style={{ color: "var(--text-secondary)" }}
        >
          <Globe size={14} />
          {locale === "zh" ? "EN" : "ZH"}
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center p-1 rounded hover:opacity-80 transition-opacity"
          style={{ color: "var(--text-secondary)" }}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
