import type {
  DeckGoSessionDetailResponse,
  DeckGoSessionMessageStreamEvent,
  DeckGoSessionMeta,
  DeckGoSessionsChangedStreamEvent,
  DeckGoSessionsListResponse,
  DeckGoSessionsPreviewResponse,
  DeckGoTranscriptMessage,
} from "../../../../contracts/generated/ts/deck-api.generated";

export function upsertTranscriptMessage(
  messages: DeckGoTranscriptMessage[] | undefined,
  nextMessage: DeckGoTranscriptMessage,
) {
  const current = messages ?? [];
  const index = current.findIndex((message) => message.id === nextMessage.id);
  if (index >= 0) {
    const copy = current.slice();
    copy[index] = nextMessage;
    return copy;
  }
  return [...current, nextMessage]
    .slice()
    .toSorted(
      (left: DeckGoTranscriptMessage, right: DeckGoTranscriptMessage) =>
        (left.timestamp ?? 0) - (right.timestamp ?? 0),
    );
}

export function firstTextContent(message: DeckGoTranscriptMessage | undefined) {
  if (!message?.content) {
    return "";
  }
  for (const block of message.content) {
    if (block.text?.trim()) {
      return block.text.trim();
    }
  }
  return "";
}

export function patchSessionMeta(
  session: DeckGoSessionMeta,
  event: DeckGoSessionsChangedStreamEvent,
) {
  if (session.key !== event.sessionKey) {
    return session;
  }
  return {
    ...session,
    title: event.displayName || event.label || session.title,
    status: event.status || session.status,
    updatedAt: event.updatedAt ?? session.updatedAt,
    startedAt: event.startedAt ?? session.startedAt,
    endedAt: event.endedAt ?? session.endedAt,
    runtimeMs: event.runtimeMs ?? session.runtimeMs,
  };
}

export function patchPreviewText(
  previews: DeckGoSessionsPreviewResponse | null,
  sessionKey: string,
  text: string,
) {
  if (!previews) {
    return previews;
  }
  return {
    ...previews,
    previews: (previews.previews ?? []).map((preview) =>
      preview.key === sessionKey
        ? {
            ...preview,
            items: preview.items?.length
              ? [{ ...preview.items[0], text }, ...preview.items.slice(1)]
              : [{ role: "assistant" as const, text }],
          }
        : preview,
    ),
  };
}

export function applyLiveMessageToSessionDetail(
  current: DeckGoSessionDetailResponse | null,
  payload: DeckGoSessionMessageStreamEvent,
) {
  if (!current || !payload.message) {
    return current;
  }
  return {
    ...current,
    messages: upsertTranscriptMessage(current.messages, payload.message),
  };
}

export function patchSessionsList(
  current: DeckGoSessionsListResponse | null,
  payload: DeckGoSessionsChangedStreamEvent,
) {
  if (!current) {
    return current;
  }
  return {
    ...current,
    sessions: (current.sessions ?? []).map((session) => patchSessionMeta(session, payload)),
  };
}
