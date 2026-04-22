"use client";

import { useTranslations } from "next-intl";
import type { EventInfo } from "@/stores/api-explorer";
import { SchemaViewer } from "./SchemaViewer";

interface EventListProps {
  events: EventInfo[];
}

export function EventList({ events }: EventListProps) {
  const t = useTranslations("apiExplorer");

  if (events.length === 0) {
    return (
      <p className="p-4 text-xs text-[var(--muted-foreground)] text-center">{t("noEvents")}</p>
    );
  }

  return (
    <div className="space-y-2 p-3">
      {events.map((evt) => (
        <div
          key={evt.name}
          className="rounded-md border p-3"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono font-medium" style={{ color: "var(--foreground)" }}>
              {evt.name}
            </span>
            {evt.since != null && (
              <span className="text-[10px] text-[var(--text-tertiary)]">
                {t("since")} v{evt.since}
              </span>
            )}
          </div>
          {evt.payload ? (
            <div className="rounded p-2" style={{ backgroundColor: "var(--muted)" }}>
              <SchemaViewer schema={evt.payload} />
            </div>
          ) : (
            <p className="text-[10px] text-[var(--text-tertiary)] italic">{t("noPayload")}</p>
          )}
        </div>
      ))}
    </div>
  );
}
