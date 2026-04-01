"use client";

import { useTranslations } from "next-intl";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export interface WizardStep {
  title: string;
  content: React.ReactNode;
  validate?: () => boolean | Promise<boolean>;
}

export interface ConfigWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  steps: WizardStep[];
  onComplete: () => void;
}

export function ConfigWizard({ open, onOpenChange, title, steps, onComplete }: ConfigWizardProps) {
  const t = useTranslations("wizard");
  const tc = useTranslations("common");

  const [currentStep, setCurrentStep] = useState(0);
  const [validating, setValidating] = useState(false);

  const isLastStep = currentStep === steps.length - 1;
  const step = steps[currentStep];

  const handleNext = useCallback(async () => {
    if (!step) {
      return;
    }

    if (step.validate) {
      setValidating(true);
      try {
        const valid = await step.validate();
        if (!valid) {
          return;
        }
      } finally {
        setValidating(false);
      }
    }

    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep((s) => s + 1);
    }
  }, [step, isLastStep, onComplete]);

  const handleBack = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setCurrentStep(0);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  if (!step) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-xs text-[var(--muted-foreground)]">
            {t("stepProgress", { current: currentStep + 1, total: steps.length })}
          </p>
        </DialogHeader>

        {/* Progress bar */}
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= currentStep ? "bg-[var(--primary)]" : "bg-[var(--neutral-muted)]"
              }`}
            />
          ))}
        </div>

        {/* Step title */}
        <h3 className="text-sm font-medium text-[var(--foreground)]">{step.title}</h3>

        {/* Step content */}
        <div className="min-h-[200px]">{step.content}</div>

        <DialogFooter>
          <div className="flex w-full justify-between">
            <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button variant="outline" size="sm" onClick={handleBack}>
                  {t("back")}
                </Button>
              )}
              <Button size="sm" onClick={() => void handleNext()} disabled={validating}>
                {validating ? t("validating") : isLastStep ? t("complete") : t("next")}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
