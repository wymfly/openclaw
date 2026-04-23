import type {
  DeckGoLogStreamEvent,
  DeckGoServerEvent,
  DeckGoSessionDetailResponse,
  DeckGoSessionMeta,
  DeckGoSessionPreviewEntry,
  DeckGoTranscriptMessage,
} from "../../contracts/generated/ts/deck-api.generated";
import { summarizeLogEvent, summarizeServerEvent } from "./stream-contract";

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

function stringifyBlockValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (value == null) {
    return "";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "[unserializable payload]";
  }
}

function summarizeTranscriptBlock(block: DeckGoTranscriptMessage["content"][number]) {
  switch (block.type) {
    case "text":
      return {
        label: "Text",
        title: "Transcript text",
        preview: block.text?.trim() || "(empty text block)",
      };
    case "tool_use":
      return {
        label: "Tool use",
        title: block.name?.trim() || block.id?.trim() || "Unnamed tool",
        preview:
          (typeof block.input?.command === "string" && block.input.command.trim()) ||
          stringifyBlockValue(block.input) ||
          "No structured input",
      };
    case "tool_result":
      return {
        label: block.isError ? "Tool result error" : "Tool result",
        title: block.toolUseId?.trim() || "Tool output",
        preview: stringifyBlockValue(block.content) || "(empty result block)",
      };
    default:
      return {
        label: block.type?.trim() || "Block",
        title: block.name?.trim() || block.title?.trim() || "Transcript payload",
        preview:
          block.text?.trim() ||
          stringifyBlockValue({
            input: block.input,
            content: block.content,
            summary: block.summary,
            data: block.data,
            url: block.url,
          }) ||
          "(empty block)",
      };
  }
}

function TranscriptBlockCard(props: {
  block: DeckGoTranscriptMessage["content"][number];
  messageId: string;
  index: number;
}) {
  const summary = summarizeTranscriptBlock(props.block);
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
          Raw payload · {props.messageId || "message"} · block {props.index + 1}
        </summary>
        <pre className="deckgo-code">{JSON.stringify(rawPayload, null, 2)}</pre>
      </details>
    </article>
  );
}

export function TranscriptList(props: { messages: DeckGoTranscriptMessage[] }) {
  if (props.messages.length === 0) {
    return <p className="deckgo-note">No transcript messages.</p>;
  }

  return (
    <ol className="deckgo-shell-list deckgo-transcript-list">
      {props.messages.map((message) => (
        <li key={message.id}>
          <article className="deckgo-transcript-message">
            <div className="deckgo-transcript-message-header">
              <strong>
                {message.role} · {message.id || "pending"}
              </strong>
              {message.streaming ? <span className="deckgo-pill is-primary">streaming</span> : null}
              {message.error ? <span className="deckgo-pill is-danger">error</span> : null}
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
  if (props.sessions.length === 0) {
    return <p className="deckgo-note">No sessions loaded.</p>;
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
              key: {session.key} | agent: {session.agentId || "n/a"} | status:{" "}
              {session.status || "unknown"}
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
  if (props.previews.length === 0) {
    return <p className="deckgo-note">No previews loaded.</p>;
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
              {preview.items?.map((item) => item.text).join(" · ") || "(empty)"}
            </div>
            <div className="deckgo-meta">
              status: {preview.status || "unknown"} | items: {preview.items?.length ?? 0}
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
  if (props.events.length === 0) {
    return <p className="deckgo-note">No {props.kind} events.</p>;
  }

  return (
    <ul className="deckgo-shell-list">
      {props.events.map((event, index) => (
        <li key={`${event.id || props.kind}-${index}`}>
          <strong>{event.event || "unknown"}</strong>
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
  const detailSession = props.detail?.session;
  const detailMessages = props.detail?.messages ?? [];
  const snapshotMessages = props.snapshot?.messages ?? [];
  const snapshotSession = props.snapshot?.session;

  return (
    <div className="deckgo-dividerless">
      {detailSession ? (
        <div>
          <p className="deckgo-kicker" style={{ marginBottom: 8 }}>
            Session detail
          </p>
          <div className="deckgo-meta">
            {detailSession.title || detailSession.key} | agent: {detailSession.agentId || "n/a"} |
            status: {detailSession.status || "unknown"}
          </div>
        </div>
      ) : null}

      <TranscriptList messages={detailMessages} />

      {props.snapshot ? (
        <details>
          <summary>Snapshot alias</summary>
          {snapshotSession ? (
            <div className="deckgo-meta" style={{ marginTop: 12 }}>
              {snapshotSession.title || snapshotSession.key} | agent:{" "}
              {snapshotSession.agentId || "n/a"} | status: {snapshotSession.status || "unknown"}
            </div>
          ) : null}
          <TranscriptList messages={snapshotMessages} />
        </details>
      ) : null}

      {props.history ? (
        <details>
          <summary>History seam</summary>
          <TranscriptList messages={props.history.messages ?? []} />
        </details>
      ) : null}
    </div>
  );
}
