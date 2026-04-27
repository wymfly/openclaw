import type {
  DeckGoLogStreamEvent,
  DeckGoServerEvent,
  DeckGoSessionDetailResponse,
  DeckGoSessionMeta,
  DeckGoSessionPreviewEntry,
  DeckGoTranscriptMessage,
} from "../../../../contracts/generated/ts/deck-api.generated";
import { useTranslations } from "../../i18n/provider";
import { summarizeLogEvent, summarizeServerEvent } from "../../stream-contract";

type SharedTranslator = (key: string, values?: Record<string, number | string>) => string;

export function JsonDetails(props: { title: string; payload: unknown }) {
  return (
    <details>
      <summary>{props.title}</summary>
      <pre className="deckgo-code">{JSON.stringify(props.payload, null, 2)}</pre>
    </details>
  );
}

export function ShellStat(props: { label: string; value: string | number }) {
  return (
    <article className="deckgo-stat">
      <p className="deckgo-stat-label">{props.label}</p>
      <p className="deckgo-stat-value">{props.value}</p>
    </article>
  );
}

function stringifyBlockValue(value: unknown, t: SharedTranslator) {
  if (typeof value === "string") {
    return value;
  }
  if (value == null) {
    return "";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return t("unserializablePayload");
  }
}

function summarizeTranscriptBlock(
  block: DeckGoTranscriptMessage["content"][number],
  t: SharedTranslator,
) {
  switch (block.type) {
    case "text":
      return {
        label: t("text"),
        title: t("transcriptText"),
        preview: block.text?.trim() || t("emptyTextBlock"),
      };
    case "tool_use":
      return {
        label: t("toolUse"),
        title: block.name?.trim() || block.id?.trim() || t("unnamedTool"),
        preview:
          (typeof block.input?.command === "string" && block.input.command.trim()) ||
          stringifyBlockValue(block.input, t) ||
          t("noStructuredInput"),
      };
    case "tool_result":
      return {
        label: block.isError ? t("toolResultError") : t("toolResult"),
        title: block.toolUseId?.trim() || t("toolOutput"),
        preview: stringifyBlockValue(block.content, t) || t("emptyResultBlock"),
      };
    default:
      return {
        label: block.type?.trim() || t("block"),
        title: block.name?.trim() || block.title?.trim() || t("transcriptPayload"),
        preview:
          block.text?.trim() ||
          stringifyBlockValue(
            {
              input: block.input,
              content: block.content,
              summary: block.summary,
              data: block.data,
              url: block.url,
            },
            t,
          ) ||
          t("emptyBlock"),
      };
  }
}

function TranscriptBlockCard(props: {
  block: DeckGoTranscriptMessage["content"][number];
  messageId: string;
  index: number;
}) {
  const t = useTranslations("shellComponents");
  const summary = summarizeTranscriptBlock(props.block, t);
  const rawPayload = {
    ...props.block,
    ...(props.block.text?.trim() ? {} : { text: undefined }),
  };

  return (
    <article
      className={`deckgo-transcript-block deckgo-transcript-block-${props.block.type || "other"}`}
    >
      <p className="deckgo-transcript-block-label">{summary.label}</p>
      <strong>{summary.title}</strong>
      <pre className="deckgo-code deckgo-transcript-block-preview">{summary.preview}</pre>
      <details>
        <summary>
          {t("rawPayload")} · {props.messageId || t("message")} ·{" "}
          {t("blockIndex", { index: props.index + 1 })}
        </summary>
        <pre className="deckgo-code">{JSON.stringify(rawPayload, null, 2)}</pre>
      </details>
    </article>
  );
}

export function TranscriptList(props: { messages: DeckGoTranscriptMessage[] }) {
  const t = useTranslations("shellComponents");
  if (props.messages.length === 0) {
    return <p className="deckgo-note">{t("noTranscriptMessages")}</p>;
  }

  return (
    <ol className="deckgo-shell-list deckgo-transcript-list">
      {props.messages.map((message) => (
        <li key={message.id}>
          <article className="deckgo-transcript-message">
            <div className="deckgo-transcript-message-header">
              <strong>
                {message.role} · {message.id || t("pending")}
              </strong>
              {message.streaming ? (
                <span className="deckgo-pill is-primary">{t("streaming")}</span>
              ) : null}
              {message.error ? <span className="deckgo-pill is-danger">{t("error")}</span> : null}
            </div>
            <div className="deckgo-transcript-blocks">
              {(message.content ?? []).map((block, index) => (
                <TranscriptBlockCard
                  key={`${message.id || "pending"}-${block.type || "block"}-${index}`}
                  block={block}
                  messageId={message.id}
                  index={index}
                />
              ))}
            </div>
          </article>
        </li>
      ))}
    </ol>
  );
}

