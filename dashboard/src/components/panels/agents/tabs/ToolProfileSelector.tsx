"use client";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useRef } from "react";
import { navigateToAgent } from "@/lib/panel-navigation";

const PROFILES = [
  { key: "minimal", count: 1 },
  { key: "coding", count: 18 },
  { key: "messaging", count: 5 },
  { key: "full", count: 30 },
] as const;

type ProfileKey = (typeof PROFILES)[number]["key"];

interface ToolProfileSelectorProps {
  value: string;
  onChange: (profile: string) => void;
  agentId: string;
}

export default function ToolProfileSelector({
  value,
  onChange,
  agentId,
}: ToolProfileSelectorProps) {
  const t = useTranslations("agentDetail.config");
  const groupRef = useRef<HTMLDivElement>(null);

  const profileLabel = (key: ProfileKey): string => {
    switch (key) {
      case "minimal":
        return t("profileMinimal");
      case "coding":
        return t("profileCoding");
      case "messaging":
        return t("profileMessaging");
      case "full":
        return t("profileFull");
    }
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      const currentIndex = PROFILES.findIndex((p) => p.key === value);
      let nextIndex = currentIndex;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % PROFILES.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        nextIndex = (currentIndex - 1 + PROFILES.length) % PROFILES.length;
      } else {
        return;
      }

      const nextProfile = PROFILES[nextIndex];
      onChange(nextProfile.key);

      // Focus the newly selected pill
      const group = groupRef.current;
      if (group) {
        const buttons = group.querySelectorAll<HTMLButtonElement>('[role="radio"]');
        buttons[nextIndex]?.focus();
      }
    },
    [value, onChange],
  );

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">{t("toolProfile")}</span>

      <div
        ref={groupRef}
        role="radiogroup"
        aria-label={t("toolProfile")}
        className="flex flex-wrap gap-2"
      >
        {PROFILES.map((profile) => {
          const isActive = value === profile.key;
          return (
            <button
              key={profile.key}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={`${profileLabel(profile.key)} — ${t("toolCount", { count: profile.count })}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(profile.key)}
              onKeyDown={handleKeyDown}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground hover:bg-accent"
              }`}
            >
              {profileLabel(profile.key)}
              <span className={isActive ? "text-primary-foreground/70" : "text-muted-foreground"}>
                ({profile.count})
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => navigateToAgent(agentId, "context")}
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded self-start"
        aria-label={t("viewPolicyTrace")}
      >
        <ArrowRight size={12} />
        {t("viewPolicyTrace")}
      </button>
    </div>
  );
}
