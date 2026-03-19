"use client";

import { Check, Hexagon, Radio, Settings, MessageCircle, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { StepConnection } from "./StepConnection";
import { StepFirstChat } from "./StepFirstChat";
import { StepProvider } from "./StepProvider";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type OnboardingData = {
  gatewayUrl: string;
  gatewayToken: string;
  providerName?: string;
  apiKey?: string;
  model?: string;
};

/* ------------------------------------------------------------------ */
/*  Step indicator                                                     */
/* ------------------------------------------------------------------ */

interface StepDef {
  id: number;
  labelKey: string;
  icon: LucideIcon;
}

const STEPS: StepDef[] = [
  { id: 1, labelKey: "stepConnection", icon: Radio },
  { id: 2, labelKey: "stepProvider", icon: Settings },
  { id: 3, labelKey: "stepChat", icon: MessageCircle },
];

function StepIndicator({ steps, current }: { steps: StepDef[]; current: number }) {
  const t = useTranslations("onboarding");
  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((step, i) => {
        const isCompleted = step.id < current;
        const isActive = step.id === current;
        const isFuture = step.id > current;
        const Icon = step.icon;

        return (
          <div key={step.id} className="flex items-center">
            {/* Step circle */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-full transition-all duration-300",
                  isCompleted &&
                    "bg-[var(--success-muted)] text-[var(--success-muted-text)] ring-1 ring-[var(--success)]/30",
                  isActive &&
                    "bg-[var(--accent-muted)] text-[var(--accent)] ring-2 ring-[var(--accent)]/40 shadow-[0_0_12px_var(--accent)]/20",
                  isFuture &&
                    "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] ring-1 ring-[var(--border)]",
                )}
              >
                {isCompleted ? <Check size={16} /> : <Icon size={16} />}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium transition-colors whitespace-nowrap",
                  isActive ? "text-[var(--accent)]" : "text-[var(--text-secondary)]",
                )}
              >
                {t(step.labelKey)}
              </span>
            </div>

            {/* Connector line */}
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "w-14 h-px mx-2 mb-5 transition-colors duration-300",
                  step.id < current ? "bg-[var(--success)]" : "bg-[var(--border)]",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Wizard                                                             */
/* ------------------------------------------------------------------ */

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
    <div className="flex h-screen items-center justify-center bg-[var(--bg-primary)]">
      <div className="w-full max-w-lg px-4">
        {/* Brand header */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--accent-muted)] ring-1 ring-[var(--accent)]/20 shadow-[0_0_24px_var(--accent)]/15">
            <Hexagon size={28} className="text-[var(--accent)]" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">
              {t("title")}
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">{t("subtitle")}</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="mb-8">
          <StepIndicator steps={STEPS} current={step} />
        </div>

        {/* Step content card */}
        <div className="rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)] p-6 transition-panel">
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

        {/* Footer */}
        <p className="text-center text-[10px] text-[var(--text-secondary)] mt-6 font-mono">
          OpenClaw Deck v0.1
        </p>
      </div>
    </div>
  );
}