export function SessionListCard(props: {
  sessions: DeckGoSessionMeta[];
  selectedKey?: string;
  onSelect?: (session: DeckGoSessionMeta) => void;
}) {
  const t = useTranslations("shellComponents");
  if (props.sessions.length === 0) {
    return <p className="deckgo-note">{t("noSessionsLoaded")}</p>;
  }

  return (
    <ul className="deckgo-shell-list">
      {props.sessions.map((session) => (
        <li key={session.key}>
          <button
            type="button"
            className={`deckgo-selectable-card ${props.selectedKey === session.key ? "is-selected" : ""}`}
            onClick={() => props.onSelect?.(session)}
          >
            <strong>{session.title || session.key}</strong>
            <div className="deckgo-meta">
              {t("key")}: {session.key} | {t("agent")}: {session.agentId || t("notAvailable")} |{" "}
              {t("status")}: {session.status || t("unknown")}
            </div>
            {session.lastMessagePreview ? (
              <div className="deckgo-meta">{session.lastMessagePreview}</div>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function SessionPreviewCard(props: {
  previews: DeckGoSessionPreviewEntry[];
  selectedKey?: string;
  onSelect?: (preview: DeckGoSessionPreviewEntry) => void;
}) {
  const t = useTranslations("shellComponents");
  if (props.previews.length === 0) {
    return <p className="deckgo-note">{t("noPreviewsLoaded")}</p>;
  }

  return (
    <ul className="deckgo-shell-list">
      {props.previews.map((preview) => (
        <li key={preview.key}>
          <button
            type="button"
            className={`deckgo-selectable-card ${props.selectedKey === preview.key ? "is-selected" : ""}`}
            onClick={() => props.onSelect?.(preview)}
          >
            <strong>{preview.key}</strong>
            <div className="deckgo-meta">
              {preview.items?.map((item) => item.text).join(" · ") || t("empty")}
            </div>
            <div className="deckgo-meta">
              {t("status")}: {preview.status || t("unknown")} | {t("items")}:{" "}
              {preview.items?.length ?? 0}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function EventFeedCard(props: {
  title: string;
  events: DeckGoServerEvent[] | DeckGoLogStreamEvent[];
  kind: "server" | "log";
}) {
  const t = useTranslations("shellComponents");
  if (props.events.length === 0) {
    return <p className="deckgo-note">{t("noEvents", { kind: props.kind })}</p>;
  }

  return (
    <ul className="deckgo-shell-list">
      {props.events.map((event, index) => (
        <li key={`${event.id || props.kind}-${index}`}>
          <strong>{event.event || t("unknown")}</strong>
          <div className="deckgo-meta">
            {props.kind === "server"
              ? summarizeServerEvent(event as DeckGoServerEvent)
              : summarizeLogEvent(event)}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SessionDetailCard(props: {
  detail: DeckGoSessionDetailResponse | null;
  snapshot: DeckGoSessionDetailResponse | null;
  history: { messages?: DeckGoTranscriptMessage[] } | null;
}) {
  const t = useTranslations("shellComponents");
  const detailSession = props.detail?.session;
  const detailMessages = props.detail?.messages ?? [];
  const snapshotMessages = props.snapshot?.messages ?? [];
  const snapshotSession = props.snapshot?.session;

  return (
    <div className="deckgo-dividerless">
      {detailSession ? (
        <div>
          <p className="deckgo-kicker deckgo-session-detail-kicker">{t("sessionDetail")}</p>
          <div className="deckgo-meta">
            {detailSession.title || detailSession.key} | {t("agent")}:{" "}
            {detailSession.agentId || t("notAvailable")} | {t("status")}:{" "}
            {detailSession.status || t("unknown")}
          </div>
        </div>
      ) : null}

      <TranscriptList messages={detailMessages} />

      {props.snapshot ? (
        <details>
          <summary>{t("snapshotAlias")}</summary>
          {snapshotSession ? (
            <div className="deckgo-meta deckgo-session-snapshot-meta">
              {snapshotSession.title || snapshotSession.key} | {t("agent")}:{" "}
              {snapshotSession.agentId || t("notAvailable")} | {t("status")}:{" "}
              {snapshotSession.status || t("unknown")}
            </div>
          ) : null}
          <TranscriptList messages={snapshotMessages} />
        </details>
      ) : null}

      {props.history ? (
        <details>
          <summary>{t("historySeam")}</summary>
          <TranscriptList messages={props.history.messages ?? []} />
        </details>
      ) : null}
    </div>
  );
}
