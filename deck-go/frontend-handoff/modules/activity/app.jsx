// activity — Application shell.
// Single-page feed (no list/detail). EventDetailDialog opens above the feed
// for per-event inspection.

const { useState: _appState, useEffect: _appEffect, useMemo: _appMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
  theme: "dark",
  density: "comfortable",
  feedState: "ready",
  filter: "all",
  severity: "all",
  timeRange: "24h",
  searchQuery: "",
  selectedEvent: "",
  detailOpen: false,
} /*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [detailOpen, setDetailOpen] = _appState(false);
  const [selectedId, setSelectedId] = _appState(tweaks.selectedEvent);

  _appEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme);
    document.documentElement.setAttribute("data-density", tweaks.density);
  }, [tweaks.theme, tweaks.density]);

  _appEffect(() => setDetailOpen(tweaks.detailOpen), [tweaks.detailOpen]);
  _appEffect(() => setSelectedId(tweaks.selectedEvent), [tweaks.selectedEvent]);

  const events = window.MOCK.events.events;
  const selectedEvent = _appMemo(
    () => events.find((e) => e.id === selectedId) || null,
    [events, selectedId],
  );

  const onSelect = (id) => {
    setSelectedId(id);
    setDetailOpen(true);
    setTweak({ selectedEvent: id, detailOpen: true });
  };

  const refresh = () => {
    setTweak("feedState", "loading");
    setTimeout(() => setTweak("feedState", "ready"), 320);
  };

  // ⌘K focus search · ⌘R refresh · Esc close detail
  _appEffect(() => {
    const h = (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.querySelector(".toolbar__search input")?.focus();
      } else if (meta && e.key.toLowerCase() === "r") {
        e.preventDefault();
        refresh();
      } else if (e.key === "Escape" && detailOpen) {
        e.preventDefault();
        setDetailOpen(false);
        setTweak("detailOpen", false);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [detailOpen]);

  return (
    <div className="app">
      <FeedView
        events={events}
        feedState={tweaks.feedState}
        searchQuery={tweaks.searchQuery}
        filter={tweaks.filter}
        severity={tweaks.severity}
        timeRange={tweaks.timeRange}
        asOfMs={window.MOCK.kpis.asOfMs}
        runtimeId={window.MOCK.kpis.runtimeId}
        onSearch={(v) => setTweak("searchQuery", v)}
        onFilter={(v) => setTweak("filter", v)}
        onSeverity={(v) => setTweak("severity", v)}
        onTimeRange={(v) => setTweak("timeRange", v)}
        onSelect={onSelect}
        onRefresh={refresh}
      />

      <EventDetailDialog
        open={detailOpen}
        event={selectedEvent}
        onClose={() => {
          setDetailOpen(false);
          setTweak("detailOpen", false);
        }}
      />

      <TweaksPanel title="Activity prototype">
        <TweakSection label="Surface" />
        <TweakRadio
          label="Theme"
          value={tweaks.theme}
          options={["dark", "light"]}
          onChange={(v) => setTweak("theme", v)}
        />
        <TweakRadio
          label="Density"
          value={tweaks.density}
          options={["comfortable", "compact"]}
          onChange={(v) => setTweak("density", v)}
        />

        <TweakSection label="Feed" />
        <TweakRadio
          label="Feed state"
          value={tweaks.feedState}
          options={["ready", "loading", "error", "empty"]}
          onChange={(v) => setTweak("feedState", v)}
        />
        <TweakRadio
          label="Family filter"
          value={tweaks.filter}
          options={FILTER_GROUPS.map((g) => g.id)}
          onChange={(v) => setTweak("filter", v)}
        />
        <TweakRadio
          label="Severity"
          value={tweaks.severity}
          options={SEVERITY_FILTERS.map((s) => s.id)}
          onChange={(v) => setTweak("severity", v)}
        />
        <TweakRadio
          label="Time range"
          value={tweaks.timeRange}
          options={TIME_RANGES.map((t) => t.id)}
          onChange={(v) => setTweak("timeRange", v)}
        />

        <TweakSection label="Selected event" />
        <TweakSelect
          label="Event"
          value={tweaks.selectedEvent}
          options={[
            { value: "", label: "(none)" },
            ...events
              .slice(0, 20)
              .map((e) => ({ value: e.id, label: `${e.type} · ${e.description.slice(0, 40)}` })),
          ]}
          onChange={(v) => setTweak("selectedEvent", v)}
        />
        <TweakToggle
          label="Detail dialog"
          value={tweaks.detailOpen}
          onChange={(v) => setTweak("detailOpen", v)}
        />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
