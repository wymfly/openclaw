import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { DeckGoLogStreamEvent } from "../../../../contracts/generated/ts/deck-api.generated";
import { fetchLogsTail, streamLogEvents, type DeckGoLogsTailResponse } from "../../api";
import { EventFeedCard, JsonDetails } from "../../shell-components";
import { parseLogEvent, summarizeLogEvent } from "../../stream-contract";

type LogsState = "idle" | "loading" | "ready";
type StreamState = "idle" | "connecting" | "connected" | "reconnecting" | "error";

const LOG_CURSOR_KEY = "deckGoLogsCursor";
const LOG_LAST_EVENT_ID_KEY = "deckGoLogsLastEventId";

function formatLogLine(line: unknown) {
  if (typeof line === "string") {
    return line;
  }
  return JSON.stringify(line, null, 2);
}

export function RestoredLogsPanel() {
  const [tail, setTail] = useState<DeckGoLogsTailResponse | null>(null);
  const [tailState, setTailState] = useState<LogsState>("idle");
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [logEvents, setLogEvents] = useState<DeckGoLogStreamEvent[]>([]);
  const [liveTape, setLiveTape] = useState<string[]>([]);
  const [error, setError] = useState("");
  const lastEventIdRef = useRef(
    typeof window === "undefined"
      ? ""
      : window.localStorage.getItem(LOG_LAST_EVENT_ID_KEY)?.trim() || "",
  );

  const refreshLogsTail = useEffectEvent(async (cursor?: number) => {
    setTailState("loading");
    try {
      const result = await fetchLogsTail({ cursor, limit: 200, maxBytes: 65536 });
      setTail(result);
      if (typeof result.cursor === "number") {
        window.localStorage.setItem(LOG_CURSOR_KEY, String(result.cursor));
      }
      setTailState("ready");
      setError("");
    } catch (tailError) {
      setTailState("idle");
      setError(tailError instanceof Error ? tailError.message : "failed to fetch logs tail");
    }
  });

  useEffect(() => {
    const initialCursorRaw =
      typeof window === "undefined"
        ? ""
        : window.localStorage.getItem(LOG_CURSOR_KEY)?.trim() || "";
    const initialCursor = initialCursorRaw ? Number.parseInt(initialCursorRaw, 10) : undefined;
    void refreshLogsTail(Number.isFinite(initialCursor) ? initialCursor : undefined);
  }, [refreshLogsTail]);

  useEffect(() => {
    const controller = new AbortController();
    void streamLogEvents({
      signal: controller.signal,
      initialLastEventId: lastEventIdRef.current,
      onStatusChange(status) {
        setStreamState(status);
      },
      onEvent(event) {
        if (event.id) {
          lastEventIdRef.current = event.id;
          window.localStorage.setItem(LOG_LAST_EVENT_ID_KEY, event.id);
        }
        setLogEvents((current) => [event, ...current].slice(0, 20));

        const parsed = parseLogEvent(event);
        if (parsed.kind === "log.reset") {
          setLiveTape((current) => ["log reset", ...current].slice(0, 10));
          setTail((current) => (current ? { ...current, lines: [], reset: true } : current));
          return;
        }
        if (parsed.kind === "log.batch") {
          if (typeof parsed.payload.cursor === "number") {
            window.localStorage.setItem(LOG_CURSOR_KEY, String(parsed.payload.cursor));
          }
          setLiveTape((current) => [summarizeLogEvent(event), ...current].slice(0, 10));
          setTail((current) => ({
            cursor: parsed.payload.cursor ?? current?.cursor,
            lines: parsed.payload.lines ?? current?.lines ?? [],
            reset: false,
          }));
        }
      },
    }).catch((streamError) => {
      if (!controller.signal.aborted) {
        setError(
          streamError instanceof Error ? streamError.message : "failed to connect logs stream",
        );
      }
    });

    return () => controller.abort();
  }, []);

  return (
    <section className="deckgo-restored-workspace">
      <div className="deckgo-column">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Logs tail</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Restored logs now read from `/logs` and `/logs/stream` instead of staying trapped in the
            fallback diagnostics column.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-pill-row">
              <span className={`deckgo-pill ${tailState === "ready" ? "is-positive" : "is-muted"}`}>
                Tail {tailState}
              </span>
              <span
                className={`deckgo-pill ${streamState === "connected" ? "is-positive" : "is-muted"}`}
              >
                Stream {streamState}
              </span>
              <span className="deckgo-pill">cursor {tail?.cursor ?? 0}</span>
            </div>
            <div className="deckgo-actions">
              <button
                className="deckgo-button"
                type="button"
                onClick={() => void refreshLogsTail(tail?.cursor)}
              >
                Refresh tail
              </button>
            </div>
            <div className="deckgo-surface-tile">
              <p className="deckgo-surface-label">Latest lines</p>
              {(tail?.lines?.length ?? 0) === 0 ? (
                <p className="deckgo-note">No log lines yet.</p>
              ) : (
                <ul className="deckgo-shell-list">
                  {(tail?.lines ?? []).slice(0, 12).map((line, index) => (
                    <li key={`log-line-${index}`}>
                      <pre className="deckgo-code">{formatLogLine(line)}</pre>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {error ? (
              <p className="deckgo-note" style={{ color: "var(--danger)" }}>
                {error}
              </p>
            ) : null}
          </div>
        </article>
      </div>

      <aside className="deckgo-column">
        <article className="deckgo-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Live event tape</h2>
          </div>
          <div className="deckgo-card-body">
            {liveTape.length === 0 ? (
              <p className="deckgo-note">No live log events captured yet.</p>
            ) : (
              <ul className="deckgo-shell-list">
                {liveTape.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        </article>

        <article className="deckgo-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Log stream events</h2>
          </div>
          <div className="deckgo-card-body">
            {logEvents.length === 0 ? (
              <p className="deckgo-note">No log events yet.</p>
            ) : (
              <EventFeedCard title="Log events" events={logEvents} kind="log" />
            )}
          </div>
        </article>

        {tail ? (
          <article className="deckgo-card">
            <div className="deckgo-card-header">
              <h2 className="deckgo-card-title">Raw tail seam</h2>
            </div>
            <div className="deckgo-card-body">
              <JsonDetails title="Logs tail payload" payload={tail} />
            </div>
          </article>
        ) : null}
      </aside>
    </section>
  );
}
