"use client";

import { useTranslations } from "next-intl";
import { lazy, Suspense, useEffect, useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { ThemeSync } from "@/components/layout/ThemeSync";
import { ToastContainer } from "@/components/notifications/ToastContainer";
import { useNotificationSSE } from "@/components/notifications/useNotificationSSE";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
// ChatPanel is the default panel — keep eager to avoid flash-of-loading on startup.
import { ChatPanel } from "@/components/panels/chat/ChatPanel";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useUIStore, type Panel } from "@/stores/ui";

// ---------------------------------------------------------------------------
// Lazy-loaded panels — code-split so only the active panel is fetched.
// ---------------------------------------------------------------------------
const LazyAgentsPanel = lazy(() =>
  import("@/components/panels/agents/AgentsPanel").then((m) => ({ default: m.AgentsPanel })),
);
const LazyGatewayPanel = lazy(() =>
  import("@/components/panels/gateway/GatewayPanel").then((m) => ({ default: m.GatewayPanel })),
);
const LazyModelsPanel = lazy(() =>
  import("@/components/panels/models/ModelsPanel").then((m) => ({ default: m.ModelsPanel })),
);
const LazyUsagePanel = lazy(() =>
  import("@/components/panels/usage/UsagePanel").then((m) => ({ default: m.UsagePanel })),
);
const LazySessionsPanel = lazy(() =>
  import("@/components/panels/sessions/SessionsPanel").then((m) => ({ default: m.SessionsPanel })),
);
const LazyLogsPanel = lazy(() =>
  import("@/components/panels/logs/LogsPanel").then((m) => ({ default: m.LogsPanel })),
);
const LazyMemoryPanel = lazy(() =>
  import("@/components/panels/memory/MemoryPanel").then((m) => ({ default: m.MemoryPanel })),
);
const LazyActivityPanel = lazy(() =>
  import("@/components/panels/activity/ActivityPanel").then((m) => ({ default: m.ActivityPanel })),
);
const LazyChannelsPanel = lazy(() =>
  import("@/components/panels/channels/ChannelsPanel").then((m) => ({ default: m.ChannelsPanel })),
);
const LazyConfigPanel = lazy(() =>
  import("@/components/panels/config-editor/ConfigPanel").then((m) => ({ default: m.ConfigPanel })),
);
const LazyCronPanel = lazy(() =>
  import("@/components/panels/cron/CronPanel").then((m) => ({ default: m.CronPanel })),
);
const LazyWebhooksPanel = lazy(() =>
  import("@/components/panels/webhooks/WebhooksPanel").then((m) => ({ default: m.WebhooksPanel })),
);
const LazyApprovalsPanel = lazy(() =>
  import("@/components/panels/approvals/ApprovalsPanel").then((m) => ({
    default: m.ApprovalsPanel,
  })),
);
const LazySkillsPanel = lazy(() =>
  import("@/components/panels/skills/SkillsPanel").then((m) => ({ default: m.SkillsPanel })),
);
const LazyBudgetPanel = lazy(() =>
  import("@/components/panels/budget/BudgetPanel").then((m) => ({ default: m.BudgetPanel })),
);
const LazyAlertsPanel = lazy(() =>
  import("@/components/panels/alerts/AlertsPanel").then((m) => ({ default: m.AlertsPanel })),
);
const LazyDocHubPanel = lazy(() =>
  import("@/components/panels/docs/DocHubPanel").then((m) => ({ default: m.DocHubPanel })),
);
const LazySettingsPanel = lazy(() =>
  import("@/components/panels/settings/SettingsPanel").then((m) => ({ default: m.SettingsPanel })),
);

// ---------------------------------------------------------------------------
// Suspense fallback — minimal spinner themed via CSS variables.
// ---------------------------------------------------------------------------
function PanelLoadingFallback() {
  return (
    <div
      className="flex items-center justify-center h-full"
      style={{ color: "var(--text-secondary)" }}
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
      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
    >
      <p className="text-lg">{t(panel)}</p>
    </div>
  );
}

function ActivePanel({ panel }: { panel: Panel }) {
  // ChatPanel is eager-loaded (default panel) — no Suspense needed.
  if (panel === "chat") {
    return <ChatPanel />;
  }

  // All other panels are lazy-loaded and wrapped in Suspense.
  let LazyComponent: React.ComponentType | null = null;

  if (panel === "agents") {
    LazyComponent = LazyAgentsPanel;
  } else if (panel === "gateway") {
    LazyComponent = LazyGatewayPanel;
  } else if (panel === "models") {
    LazyComponent = LazyModelsPanel;
  } else if (panel === "usage") {
    LazyComponent = LazyUsagePanel;
  } else if (panel === "sessions") {
    LazyComponent = LazySessionsPanel;
  } else if (panel === "logs") {
    LazyComponent = LazyLogsPanel;
  } else if (panel === "memory") {
    LazyComponent = LazyMemoryPanel;
  } else if (panel === "activity") {
    LazyComponent = LazyActivityPanel;
  } else if (panel === "channels") {
    LazyComponent = LazyChannelsPanel;
  } else if (panel === "config") {
    LazyComponent = LazyConfigPanel;
  } else if (panel === "cron") {
    LazyComponent = LazyCronPanel;
  } else if (panel === "webhooks") {
    LazyComponent = LazyWebhooksPanel;
  } else if (panel === "approvals") {
    LazyComponent = LazyApprovalsPanel;
  } else if (panel === "skills") {
    LazyComponent = LazySkillsPanel;
  } else if (panel === "budget") {
    LazyComponent = LazyBudgetPanel;
  } else if (panel === "alerts") {
    LazyComponent = LazyAlertsPanel;
  } else if (panel === "docs") {
    LazyComponent = LazyDocHubPanel;
  } else if (panel === "settings") {
    LazyComponent = LazySettingsPanel;
  }

  if (!LazyComponent) {
    return <PanelPlaceholder panel={panel} />;
  }

  return (
    <Suspense fallback={<PanelLoadingFallback />}>
      <LazyComponent />
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
