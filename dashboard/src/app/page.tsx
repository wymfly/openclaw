"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { ThemeSync } from "@/components/layout/ThemeSync";
import { ToastContainer } from "@/components/notifications/ToastContainer";
import { useNotificationSSE } from "@/components/notifications/useNotificationSSE";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { AgentsPanel } from "@/components/panels/agents/AgentsPanel";
import { ChatPanel } from "@/components/panels/chat/ChatPanel";
import { GatewayPanel } from "@/components/panels/gateway/GatewayPanel";
import { ModelsPanel } from "@/components/panels/models/ModelsPanel";
import { useUIStore, type Panel } from "@/stores/ui";

function PanelPlaceholder({ panel }: { panel: Panel }) {
  const t = useTranslations("nav");
  return (
    <div
      className="flex items-center justify-center h-full rounded-lg border border-dashed"
      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
    >
      <p className="text-lg">{t(panel)}</p>
    </div>
  );
}

function ActivePanel({ panel }: { panel: Panel }) {
  if (panel === "chat") {
    return <ChatPanel />;
  }
  if (panel === "agents") {
    return <AgentsPanel />;
  }
  if (panel === "gateway") {
    return <GatewayPanel />;
  }
  if (panel === "models") {
    return <ModelsPanel />;
  }
  return <PanelPlaceholder panel={panel} />;
}

export default function Home() {
  const { activePanel } = useUIStore();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  // Bridge SSE notification events into the toast store.
  useNotificationSSE();

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
          style={{ backgroundColor: "var(--bg-primary)" }}
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
