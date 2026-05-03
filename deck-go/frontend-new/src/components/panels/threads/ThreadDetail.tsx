import type { DeckGoThreadEntry } from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { JsonDetails } from "../../shared/ShellComponents";
import { formatThreadTimestamp } from "./thread-utils";
import { ThreadRelationView } from "./ThreadRelationView";

type ThreadDetailProps = {
  handoffMessage: string;
  onCopySessionKey: () => void;
  onOpenAgent: () => void;
  onOpenSession: () => void;
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

export function ThreadDetail({
  handoffMessage,
  onCopySessionKey,
  onOpenAgent,
  onOpenSession,
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

      <ThreadRelationView thread={thread} />

      <div className="threads-panel__facts">
        <ThreadFact label={t("boundAtLower")} value={formatThreadTimestamp(thread.boundAt)} />
        <ThreadFact
          label={t("lastActivityLower")}
          value={formatThreadTimestamp(thread.lastActivityAt)}
        />
        <ThreadFact label={t("accountLower")} value={thread.accountId || t("na")} />
        <ThreadFact label={t("boundByLower")} value={thread.boundBy || t("na")} />
      </div>

      <div className="threads-panel__payload">
        <JsonDetails title={t("threadPayload")} payload={thread} />
      </div>
    </>
  );
}
