"use client";

import { Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import type { OnboardingData } from "./OnboardingWizard";

type Props = {
  data: OnboardingData;
  onChange: (partial: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
};

const PROVIDERS = [
  { value: "moonshot", label: "Moonshot", defaultModel: "moonshot-v1-8k" },
  { value: "deepseek", label: "DeepSeek", defaultModel: "deepseek-chat" },
  { value: "openai", label: "OpenAI", defaultModel: "gpt-4o" },
  { value: "anthropic", label: "Anthropic", defaultModel: "claude-sonnet-4-20250514" },
  { value: "custom", label: "Custom", defaultModel: "" },
] as const;

export function StepProvider({ data, onChange, onNext, onBack }: Props) {
  const t = useTranslations("onboarding");

  const handleProviderChange = (providerName: string) => {
    const match = PROVIDERS.find((p) => p.value === providerName);
    onChange({
      providerName,
      model: match?.defaultModel ?? "",
    });
  };

  const inputStyle = {
    backgroundColor: "var(--background)",
    color: "var(--foreground)",
    border: "1px solid var(--border)",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Settings size={16} style={{ color: "var(--primary)" }} />
        <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          {t("stepProvider")}
        </span>
      </div>

      {/* Provider selector */}
      <div>
        <label
          className="block text-xs font-medium mb-1"
          style={{ color: "var(--muted-foreground)" }}
        >
          {t("provider")}
        </label>
        <select
          value={data.providerName ?? ""}
          onChange={(e) => handleProviderChange(e.target.value)}
          className="w-full text-sm rounded px-3 py-2"
          style={inputStyle}
        >
          <option value="">{t("selectProvider")}</option>
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* API Key */}
      <div>
        <label
          className="block text-xs font-medium mb-1"
          style={{ color: "var(--muted-foreground)" }}
        >
          {t("apiKey")}
        </label>
        <input
          type="password"
          value={data.apiKey ?? ""}
          onChange={(e) => onChange({ apiKey: e.target.value })}
          placeholder="sk-..."
          className="w-full text-sm rounded px-3 py-2"
          style={inputStyle}
        />
      </div>

      {/* Model name */}
      <div>
        <label
          className="block text-xs font-medium mb-1"
          style={{ color: "var(--muted-foreground)" }}
        >
          {t("model")}
        </label>
        <input
          type="text"
          value={data.model ?? ""}
          onChange={(e) => onChange({ model: e.target.value })}
          placeholder={t("modelPlaceholder")}
          className="w-full text-sm rounded px-3 py-2"
          style={inputStyle}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          className="text-xs px-4 py-2 rounded hover:opacity-80 transition-opacity"
          style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}
        >
          {t("back")}
        </button>
        <div className="flex gap-2">
          <button
            onClick={onNext}
            className="text-xs px-4 py-2 rounded hover:opacity-80 transition-opacity"
            style={{ color: "var(--muted-foreground)" }}
          >
            {t("skipForNow")}
          </button>
          <button
            onClick={onNext}
            className="text-xs px-4 py-2 rounded hover:opacity-80 transition-opacity"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            {t("next")}
          </button>
        </div>
      </div>
    </div>
  );
}
