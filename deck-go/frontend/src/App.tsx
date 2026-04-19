import { useEffect, useState } from "react";
import type {
  DeckGoBootstrapStatusResponse,
  DeckGoChatHistoryResponse,
  DeckGoLogStreamEvent,
  DeckGoServerEvent,
} from "../../contracts/generated/ts/deck-api.generated";
import {
  abortChatRun,
  clearSession,
  createChatSession,
  fetchBootstrapStatus,
  fetchChatHistory,
  fetchChatSnapshot,
  fetchChannels,
  fetchPlugins,
  fetchSessionPreviews,
  fetchSessions,
  fetchSettings,
  logoutChannel,
  patchSession,
  persistAccessToken,
  postConfigSchemaLookup,
  resetSession,
  saveSettings,
  setSessionEventsSubscription,
  sendChatMessage,
  streamEvents,
  streamLogEvents,
} from "./api";

export function App() {
  const [settings, setSettings] = useState({
    accessToken: "",
    gatewayUrl: "",
    gatewayToken: "",
  });
  const [settingsPath, setSettingsPath] = useState("");
  const [bootstrap, setBootstrap] = useState<DeckGoBootstrapStatusResponse | null>(null);
  const [channels, setChannels] = useState<Record<string, unknown> | null>(null);
  const [plugins, setPlugins] = useState<Record<string, unknown> | null>(null);
  const [sessions, setSessions] = useState<Record<string, unknown> | null>(null);
  const [sessionPreviews, setSessionPreviews] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<DeckGoServerEvent[]>([]);
  const [logEvents, setLogEvents] = useState<DeckGoLogStreamEvent[]>([]);
  const [sessionKey, setSessionKey] = useState("");
  const [agentId, setAgentId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [configPath, setConfigPath] = useState("");
  const [message, setMessage] = useState("");
  const [runId, setRunId] = useState("");
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<DeckGoChatHistoryResponse | null>(null);
  const [schemaLookup, setSchemaLookup] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [chatActionResult, setChatActionResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await fetchSettings();
        if (cancelled) {
          return;
        }
        setSettings({
          accessToken: result.settings.accessToken ?? "",
          gatewayUrl: result.settings.gatewayUrl ?? "",
          gatewayToken: result.settings.gatewayToken ?? "",
        });
        setSettingsPath(result.path);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "failed to load settings");
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    persistAccessToken(settings.accessToken);
  }, [settings.accessToken]);

  useEffect(() => {
    if (!settings.accessToken.trim()) {
      return undefined;
    }
    const controller = new AbortController();
    void streamEvents({
      signal: controller.signal,
      onEvent(event) {
        setEvents((current) => [event, ...current].slice(0, 20));
      },
    }).catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : "failed to connect stream");
      }
    });
    return () => controller.abort();
  }, [settings.accessToken]);

  useEffect(() => {
    if (!settings.accessToken.trim()) {
      return undefined;
    }
    const controller = new AbortController();
    void streamLogEvents({
      signal: controller.signal,
      onEvent(event) {
        setLogEvents((current) => [event, ...current].slice(0, 20));
      },
    }).catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : "failed to connect logs stream");
      }
    });
    return () => controller.abort();
  }, [settings.accessToken]);

  const refreshBootstrap = async () => {
    try {
      const result = await fetchBootstrapStatus();
      setBootstrap(result);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to fetch bootstrap status");
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await saveSettings(settings);
      persistAccessToken(settings.accessToken);
      await refreshBootstrap();
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const refreshInventory = async () => {
    try {
      const [channelsResult, pluginsResult, sessionsResult] = await Promise.all([
        fetchChannels(),
        fetchPlugins(),
        fetchSessions(),
      ]);
      setChannels(channelsResult as unknown as Record<string, unknown>);
      setPlugins(pluginsResult as unknown as Record<string, unknown>);
      setSessions(sessionsResult as unknown as Record<string, unknown>);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to fetch inventory");
    }
  };

  const refreshSnapshot = async () => {
    if (!sessionKey.trim()) {
      setError("sessionKey is required for snapshot");
      return;
    }
    try {
      const result = await fetchChatSnapshot({ sessionKey });
      setSnapshot(result as unknown as Record<string, unknown>);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to fetch snapshot");
    }
  };

  const refreshHistory = async () => {
    if (!sessionKey.trim()) {
      setError("sessionKey is required for history");
      return;
    }
    try {
      const result = await fetchChatHistory({ sessionKey, limit: 50 });
      setHistory(result);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to fetch history");
    }
  };

  const onCreateSession = async () => {
    try {
      const result = await createChatSession({
        ...(agentId.trim() ? { agentId: agentId.trim() } : {}),
        ...(message.trim() ? { message: message.trim() } : {}),
      });
      setChatActionResult(result);
      const maybeKey =
        typeof result.key === "string"
          ? result.key
          : typeof result.sessionKey === "string"
            ? result.sessionKey
            : "";
      if (maybeKey) {
        setSessionKey(maybeKey);
      }
      setError("");
      await refreshInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to create session");
    }
  };

  const onSendMessage = async () => {
    if (!sessionKey.trim()) {
      setError("sessionKey is required to send a message");
      return;
    }
    try {
      const result = await sendChatMessage({
        sessionKey: sessionKey.trim(),
        message: message.trim(),
      });
      setChatActionResult(result);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to send message");
    }
  };

  const onAbortRun = async () => {
    if (!sessionKey.trim()) {
      setError("sessionKey is required to abort");
      return;
    }
    try {
      const result = await abortChatRun({
        sessionKey: sessionKey.trim(),
        ...(runId.trim() ? { runId: runId.trim() } : {}),
      });
      setChatActionResult(result);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to abort run");
    }
  };

  const onPreviewSession = async () => {
    if (!sessionKey.trim()) {
      setError("sessionKey is required for preview");
      return;
    }
    try {
      const result = await fetchSessionPreviews([sessionKey.trim()]);
      setSessionPreviews(result as unknown as Record<string, unknown>);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to preview session");
    }
  };

  const onResetSession = async () => {
    if (!sessionKey.trim()) {
      setError("sessionKey is required to reset");
      return;
    }
    try {
      const result = await resetSession({ sessionKey: sessionKey.trim() });
      setChatActionResult(result);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to reset session");
    }
  };

  const onClearSession = async () => {
    if (!sessionKey.trim()) {
      setError("sessionKey is required to clear");
      return;
    }
    try {
      const result = await clearSession({ sessionKey: sessionKey.trim() });
      setChatActionResult(result);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to clear session");
    }
  };

  const onPatchSession = async () => {
    if (!sessionKey.trim()) {
      setError("sessionKey is required to patch");
      return;
    }
    try {
      const result = await patchSession({
        sessionKey: sessionKey.trim(),
        model: "gpt-5.4",
      });
      setChatActionResult(result);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to patch session");
    }
  };

  const onSubscribeSessionEvents = async () => {
    if (!sessionKey.trim()) {
      setError("sessionKey is required to subscribe");
      return;
    }
    try {
      const result = await setSessionEventsSubscription({
        sessionKey: sessionKey.trim(),
        action: "subscribe",
      });
      setChatActionResult(result);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to subscribe session events");
    }
  };

  const onUnsubscribeSessionEvents = async () => {
    if (!sessionKey.trim()) {
      setError("sessionKey is required to unsubscribe");
      return;
    }
    try {
      const result = await setSessionEventsSubscription({
        sessionKey: sessionKey.trim(),
        action: "unsubscribe",
      });
      setChatActionResult(result);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to unsubscribe session events");
    }
  };

  const onLookupSchema = async () => {
    if (!configPath.trim()) {
      setError("path is required for schema lookup");
      return;
    }
    try {
      const result = await postConfigSchemaLookup({ path: configPath.trim() });
      setSchemaLookup(result);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to lookup schema");
    }
  };

  const onLogoutChannel = async () => {
    if (!channelId.trim()) {
      setError("channelId is required to logout");
      return;
    }
    try {
      const result = await logoutChannel(channelId.trim());
      setChatActionResult(result);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to logout channel");
    }
  };

  return (
    <main
      style={{
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        margin: "0 auto",
        maxWidth: 960,
        padding: 32,
      }}
    >
      <h1>deck-go</h1>
      <p>Phase 0/1 frontend scaffold for the parallel Deck migration.</p>
      <p>
        This app is intentionally minimal until the control-plane contract inventory and
        compatibility façade are established.
      </p>
      <section style={{ marginTop: 24, display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Deck access token</span>
          <input
            value={settings.accessToken}
            onChange={(e) =>
              setSettings((current) => ({ ...current, accessToken: e.target.value }))
            }
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Gateway URL</span>
          <input
            value={settings.gatewayUrl}
            onChange={(e) => setSettings((current) => ({ ...current, gatewayUrl: e.target.value }))}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Gateway token</span>
          <input
            value={settings.gatewayToken}
            onChange={(e) =>
              setSettings((current) => ({ ...current, gatewayToken: e.target.value }))
            }
          />
        </label>
        <div style={{ display: "flex", gap: 12 }}>
          <button type="button" onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save settings"}
          </button>
          <button type="button" onClick={() => void refreshBootstrap()}>
            Refresh bootstrap status
          </button>
          <button type="button" onClick={() => void refreshInventory()}>
            Refresh inventory
          </button>
        </div>
        {settingsPath ? <p style={{ color: "#555" }}>Settings file: {settingsPath}</p> : null}
      </section>
      <section style={{ marginTop: 24, display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Agent ID for session create</span>
          <input value={agentId} onChange={(e) => setAgentId(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Message</span>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Session key for snapshot</span>
          <input value={sessionKey} onChange={(e) => setSessionKey(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Run ID for abort</span>
          <input value={runId} onChange={(e) => setRunId(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Channel ID for logout</span>
          <input value={channelId} onChange={(e) => setChannelId(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Config path for schema lookup</span>
          <input value={configPath} onChange={(e) => setConfigPath(e.target.value)} />
        </label>
        <div>
          <button type="button" onClick={() => void onCreateSession()}>
            Create session
          </button>{" "}
          <button type="button" onClick={() => void onSendMessage()}>
            Send message
          </button>{" "}
          <button type="button" onClick={() => void onAbortRun()}>
            Abort run
          </button>{" "}
          <button type="button" onClick={() => void onPreviewSession()}>
            Preview session
          </button>{" "}
          <button type="button" onClick={() => void onResetSession()}>
            Reset session
          </button>{" "}
          <button type="button" onClick={() => void onClearSession()}>
            Clear session
          </button>{" "}
          <button type="button" onClick={() => void onPatchSession()}>
            Patch session
          </button>{" "}
          <button type="button" onClick={() => void onSubscribeSessionEvents()}>
            Subscribe session events
          </button>{" "}
          <button type="button" onClick={() => void onUnsubscribeSessionEvents()}>
            Unsubscribe session events
          </button>{" "}
          <button type="button" onClick={() => void onLogoutChannel()}>
            Logout channel
          </button>{" "}
          <button type="button" onClick={() => void onLookupSchema()}>
            Lookup schema
          </button>{" "}
          <button type="button" onClick={() => void refreshSnapshot()}>
            Refresh chat snapshot
          </button>{" "}
          <button type="button" onClick={() => void refreshHistory()}>
            Refresh chat history
          </button>
        </div>
      </section>
      {error ? (
        <pre style={{ marginTop: 24, color: "#b91c1c", whiteSpace: "pre-wrap" }}>{error}</pre>
      ) : null}
      {bootstrap ? (
        <section style={{ marginTop: 24 }}>
          <h2>Bootstrap status</h2>
          <pre
            style={{
              background: "#111827",
              color: "#e5e7eb",
              borderRadius: 12,
              padding: 16,
              overflowX: "auto",
            }}
          >
            {JSON.stringify(bootstrap, null, 2)}
          </pre>
        </section>
      ) : null}
      {channels ? (
        <section style={{ marginTop: 24 }}>
          <h2>Channels</h2>
          <pre
            style={{
              background: "#111827",
              color: "#e5e7eb",
              borderRadius: 12,
              padding: 16,
              overflowX: "auto",
            }}
          >
            {JSON.stringify(channels, null, 2)}
          </pre>
        </section>
      ) : null}
      {plugins ? (
        <section style={{ marginTop: 24 }}>
          <h2>Plugins</h2>
          <pre
            style={{
              background: "#111827",
              color: "#e5e7eb",
              borderRadius: 12,
              padding: 16,
              overflowX: "auto",
            }}
          >
            {JSON.stringify(plugins, null, 2)}
          </pre>
        </section>
      ) : null}
      {sessions ? (
        <section style={{ marginTop: 24 }}>
          <h2>Sessions</h2>
          <pre
            style={{
              background: "#111827",
              color: "#e5e7eb",
              borderRadius: 12,
              padding: 16,
              overflowX: "auto",
            }}
          >
            {JSON.stringify(sessions, null, 2)}
          </pre>
        </section>
      ) : null}
      {snapshot ? (
        <section style={{ marginTop: 24 }}>
          <h2>Chat snapshot</h2>
          <pre
            style={{
              background: "#111827",
              color: "#e5e7eb",
              borderRadius: 12,
              padding: 16,
              overflowX: "auto",
            }}
          >
            {JSON.stringify(snapshot, null, 2)}
          </pre>
        </section>
      ) : null}
      {history ? (
        <section style={{ marginTop: 24 }}>
          <h2>Chat history</h2>
          <pre
            style={{
              background: "#111827",
              color: "#e5e7eb",
              borderRadius: 12,
              padding: 16,
              overflowX: "auto",
            }}
          >
            {JSON.stringify(history, null, 2)}
          </pre>
        </section>
      ) : null}
      {schemaLookup ? (
        <section style={{ marginTop: 24 }}>
          <h2>Schema lookup</h2>
          <pre
            style={{
              background: "#111827",
              color: "#e5e7eb",
              borderRadius: 12,
              padding: 16,
              overflowX: "auto",
            }}
          >
            {JSON.stringify(schemaLookup, null, 2)}
          </pre>
        </section>
      ) : null}
      {sessionPreviews ? (
        <section style={{ marginTop: 24 }}>
          <h2>Session previews</h2>
          <pre
            style={{
              background: "#111827",
              color: "#e5e7eb",
              borderRadius: 12,
              padding: 16,
              overflowX: "auto",
            }}
          >
            {JSON.stringify(sessionPreviews, null, 2)}
          </pre>
        </section>
      ) : null}
      {chatActionResult ? (
        <section style={{ marginTop: 24 }}>
          <h2>Chat action result</h2>
          <pre
            style={{
              background: "#111827",
              color: "#e5e7eb",
              borderRadius: 12,
              padding: 16,
              overflowX: "auto",
            }}
          >
            {JSON.stringify(chatActionResult, null, 2)}
          </pre>
        </section>
      ) : null}
      <section style={{ marginTop: 24 }}>
        <h2>Stream events</h2>
        <pre
          style={{
            background: "#111827",
            color: "#e5e7eb",
            borderRadius: 12,
            padding: 16,
            overflowX: "auto",
          }}
        >
          {JSON.stringify(events, null, 2)}
        </pre>
      </section>
      <section style={{ marginTop: 24 }}>
        <h2>Log stream events</h2>
        <pre
          style={{
            background: "#111827",
            color: "#e5e7eb",
            borderRadius: 12,
            padding: 16,
            overflowX: "auto",
          }}
        >
          {JSON.stringify(logEvents, null, 2)}
        </pre>
      </section>
    </main>
  );
}
