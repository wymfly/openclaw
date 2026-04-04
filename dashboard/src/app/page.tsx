"use client";

import { useTranslations } from "next-intl";
import { Suspense, useEffect, useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { ThemeSync } from "@/components/layout/ThemeSync";
import { ToastContainer } from "@/components/notifications/ToastContainer";
import { useNotificationSSE } from "@/components/notifications/useNotificationSSE";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { findPanel } from "@/lib/panel-registry";
import { useUIStore, type Panel } from "@/stores/ui";

// ---------------------------------------------------------------------------
// Suspense fallback — minimal spinner themed via CSS variables.
// ---------------------------------------------------------------------------
function PanelLoadingFallback() {
  return (
    <div
      className="flex items-center justify-center h-full"
      style={{ color: "var(--muted-foreground)" }}
    >
      <div
        className="animate-spin rounded-full h-8 w-8 border-2 border-current"
        style={{ borderTopColor: "transparent" }}
      />
    </div>
  );
}

function PanelPlaceholder({ panel }: { panel: Panel }) {
  const t = useTranslations("nav");
  return (
    <div
      className="flex items-center justify-center h-full rounded-lg border border-dashed"
      style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
    >
      <p className="text-lg">{t(panel)}</p>
    </div>
  );
}

function ActivePanel({ panel }: { panel: Panel }) {
  const entry = findPanel(panel);
  if (!entry) {
    return <PanelPlaceholder panel={panel} />;
  }
  const PanelComponent = entry.component;
  if (entry.eager) {
    return <PanelComponent />;
  }

  return (
    <Suspense fallback={<PanelLoadingFallback />}>
      <PanelComponent />
    </Suspense>
  );
}

export default function Home() {
  const { activePanel } = useUIStore();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  // Bridge SSE notification events into the toast store.
  useNotificationSSE();

  // Register global keyboard shortcuts (Alt+N panels, Ctrl/Cmd+K search, etc.)
  // Must be outside Suspense so shortcuts work even while a panel chunk is loading.
  useKeyboardShortcuts();

  useEffect(() => {
    void fetch("/api/onboarding/status")
      .then((r) => r.json())
      .then((data: { needsOnboarding?: boolean }) => {
        setNeedsOnboarding(data.needsOnboarding ?? false);
      })
      .catch(() => setNeedsOnboarding(false));
  }, []);

  // Show nothing until onboarding status is resolved.
  if (needsOnboarding === null) {
    return (
      <>
        <ThemeSync />
        <div
          className="flex items-center justify-center h-screen"
          style={{ backgroundColor: "var(--background)" }}
        />
      </>
    );
  }

  if (needsOnboarding) {
    return (
      <>
        <ThemeSync />
        <OnboardingWizard onComplete={() => setNeedsOnboarding(false)} />
      </>
    );
  }

  return (
    <>
      <ThemeSync />
      <Shell>
        <ActivePanel panel={activePanel} />
      </Shell>
      <ToastContainer />
    </>
  );
}
