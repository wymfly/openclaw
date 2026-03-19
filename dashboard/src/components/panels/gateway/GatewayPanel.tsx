"use client";

import { Radio } from "lucide-react";
import { useTranslations } from "next-intl";
import { ConnectionCard } from "./ConnectionCard";
import { HealthCard } from "./HealthCard";
import { HeartbeatCard } from "./HeartbeatCard";

/**
 * Gateway Overview panel — status monitoring dashboard.
 * Displays connection, health, and heartbeat in a responsive card grid.
 * Design: rounded container with ring border, dashboard-style card layout.
 */
export function GatewayPanel() {
  const t = useTranslations("gateway");

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)]">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--accent-muted)]">
          <Radio size={14} className="text-[var(--accent)]" />
        </div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
          {t("title")}
        </h2>
      </div>

      {/* Card grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ConnectionCard />
          <HealthCard />
          <HeartbeatCard />
        </div>
      </div>
    </div>
  );
}
