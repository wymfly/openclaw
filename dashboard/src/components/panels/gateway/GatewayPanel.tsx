"use client";

import { useTranslations } from "next-intl";
import { ConnectionCard } from "./ConnectionCard";
import { HealthCard } from "./HealthCard";
import { HeartbeatCard } from "./HeartbeatCard";

/**
 * Gateway Overview panel — entry point component.
 * Displays connection, health, and heartbeat cards in a grid layout.
 */
export function GatewayPanel() {
  const t = useTranslations("gateway");

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {t("title")}
        </h2>
      </div>

      <div className="flex-1 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ConnectionCard />
          <HealthCard />
          <HeartbeatCard />
        </div>
      </div>
    </div>
  );
}
