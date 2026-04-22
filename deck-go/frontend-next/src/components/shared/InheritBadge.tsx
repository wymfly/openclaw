"use client";

import { useTranslations } from "next-intl";

interface InheritBadgeProps {
  mode: "inherit" | "override";
  onReset?: () => void;
}

/**
 * Compact badge indicating whether a config field is inherited from defaults
 * or explicitly overridden at the agent level.
 *
 * - `inherit` mode: amber "arrow-up default" badge with title explaining inheritance
 * - `override` mode: blue "pencil override" badge; shows a reset button when `onReset` is provided
 */
export function InheritBadge({ mode, onReset }: InheritBadgeProps) {
  const t = useTranslations("common");

  if (mode === "inherit") {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none"
        style={{
          color: "var(--warning)",
          backgroundColor: "color-mix(in srgb, var(--warning) 15%, transparent)",
        }}
        title={t("inheritTitle")}
        aria-label={t("inherit")}
      >
        <span aria-hidden="true">&uarr;</span>
        {t("inherit")}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none"
      style={{
        color: "var(--primary)",
        backgroundColor: "color-mix(in srgb, var(--primary) 15%, transparent)",
      }}
      title={t("overrideTitle")}
      aria-label={t("override")}
    >
      <span aria-hidden="true">&#x270E;</span>
      {t("override")}
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="ml-0.5 inline-flex items-center justify-center rounded-full p-0 text-[10px] leading-none transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)]"
          style={{ color: "var(--primary)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--destructive)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--primary)";
          }}
          aria-label={t("reset")}
          title={t("reset")}
        >
          &#x2715;
        </button>
      )}
    </span>
  );
}
