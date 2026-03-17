"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
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
    <div
      className="flex items-center justify-center h-screen"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div
        className="w-full max-w-lg rounded-xl border p-6 shadow-lg"
        style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        {/* Title */}
        <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          {t("title")}
        </h1>
        <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
          {t("subtitle")}
        </p>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
                style={{
                  backgroundColor: s <= step ? "var(--accent)" : "var(--bg-primary)",
                  color: s <= step ? "#fff" : "var(--text-secondary)",
                }}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className="w-10 h-0.5 rounded"
                  style={{ backgroundColor: s < step ? "var(--accent)" : "var(--border)" }}
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
      </div>
    </div>
  );
}
