"use client";

import { useTranslations } from "next-intl";

const POLICIES = ["pairing", "allowlist", "open", "disabled"] as const;

interface DmPolicySelectorProps {
  value: string;
  onChange: (policy: string) => void;
}

export function DmPolicySelector({ value, onChange }: DmPolicySelectorProps) {
  const t = useTranslations("channels.settings");

  return (
    <div>
      <h4 className="text-xs font-semibold mb-2" style={{ color: "var(--foreground)" }}>
        {t("dmPolicy.title")}
      </h4>
      <div role="radiogroup" aria-label={t("dmPolicy.title")} className="space-y-2">
        {POLICIES.map((policy) => {
          const selected = value === policy;
          return (
            <div
              key={policy}
              role="radio"
              aria-checked={selected}
              tabIndex={0}
              onClick={() => onChange(policy)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  onChange(policy);
                }
              }}
              className="flex items-start gap-3 rounded-lg px-3 py-2.5 border cursor-pointer transition-colors"
              style={{
                borderColor: selected ? "var(--primary)" : "var(--border)",
                backgroundColor: selected
                  ? "color-mix(in srgb, var(--primary) 8%, var(--card))"
                  : "var(--card)",
              }}
            >
              {/* Radio indicator */}
              <span
                className="mt-0.5 shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center"
                style={{
                  borderColor: selected ? "var(--primary)" : "var(--border)",
                }}
              >
                {selected && (
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: "var(--primary)" }}
                  />
                )}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                    {t(`dmPolicy.${policy}`)}
                  </span>
                  {policy === "pairing" && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: "var(--primary-muted)",
                        color: "var(--primary)",
                      }}
                    >
                      {t("dmPolicy.recommended")}
                    </span>
                  )}
                </div>
                <p
                  className="text-[11px] mt-0.5 leading-relaxed"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {t(`dmPolicy.${policy}Desc`)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
