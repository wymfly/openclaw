"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { StepConnection } from "./StepConnection";
import { StepFirstChat } from "./StepFirstChat";
import { StepProvider } from "./StepProvider";

export type OnboardingData = {
  gatewayUrl: string;
  gatewayToken: string;
  providerName?: string;
  apiKey?: string;
  model?: string;
};

const STEPS = [1, 2, 3] as const;

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const t = useTranslations("onboarding");
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({
    gatewayUrl: "ws://localhost:18789",
    gatewayToken: "",
  });

  const updateData = (partial: Partial<OnboardingData>) =>
    setData((prev) => ({ ...prev, ...partial }));

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-bold">{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>

        <CardContent>
          {/* Step indicator */}
          <div className="mb-6 flex items-center gap-2">
            {STEPS.map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                    s <= step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {s}
                </div>
                {s < 3 && (
                  <div
                    className={cn(
                      "h-0.5 w-10 rounded transition-colors",
                      s < step ? "bg-primary" : "bg-border",
                    )}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step content */}
          {step === 1 && (
            <StepConnection data={data} onChange={updateData} onNext={() => setStep(2)} />
          )}
          {step === 2 && (
            <StepProvider
              data={data}
              onChange={updateData}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <StepFirstChat data={data} onComplete={onComplete} onBack={() => setStep(2)} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
