import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useActiveSessionKey, useSessionToolProgress } from "@/stores/chat-hooks";
import type { ToolProgress } from "@/stores/chat-types";
import "./chat-widgets.css";

const COMPLETED_VISIBLE_MS = 3_000;

function ElapsedTime({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(() =>
    Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [startedAt]);

  return elapsed > 0 ? <span>{elapsed}s</span> : null;
}

function toolStatusLabel(t: ReturnType<typeof useTranslations>, status: ToolProgress["status"]) {
  const key = `toolStatus_${status}`;
  return typeof t.has === "function" && t.has(key) ? t(key) : status;
}

export function ToolProgressBar() {
  const t = useTranslations("chat");
  const activeSessionKey = useActiveSessionKey();
  const toolProgress = useSessionToolProgress();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const previousSessionKeyRef = useRef(activeSessionKey);

  useEffect(() => {
    if (previousSessionKeyRef.current === activeSessionKey) {
      return;
    }
    previousSessionKeyRef.current = activeSessionKey;
    setHiddenIds(new Set());
  }, [activeSessionKey]);

  useEffect(() => {
    const completedEntries = Object.values(toolProgress).filter(
      (entry) => entry.status !== "running" && !hiddenIds.has(entry.toolUseId),
    );
    if (completedEntries.length === 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setHiddenIds((current) => {
        const next = new Set(current);
        for (const entry of completedEntries) {
          next.add(entry.toolUseId);
        }
        return next;
      });
    }, COMPLETED_VISIBLE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [hiddenIds, toolProgress]);

  const entries = Object.values(toolProgress).filter((entry) => !hiddenIds.has(entry.toolUseId));

  if (entries.length === 0) {
    return null;
  }

  const running = entries.filter((entry) => entry.status === "running").length;

  return (
    <div className="ds-tool-ladder deck-ui-tool-ladder" aria-label={t("tools")}>
      {entries.map((entry) => {
        const stepClasses = [
          "ds-tool-ladder__step",
          `ds-tool-ladder__step--${entry.status}`,
          "deck-ui-tool-step",
          `is-${entry.status}`,
        ];
        return (
          <section className={stepClasses.join(" ")} key={entry.toolUseId}>
            <p className="ds-tool-ladder__step-label deck-ui-surface-label">
              {toolStatusLabel(t, entry.status)}
            </p>
            <strong>{entry.name}</strong>
            <span>{entry.toolUseId}</span>
            {entry.status === "running" ? <ElapsedTime startedAt={entry.startedAt} /> : null}
          </section>
        );
      })}
      <section className="ds-tool-ladder__step deck-ui-tool-step is-summary">
        <p className="ds-tool-ladder__step-label deck-ui-surface-label">{t("tools")}</p>
        <strong>{running > 0 ? t("toolsRunning", { count: running }) : t("toolsCompleted")}</strong>
      </section>
    </div>
  );
}
