import type { DeckGoThreadEntry } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { JsonDetails } from "../../shared/ShellComponents";
import { formatThreadTimestamp } from "./thread-utils";
import { ThreadRelationView } from "./ThreadRelationView";

export type ThreadDetailTab = "overview" | "activity" | "audit" | "raw";

type ThreadDetailProps = {
  activeTab: ThreadDetailTab;
  handoffMessage: string;
  onCopySessionKey: () => void;
  onOpenAgent: () => void;
  onOpenSession: () => void;
  onTabChange: (tab: ThreadDetailTab) => void;
  thread: DeckGoThreadEntry | null;
};

function ThreadFact(props: { label: string; value: string | number }) {
  return (
    <article className="threads-panel__fact">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </article>
  );
}

function UnsupportedProjection(props: { description: string; title: string }) {
  return (
    <article className="threads-panel__unsupported">
      <strong>{props.title}</strong>
      <p>{props.description}</p>
    </article>
  );
}

export function ThreadDetail({
  activeTab,
  handoffMessage,
  onCopySessionKey,
  onOpenAgent,
  onOpenSession,
  onTabChange,
  thread,
}: ThreadDetailProps) {
  const t = useTranslations("threads");

  if (!thread) {
    return (
      <div className="threads-panel__empty">
        <strong>{t("selectThreadTitle")}</strong>
        <p>{t("selectThreadDescription")}</p>
      </div>
    );
  }

  const tabs: { id: ThreadDetailTab; label: string }[] = [
    { id: "overview", label: t("overview") },
    { id: "activity", label: t("recentActivity") },
    { id: "audit", label: t("audit") },
    { id: "raw", label: t("rawEntry") },
  ];

  return (
    <>
      <div className="threads-panel__hero">
        <div className="threads-panel__hero-main">
          <p className="threads-panel__eyebrow">{t("targetSession")}</p>
          <strong>{thread.targetSessionKey}</strong>
          <p className="threads-panel__note">
            {t("bindingExplanation", { boundBy: thread.boundBy, kind: thread.targetKind })}
          </p>
        </div>
        <div className="threads-panel__actions">
          <button
            className="threads-panel__button is-primary"
            type="button"
            onClick={onCopySessionKey}
          >
            {t("copySessionKey")}
          </button>
          <button className="threads-panel__button" type="button" onClick={onOpenSession}>
            {t("openSession")}
          </button>
          <button className="threads-panel__button" type="button" onClick={onOpenAgent}>
            {t("openAgent")}
          </button>
        </div>
      </div>

      {handoffMessage ? <p className="threads-panel__handoff">{handoffMessage}</p> : null}

      <nav className="threads-panel__tabs" role="tablist" aria-label={t("threadSections")}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`threads-panel__tab ${activeTab === tab.id ? "is-active" : ""}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "overview" ? (
        <>
          <ThreadRelationView thread={thread} />

          <div className="threads-panel__facts">
            <ThreadFact label={t("thread")} value={thread.threadId} />
            <ThreadFact label={t("boundAtLower")} value={formatThreadTimestamp(thread.boundAt)} />
            <ThreadFact
              label={t("lastActivityLower")}
              value={formatThreadTimestamp(thread.lastActivityAt)}
            />
            <ThreadFact label={t("accountLower")} value={thread.accountId || t("na")} />
            <ThreadFact label={t("boundByLower")} value={thread.boundBy || t("na")} />
            <ThreadFact label={t("targetKind")} value={thread.targetKind || t("na")} />
          </div>
          <p className="threads-panel__contract-note">{t("bindingRegistryNote")}</p>
        </>
      ) : null}

      {activeTab === "activity" ? (
        <UnsupportedProjection
          title={t("recentActivityUnsupportedTitle")}
          description={t("recentActivityUnsupportedDescription")}
        />
      ) : null}

      {activeTab === "audit" ? (
        <UnsupportedProjection
          title={t("auditUnsupportedTitle")}
          description={t("auditUnsupportedDescription")}
        />
      ) : null}

      {activeTab === "raw" ? (
        <div className="threads-panel__payload">
          <JsonDetails title={t("threadPayload")} payload={thread} />
        </div>
      ) : null}
    </>
  );
}
