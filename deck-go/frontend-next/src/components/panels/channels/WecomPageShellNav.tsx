"use client";

import { useTranslations } from "next-intl";
import type { ChannelUiPageKey } from "@/features/channels/registry/channel-ui-types";

export function WecomPageShellNav({
  activePage,
  pages,
  onSelect,
}: {
  activePage: ChannelUiPageKey;
  pages: ChannelUiPageKey[];
  onSelect: (page: ChannelUiPageKey) => void;
}) {
  const t = useTranslations("channels.wecomShell");

  return (
    <div className="mx-4 mt-3 shrink-0" data-testid="wecom-shell-nav">
      <div
        className="mb-2 text-[11px] font-medium uppercase tracking-wide"
        style={{ color: "var(--muted-foreground)" }}
      >
        {t("sectionLabel")}
      </div>
      <div className="flex flex-wrap gap-2">
        {pages.map((page) => (
          <button
            key={page}
            type="button"
            aria-pressed={activePage === page}
            onClick={() => onSelect(page)}
            className="rounded-full border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
            style={{
              borderColor: activePage === page ? "var(--primary)" : "var(--border)",
              backgroundColor: activePage === page ? "var(--primary-muted)" : "var(--background)",
              color: activePage === page ? "var(--primary)" : "var(--foreground)",
            }}
          >
            {t(page)}
          </button>
        ))}
      </div>
    </div>
  );
}
