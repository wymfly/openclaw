import { useEffect, useMemo, useState } from "react";
import type { DeckGoActivityEvent } from "../../api";
import { fetchActivityEvents } from "../../api";
import { JsonDetails, ShellStat } from "../../shell-components";

type PanelState = "idle" | "loading" | "ready";
type ActivityTimeRange = "1h" | "6h" | "24h" | "7d" | "all";

function withinRange(timestamp: number, range: ActivityTimeRange) {
  if (range === "all") {
    return true;
  }
  const now = Date.now();
  const age = now - timestamp;
  switch (range) {
    case "1h":
      return age <= 60 * 60 * 1_000;
    case "6h":
      return age <= 6 * 60 * 60 * 1_000;
    case "24h":
      return age <= 24 * 60 * 60 * 1_000;
    case "7d":
      return age <= 7 * 24 * 60 * 60 * 1_000;
    default:
      return true;
  }
}

export function RestoredActivityPanel() {
  const [events, setEvents] = useState<DeckGoActivityEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [timeRange, setTimeRange] = useState<ActivityTimeRange>("24h");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [error, setError] = useState("");

  const refresh = async (preferredEventId?: string) => {
    setLoadState("loading");
    try {
      const next = await fetchActivityEvents(100);
      const nextEvents = (next.events ?? [])
        .slice()
        .sort((left, right) => right.timestamp - left.timestamp);
      setEvents(nextEvents);
      setLoadState("ready");
      setError("");
      const fallbackId = preferredEventId?.trim() || nextEvents[0]?.id || "";
      setSelectedEventId((current) =>
        nextEvents.some((event) => event.id === current)
          ? current
          : nextEvents.some((event) => event.id === fallbackId)
            ? fallbackId
            : nextEvents[0]?.id || "",
      );
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : "failed to load activity");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (agentFilter.trim()) {
        const query = agentFilter.trim().toLowerCase();
        const matchesAgent = event.agentId?.toLowerCase().includes(query);
        const matchesName = event.agentName?.toLowerCase().includes(query);
        if (!matchesAgent && !matchesName) {
          return false;
        }
      }
      if (eventTypeFilter && event.type !== eventTypeFilter) {
        return false;
      }
      return withinRange(event.timestamp, timeRange);
    });
  }, [agentFilter, eventTypeFilter, events, timeRange]);

  const selectedEvent =
    filteredEvents.find((event) => event.id === selectedEventId) ??
    filteredEvents[0] ??
    events.find((event) => event.id === selectedEventId) ??
    null;

  const uniqueEventTypes = useMemo(
    () =>
      Array.from(new Set(events.map((event) => event.type))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [events],
  );
  const uniqueAgents = useMemo(
    () => new Set(events.map((event) => event.agentId || event.agentName).filter(Boolean)).size,
    [events],
  );

  return (
    <section className="deckgo-restored-workspace">
      <div className="deckgo-column">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Activity</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Vite-owned recent activity surface over the synthesized deck-go event feed.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-pill-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Activity {loadState}
              </span>
              <span className="deckgo-pill">{events.length} loaded</span>
              <span className="deckgo-pill">{filteredEvents.length} visible</span>
            </div>
            <div className="deckgo-grid deckgo-grid-3">
              <ShellStat label="events" value={events.length} />
              <ShellStat label="visible" value={filteredEvents.length} />
              <ShellStat label="agents" value={uniqueAgents} />
            </div>
            <div className="deckgo-surface-tile">
              <p className="deckgo-surface-label">Filter activity</p>
              <div className="deckgo-grid deckgo-grid-2">
                <input
                  className="deckgo-input"
                  value={agentFilter}
                  onChange={(event) => setAgentFilter(event.target.value)}
                  placeholder="agent id or name"
                />
                <select
                  className="deckgo-input"
                  value={eventTypeFilter}
                  onChange={(event) => setEventTypeFilter(event.target.value)}
                >
                  <option value="">all event types</option>
                  {uniqueEventTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <select
                  className="deckgo-input"
                  value={timeRange}
                  onChange={(event) => setTimeRange(event.target.value as ActivityTimeRange)}
                >
                  <option value="1h">last hour</option>
                  <option value="6h">last 6 hours</option>
                  <option value="24h">last 24 hours</option>
                  <option value="7d">last 7 days</option>
                  <option value="all">all</option>
                </select>
              </div>
              <div className="deckgo-actions" style={{ marginTop: 12 }}>
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void refresh(selectedEventId)}
                >
                  Refresh activity
                </button>
              </div>
            </div>
            {error ? <p className="deckgo-note">{error}</p> : null}
            {filteredEvents.length === 0 ? (
              <p className="deckgo-note">No activity events match the current filters.</p>
            ) : (
              <ul className="deckgo-shell-list">
                {filteredEvents.map((event) => (
                  <li key={event.id}>
                    <button
                      type="button"
                      className={`deckgo-selectable-card ${selectedEvent?.id === event.id ? "is-selected" : ""}`}
                      onClick={() => setSelectedEventId(event.id)}
                    >
                      <strong>{event.description}</strong>
                      <div className="deckgo-meta">
                        {event.type} | {event.agentName || event.agentId || "system"}
                      </div>
                      <div className="deckgo-meta">
                        {new Date(event.timestamp).toLocaleString()}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-restored-chat-main">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Selected event</h2>
          </div>
          <p className="deckgo-card-subtitle">
            This slice stays read-first and timeline-oriented instead of restoring the old SSE-rich
            activity shell in one jump.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            {selectedEvent ? (
              <>
                <div className="deckgo-restored-hero-strip">
                  <div>
                    <p className="deckgo-kicker">Event</p>
                    <strong>{selectedEvent.description}</strong>
                    <p className="deckgo-note">{selectedEvent.id}</p>
                  </div>
                  <div className="deckgo-pill-row">
                    <span className="deckgo-pill">{selectedEvent.type}</span>
                    <span className="deckgo-pill">
                      {selectedEvent.agentName || selectedEvent.agentId || "system"}
                    </span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2">
                  <ShellStat
                    label="timestamp"
                    value={new Date(selectedEvent.timestamp).toLocaleString()}
                  />
                  <ShellStat label="type" value={selectedEvent.type} />
                </div>
                {selectedEvent.details ? (
                  <div className="deckgo-surface-tile">
                    <p className="deckgo-surface-label">Details</p>
                    <p className="deckgo-note">{selectedEvent.details}</p>
                  </div>
                ) : null}
                <JsonDetails title="Event payload" payload={selectedEvent} />
              </>
            ) : (
              <p className="deckgo-note">Choose an activity event to inspect it.</p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
