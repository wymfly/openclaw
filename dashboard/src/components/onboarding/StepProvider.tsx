"use client";

import { Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  return (
    <div className="space-y-4">
      <div className="mb-2 flex items-center gap-2">
        <Settings size={16} className="text-primary" />
        <span className="text-sm font-semibold text-foreground">{t("stepProvider")}</span>
      </div>

      {/* Provider selector */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{t("provider")}</Label>
        <Select
          value={data.providerName ?? ""}
          onValueChange={(value) => {
            if (value) {
              handleProviderChange(value);
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("selectProvider")} />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* API Key */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{t("apiKey")}</Label>
        <Input
          type="password"
          value={data.apiKey ?? ""}
          onChange={(e) => onChange({ apiKey: e.target.value })}
          placeholder="sk-..."
          className="text-sm"
        />
      </div>

      {/* Model name */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{t("model")}</Label>
        <Input
          type="text"
          value={data.model ?? ""}
          onChange={(e) => onChange({ model: e.target.value })}
          placeholder={t("modelPlaceholder")}
          className="text-sm"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" size="sm" onClick={onBack}>
          {t("back")}
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onNext}>
            {t("skipForNow")}
          </Button>
          <Button size="sm" onClick={onNext}>
            {t("next")}
          </Button>
        </div>
      </div>
    </div>
  );
}
