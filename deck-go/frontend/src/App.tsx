import { useEffect, useRef, useState } from "react";
import type {
  DeckGoBootstrapStatusResponse,
  DeckGoChatHistoryResponse,
  DeckGoChatSnapshotResponse,
  DeckGoLogStreamEvent,
  DeckGoRuntimeGatewayActionResponse,
  DeckGoSessionDetailResponse,
  DeckGoSessionMessageStreamEvent,
  DeckGoSessionMeta,
  DeckGoSessionToolStreamEvent,
  DeckGoSessionsChangedStreamEvent,
  DeckGoSessionsListResponse,
  DeckGoSessionsPreviewResponse,
  DeckGoServerEvent,
  DeckGoSettings,
  DeckGoSettingsResponse,
  DeckGoTranscriptMessage,
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
  fetchRuntimeGatewayStatus,
  fetchSessionDetail,
  fetchSessionPreviews,
  fetchSessions,
  fetchSettings,
  logoutChannel,
  patchSession,
  persistAccessToken,
  postConfigSchemaLookup,
  restartRuntimeGateway,
  resetSession,
  saveSettings,
  setSessionEventsSubscription,
  sendChatMessage,
  startRuntimeGateway,
  stopRuntimeGateway,
  streamEvents,
  streamLogEvents,
} from "./api";
import {
  EventFeedCard,
  JsonDetails,
  SessionDetailCard,
  SessionListCard,
  SessionPreviewCard,
  ShellStat,
} from "./shell-components";
import { parseServerEvent, summarizeServerEvent } from "./stream-contract";
import { useThemeMode } from "./theme";

const NOOP_CLEANUP = () => {};

type TranscriptFilter = "all" | "user" | "assistant" | "tool";
type SessionReadState = "idle" | "loading" | "ready";
type LiveConversationState = "idle" | "subscribing" | "ready" | "sending" | "aborting";
type ToolProgressEntry = {
  runId: string;
  sessionKey: string;
  phase: string;
  label: string;
  ts: number;
};

const ACTIVE_AGENT_TAB_KEY = "deckGoActiveAgentTab";
const ACTIVE_SESSION_KEY = "deckGoActiveSessionKey";
const ACTIVE_AGENT_ID_KEY = "deckGoActiveAgentId";
const LAST_EVENT_ID_KEY = "deckGoLastEventId";

function readStoredValue(key: string) {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(key)?.trim() || "";
}

function matchesTranscriptFilter(
  message: DeckGoTranscriptMessage,
  query: string,
  filter: TranscriptFilter,
) {
  if (filter !== "all" && message.role !== filter) {
    return false;
  }
  if (!query.trim()) {
    return true;
  }
  const haystack = JSON.stringify({
    id: message.id,
    role: message.role,
    content: message.content,
  }).toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

function filterMessages(
  messages: DeckGoTranscriptMessage[],
  query: string,
  filter: TranscriptFilter,
) {
  return messages.filter((message) => matchesTranscriptFilter(message, query, filter));
}

function upsertTranscriptMessage(
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
  return [...current, nextMessage].toSorted((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
}

function firstTextContent(message: DeckGoTranscriptMessage | undefined) {
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

function patchSessionMeta(session: DeckGoSessionMeta, event: DeckGoSessionsChangedStreamEvent) {
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

function patchPreviewText(
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

function getAgentTabs(sessions: DeckGoSessionMeta[]) {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const session of sessions) {
    const agent = session.agentId?.trim();
    if (!agent || seen.has(agent)) {
      continue;
    }
    seen.add(agent);
    values.push(agent);
  }
  return values;
}

function summarizeToolProgressEntry(payload: DeckGoSessionToolStreamEvent): ToolProgressEntry {
  const data = payload.data ?? {};
  const phase = typeof data.phase === "string" && data.phase.trim() ? data.phase.trim() : "unknown";
  const labelCandidate =
    (typeof data.name === "string" && data.name) ||
    (typeof data.tool === "string" && data.tool) ||
    (typeof data.title === "string" && data.title) ||
    (typeof data.kind === "string" && data.kind) ||
    "tool event";
  return {
    runId: payload.runId,
    sessionKey: payload.sessionKey,
    phase,
    label: labelCandidate,
    ts: payload.ts ?? Date.now(),
  };
}

function upsertToolProgressEntry(
  entries: ToolProgressEntry[],
  payload: DeckGoSessionToolStreamEvent,
) {
  const next = summarizeToolProgressEntry(payload);
  const index = entries.findIndex(
    (entry) => entry.runId === next.runId && entry.label === next.label,
  );
  if (index >= 0) {
    const copy = entries.slice();
    copy[index] = next;
    return copy.toSorted((a, b) => b.ts - a.ts).slice(0, 8);
  }
  return [next, ...entries].toSorted((a, b) => b.ts - a.ts).slice(0, 8);
}

export function App() {
  const { themeMode, setThemeMode } = useThemeMode();

  const [settings, setSettings] = useState<DeckGoSettings>({
    accessToken: "",
    managedGateway: {
      mode: "managed",
      command: "",
      args: [],
      workingDir: "",
      bindHost: "127.0.0.1",
      bindPort: 18789,
      gatewayToken: "",
      autoStart: true,
      env: {},
    },
  });
  const [settingsPath, setSettingsPath] = useState("");
  const [bootstrap, setBootstrap] = useState<DeckGoBootstrapStatusResponse | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<DeckGoRuntimeGatewayActionResponse | null>(
    null,
  );
  const [channels, setChannels] = useState<Record<string, unknown> | null>(null);
  const [plugins, setPlugins] = useState<Record<string, unknown> | null>(null);
  const [sessions, setSessions] = useState<DeckGoSessionsListResponse | null>(null);
  const [sessionPreviews, setSessionPreviews] = useState<DeckGoSessionsPreviewResponse | null>(
    null,
  );
  const [events, setEvents] = useState<DeckGoServerEvent[]>([]);
  const [logEvents, setLogEvents] = useState<DeckGoLogStreamEvent[]>([]);
  const [liveTimeline, setLiveTimeline] = useState<string[]>([]);
  const [toolProgressEntries, setToolProgressEntries] = useState<ToolProgressEntry[]>([]);
  const [continuityState, setContinuityState] = useState({
    lastEventId: readStoredValue(LAST_EVENT_ID_KEY),
    projectionGapCount: 0,
    lastProjectionGapReason: "",
    sessionEventCount: 0,
    lastSessionEventKind: "",
  });
  const [sessionKey, setSessionKey] = useState(() => readStoredValue(ACTIVE_SESSION_KEY));
  const [agentId, setAgentId] = useState(() => readStoredValue(ACTIVE_AGENT_ID_KEY));
  const [channelId, setChannelId] = useState("");
  const [configPath, setConfigPath] = useState("");
  const [requestedModel, setRequestedModel] = useState("cpa/gpt-5.4");
  const [message, setMessage] = useState("");
  const [runId, setRunId] = useState("");
  const [snapshot, setSnapshot] = useState<DeckGoChatSnapshotResponse | null>(null);
  const [sessionDetail, setSessionDetail] = useState<DeckGoSessionDetailResponse | null>(null);
  const [history, setHistory] = useState<DeckGoChatHistoryResponse | null>(null);
  const [schemaLookup, setSchemaLookup] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [chatActionResult, setChatActionResult] = useState<unknown>(null);
  const [selectedAgentTab, setSelectedAgentTab] = useState(
    () => readStoredValue(ACTIVE_AGENT_TAB_KEY) || "all",
  );
  const [transcriptQuery, setTranscriptQuery] = useState("");
  const [transcriptFilter, setTranscriptFilter] = useState<TranscriptFilter>("all");
  const [inventoryState, setInventoryState] = useState<"idle" | "loading" | "ready">("idle");
  const [sessionReadState, setSessionReadState] = useState<SessionReadState>("idle");
  const [liveConversationState, setLiveConversationState] = useState<LiveConversationState>("idle");
  const [serverStreamState, setServerStreamState] = useState<
    "idle" | "connecting" | "connected" | "reconnecting" | "error"
  >("idle");
  const [logStreamState, setLogStreamState] = useState<
    "idle" | "connecting" | "connected" | "reconnecting" | "error"
  >("idle");
  const [authRequired, setAuthRequired] = useState(false);
  const [authTokenInput, setAuthTokenInput] = useState("");
  const [authMessage, setAuthMessage] = useState(
    "Enter the deck-go access token to unlock the control plane.",
  );
  const sessionReadSeq = useRef(0);
  const initialLastEventIdRef = useRef(readStoredValue(LAST_EVENT_ID_KEY));
  const previousServerStreamStateRef = useRef(serverStreamState);

  const updateManagedGateway = (patch: Partial<NonNullable<DeckGoSettings["managedGateway"]>>) => {
    setSettings((current) => ({
      ...current,
      managedGateway: {
        ...current.managedGateway,
        ...patch,
      },
    }));
  };

  const applyLoadedSettings = (result: DeckGoSettingsResponse) => {
    setSettings({
      accessToken: result.settings.accessToken ?? "",
      managedGateway: {
        mode: result.settings.managedGateway?.mode ?? "managed",
        command: result.settings.managedGateway?.command ?? "",
        args: result.settings.managedGateway?.args ?? [],
        workingDir: result.settings.managedGateway?.workingDir ?? "",
        bindHost: result.settings.managedGateway?.bindHost ?? "127.0.0.1",
        bindPort: result.settings.managedGateway?.bindPort ?? 18789,
        gatewayToken: result.settings.managedGateway?.gatewayToken ?? "",
        autoStart: result.settings.managedGateway?.autoStart ?? true,
        env: result.settings.managedGateway?.env ?? {},
      },
    });
    setSettingsPath(result.path);
    setAuthRequired(false);
    setAuthMessage("Enter the deck-go access token to unlock the control plane.");
  };

  const isAuthError = (message: string) =>
    /authentication token/i.test(message) || /unauthorized/i.test(message);

  const loadSettings = async () => {
    const result = await fetchSettings();
    applyLoadedSettings(result);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await fetchSettings();
        if (cancelled) {
          return;
        }
        applyLoadedSettings(result);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "failed to load settings";
          if (isAuthError(message)) {
            setAuthRequired(true);
            setAuthMessage(message);
            setError("");
            return;
          }
          setError(message);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    persistAccessToken(settings.accessToken ?? "");
  }, [settings.accessToken]);

  useEffect(() => {
    window.localStorage.setItem(ACTIVE_AGENT_TAB_KEY, selectedAgentTab);
  }, [selectedAgentTab]);

  useEffect(() => {
    if (sessionKey.trim()) {
      window.localStorage.setItem(ACTIVE_SESSION_KEY, sessionKey.trim());
      return;
    }
    window.localStorage.removeItem(ACTIVE_SESSION_KEY);
  }, [sessionKey]);

  useEffect(() => {
    if (agentId.trim()) {
      window.localStorage.setItem(ACTIVE_AGENT_ID_KEY, agentId.trim());
      return;
    }
    window.localStorage.removeItem(ACTIVE_AGENT_ID_KEY);
  }, [agentId]);

  useEffect(() => {
    if (continuityState.lastEventId) {
      window.localStorage.setItem(LAST_EVENT_ID_KEY, continuityState.lastEventId);
      initialLastEventIdRef.current = continuityState.lastEventId;
    }
  }, [continuityState.lastEventId]);

  useEffect(() => {
    if (!(settings.accessToken ?? "").trim()) {
      return undefined;
    }
    void refreshBootstrap();
    void refreshInventory();
    return undefined;
  }, [settings.accessToken]);

  useEffect(() => {
    if (!(settings.accessToken ?? "").trim()) {
      setServerStreamState("idle");
      return undefined;
    }
    const controller = new AbortController();
    void streamEvents({
      signal: controller.signal,
      initialLastEventId: initialLastEventIdRef.current,
      onStatusChange(status) {
        setServerStreamState(status);
      },
      onEvent(event) {
        if (event.id) {
          setContinuityState((current) => ({ ...current, lastEventId: event.id ?? "" }));
        }
        const parsed = parseServerEvent(event);
        if (parsed.kind === "projection.gap") {
          setContinuityState((current) => ({
            ...current,
            projectionGapCount: current.projectionGapCount + 1,
            lastProjectionGapReason: parsed.payload.reason || "unknown",
          }));
        } else if (
          parsed.kind === "session.message" ||
          parsed.kind === "session.tool" ||
          parsed.kind === "sessions.changed"
        ) {
          setContinuityState((current) => ({
            ...current,
            sessionEventCount: current.sessionEventCount + 1,
            lastSessionEventKind: parsed.kind,
          }));
        }
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
    if (!(settings.accessToken ?? "").trim()) {
      setLogStreamState("idle");
      return undefined;
    }
    const controller = new AbortController();
    void streamLogEvents({
      signal: controller.signal,
      onStatusChange(status) {
        setLogStreamState(status);
      },
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

  useEffect(() => {
    const previous = previousServerStreamStateRef.current;
    if (previous !== serverStreamState) {
      if (serverStreamState === "reconnecting") {
        setLiveTimeline((current) => ["stream reconnecting", ...current].slice(0, 8));
      } else if (serverStreamState === "error") {
        setLiveTimeline((current) => ["stream connection error", ...current].slice(0, 8));
      } else if (
        serverStreamState === "connected" &&
        (previous === "reconnecting" || previous === "error") &&
        sessionKey.trim()
      ) {
        setLiveTimeline((current) => ["stream reconnected", ...current].slice(0, 8));
        void hydrateSessionRead(sessionKey, agentId, { setLoading: false });
        void refreshInventory();
      }
    }
    previousServerStreamStateRef.current = serverStreamState;
  }, [agentId, serverStreamState, sessionKey]);

  const refreshBootstrap = async () => {
    try {
      const [bootstrapResult, runtimeResult] = await Promise.all([
        fetchBootstrapStatus(),
        fetchRuntimeGatewayStatus(),
      ]);
      setBootstrap(bootstrapResult);
      setRuntimeStatus(runtimeResult);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to fetch bootstrap status");
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await saveSettings(settings);
      persistAccessToken(settings.accessToken ?? "");
      await refreshBootstrap();
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const refreshInventory = async () => {
    setInventoryState("loading");
    try {
      const [channelsResult, pluginsResult, sessionsResult] = await Promise.all([
        fetchChannels(),
        fetchPlugins(),
        fetchSessions(),
      ]);
      setChannels(channelsResult as unknown as Record<string, unknown>);
      setPlugins(pluginsResult as unknown as Record<string, unknown>);
      setSessions(sessionsResult);
      setInventoryState("ready");
      setError("");
    } catch (err) {
      setInventoryState("idle");
      setError(err instanceof Error ? err.message : "failed to fetch inventory");
    }
  };

  const onStartGateway = async () => {
    try {
      const result = await startRuntimeGateway();
      setRuntimeStatus(result);
      await refreshBootstrap();
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to start gateway");
    }
  };

  const onStopGateway = async () => {
    try {
      const result = await stopRuntimeGateway();
      setRuntimeStatus(result);
      await refreshBootstrap();
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to stop gateway");
    }
  };

  const onRestartGateway = async () => {
    try {
      const result = await restartRuntimeGateway();
      setRuntimeStatus(result);
      await refreshBootstrap();
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to restart gateway");
    }
  };

  const refreshSnapshot = async () => {
    if (!sessionKey.trim()) {
      setError("sessionKey is required for snapshot");
      return;
    }
    try {
      const result = await fetchChatSnapshot({ sessionKey });
      setSnapshot(result);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to fetch snapshot");
    }
  };

  const refreshSessionDetail = async () => {
    if (!sessionKey.trim()) {
      setError("sessionKey is required for session detail");
      return;
    }
    try {
      const result = await fetchSessionDetail({
        sessionKey,
        ...(agentId.trim() ? { agentId: agentId.trim() } : {}),
      });
      setSessionDetail(result);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to fetch session detail");
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
      setLiveConversationState("sending");
      const resolvedAgentId =
        agentId.trim() || (selectedAgentTab !== "all" ? selectedAgentTab : "");
      const result = await createChatSession({
        ...(resolvedAgentId ? { agentId: resolvedAgentId } : {}),
        ...(requestedModel.trim() ? { model: requestedModel.trim() } : {}),
        ...(message.trim() ? { message: message.trim() } : {}),
      });
      setChatActionResult(result);
      const maybeKey = result.key ?? "";
      if (maybeKey) {
        setSessionKey(maybeKey);
      }
      if (resolvedAgentId) {
        setAgentId(resolvedAgentId);
        setSelectedAgentTab(resolvedAgentId);
      }
      if (result.runId) {
        setRunId(result.runId);
      }
      if (message.trim()) {
        setMessage("");
      }
      setLiveConversationState("ready");
      setError("");
      await refreshInventory();
    } catch (err) {
      setLiveConversationState("idle");
      setError(err instanceof Error ? err.message : "failed to create session");
    }
  };

  const onSendMessage = async () => {
    if (!message.trim()) {
      setError("message is required to send");
      return;
    }
    if (!sessionKey.trim()) {
      await onCreateSession();
      return;
    }
    try {
      setLiveConversationState("sending");
      const result = await sendChatMessage({
        sessionKey: sessionKey.trim(),
        message: message.trim(),
      });
      setChatActionResult(result);
      if (result.runId) {
        setRunId(result.runId);
      }
      setMessage("");
      setLiveConversationState("ready");
      setError("");
    } catch (err) {
      setLiveConversationState("idle");
      setError(err instanceof Error ? err.message : "failed to send message");
    }
  };

  const onAbortRun = async () => {
    if (!sessionKey.trim()) {
      setError("sessionKey is required to abort");
      return;
    }
    try {
      setLiveConversationState("aborting");
      const result = await abortChatRun({
        sessionKey: sessionKey.trim(),
        ...(runId.trim() ? { runId: runId.trim() } : {}),
      });
      setChatActionResult(result);
      if (result.abortedRunId) {
        setRunId("");
      }
      setLiveConversationState("ready");
      setError("");
    } catch (err) {
      setLiveConversationState("idle");
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
      setSessionPreviews(result);
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
    if (!requestedModel.trim()) {
      setError("model override is required to patch");
      return;
    }
    try {
      const result = await patchSession({
        sessionKey: sessionKey.trim(),
        model: requestedModel.trim(),
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

  const onUnlockControlPlane = async () => {
    const token = authTokenInput.trim();
    if (!token) {
      setAuthMessage("Access token is required.");
      return;
    }
    try {
      persistAccessToken(token);
      await loadSettings();
      setError("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to unlock control plane";
      setAuthRequired(true);
      setAuthMessage(message);
      setError("");
    }
  };

  const onSelectSession = (session: DeckGoSessionMeta) => {
    setSessionReadState("loading");
    setSessionDetail(null);
    setSnapshot(null);
    setHistory(null);
    setLiveTimeline([]);
    setToolProgressEntries([]);
    setRunId("");
    setSessionKey(session.key);
    if (session.agentId) {
      setAgentId(session.agentId);
      setSelectedAgentTab(session.agentId);
    }
  };

  const applyLiveMessage = (payload: DeckGoSessionMessageStreamEvent) => {
    if (!payload.message || payload.sessionKey !== sessionKey) {
      return;
    }
    const previewText = firstTextContent(payload.message);
    setSessionDetail((current) =>
      current
        ? {
            ...current,
            messages: upsertTranscriptMessage(current.messages, payload.message!),
          }
        : current,
    );
    setSnapshot((current) =>
      current
        ? {
            ...current,
            messages: upsertTranscriptMessage(current.messages, payload.message!),
          }
        : current,
    );
    setHistory((current) =>
      current
        ? {
            ...current,
            messages: upsertTranscriptMessage(current.messages, payload.message!),
          }
        : current,
    );
    setSessions((current) =>
      current
        ? {
            ...current,
            sessions: (current.sessions ?? []).map((session) =>
              session.key === payload.sessionKey
                ? {
                    ...session,
                    lastMessagePreview: previewText || session.lastMessagePreview,
                    updatedAt: payload.updatedAt ?? session.updatedAt,
                    status: payload.status || session.status,
                  }
                : session,
            ),
          }
        : current,
    );
    if (previewText) {
      setSessionPreviews((current) => patchPreviewText(current, payload.sessionKey, previewText));
    }
  };

  const applySessionChange = (payload: DeckGoSessionsChangedStreamEvent) => {
    setSessions((current) =>
      current
        ? {
            ...current,
            sessions: (current.sessions ?? []).map((session) => patchSessionMeta(session, payload)),
          }
        : current,
    );
    if (payload.sessionKey !== sessionKey) {
      return;
    }
    setSessionDetail((current) =>
      current
        ? {
            ...current,
            session: patchSessionMeta(current.session ?? { key: payload.sessionKey }, payload),
          }
        : current,
    );
    setSnapshot((current) =>
      current
        ? {
            ...current,
            session: patchSessionMeta(current.session ?? { key: payload.sessionKey }, payload),
          }
        : current,
    );
    if (payload.runId) {
      setRunId(payload.runId);
    }
  };

  const hydrateSessionRead = async (
    targetSessionKey: string,
    targetAgentId: string,
    options?: { setLoading?: boolean },
  ) => {
    const trimmedSessionKey = targetSessionKey.trim();
    if (!trimmedSessionKey) {
      setSessionReadState("idle");
      return;
    }
    const readSeq = ++sessionReadSeq.current;
    if (options?.setLoading !== false) {
      setSessionReadState("loading");
    }
    const trimmedAgentId = targetAgentId.trim();
    try {
      const [detailResult, snapshotResult, historyResult] = await Promise.all([
        fetchSessionDetail({
          sessionKey: trimmedSessionKey,
          ...(trimmedAgentId ? { agentId: trimmedAgentId } : {}),
        }),
        fetchChatSnapshot({
          sessionKey: trimmedSessionKey,
          ...(trimmedAgentId ? { agentId: trimmedAgentId } : {}),
        }),
        fetchChatHistory({ sessionKey: trimmedSessionKey, limit: 50 }),
      ]);
      if (readSeq !== sessionReadSeq.current) {
        return;
      }
      setSessionDetail(detailResult);
      setSnapshot(snapshotResult);
      setHistory(historyResult);
      setSessionReadState("ready");
      setError("");
    } catch (err) {
      if (readSeq !== sessionReadSeq.current) {
        return;
      }
      setSessionReadState("idle");
      setError(err instanceof Error ? err.message : "failed to load selected session");
    }
  };

  useEffect(() => {
    if (selectedAgentTab === "all") {
      return;
    }
    const tabStillExists = sessions?.sessions?.some(
      (session) => session.agentId === selectedAgentTab,
    );
    if (!tabStillExists) {
      setSelectedAgentTab("all");
    }
  }, [selectedAgentTab, sessions]);

  useEffect(() => {
    const candidateSessions =
      selectedAgentTab === "all"
        ? (sessions?.sessions ?? [])
        : (sessions?.sessions ?? []).filter((session) => session.agentId === selectedAgentTab);
    const selectedStillVisible = candidateSessions.some((session) => session.key === sessionKey);
    if (selectedStillVisible || candidateSessions.length === 0) {
      return;
    }
    onSelectSession(candidateSessions[0]);
  }, [selectedAgentTab, sessionKey, sessions]);

  useEffect(() => {
    if (!(settings.accessToken ?? "").trim()) {
      return NOOP_CLEANUP;
    }
    const previewKeys = (
      selectedAgentTab === "all"
        ? (sessions?.sessions ?? [])
        : (sessions?.sessions ?? []).filter((session) => session.agentId === selectedAgentTab)
    )
      .slice(0, 4)
      .map((session) => session.key);
    if (previewKeys.length === 0) {
      setSessionPreviews(null);
      return NOOP_CLEANUP;
    }
    let cancelled = false;
    void fetchSessionPreviews(previewKeys)
      .then((result) => {
        if (!cancelled) {
          setSessionPreviews(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "failed to load session previews");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAgentTab, sessions, settings.accessToken]);

  useEffect(() => {
    if (!(settings.accessToken ?? "").trim() || !sessionKey.trim()) {
      if (!sessionKey.trim()) {
        setSessionReadState("idle");
      }
      return undefined;
    }
    void hydrateSessionRead(sessionKey, agentId, { setLoading: true });
    return undefined;
  }, [agentId, sessionKey, settings.accessToken]);

  useEffect(() => {
    if (!(settings.accessToken ?? "").trim() || !sessionKey.trim()) {
      setLiveConversationState("idle");
      return NOOP_CLEANUP;
    }
    let active = true;
    setLiveConversationState("subscribing");
    void setSessionEventsSubscription({
      sessionKey: sessionKey.trim(),
      action: "subscribe",
    })
      .then(() => {
        if (active) {
          setLiveConversationState("ready");
          setError("");
        }
      })
      .catch((err) => {
        if (active) {
          setLiveConversationState("idle");
          setError(err instanceof Error ? err.message : "failed to subscribe live session events");
        }
      });
    return () => {
      active = false;
      void setSessionEventsSubscription({
        sessionKey: sessionKey.trim(),
        action: "unsubscribe",
      }).catch(() => {});
    };
  }, [sessionKey, settings.accessToken]);

  useEffect(() => {
    const latestEvent = events[0];
    if (!(settings.accessToken ?? "").trim() || !latestEvent || !sessionKey.trim()) {
      return;
    }
    const parsed = parseServerEvent(latestEvent);
    if (parsed.kind === "projection.gap") {
      setLiveTimeline((current) =>
        [`projection gap · ${parsed.payload.reason || "unknown"}`, ...current].slice(0, 8),
      );
      void hydrateSessionRead(sessionKey, agentId, { setLoading: false });
      return;
    }
    if (
      (parsed.kind === "session.message" ||
        parsed.kind === "session.tool" ||
        parsed.kind === "sessions.changed") &&
      parsed.payload.sessionKey === sessionKey
    ) {
      setLiveTimeline((current) => [summarizeServerEvent(latestEvent), ...current].slice(0, 8));
      if (parsed.kind === "session.message") {
        applyLiveMessage(parsed.payload);
        setLiveConversationState("ready");
      } else if (parsed.kind === "session.tool") {
        setToolProgressEntries((current) => upsertToolProgressEntry(current, parsed.payload));
        setLiveConversationState("ready");
      }
      if (parsed.kind === "session.tool") {
        void hydrateSessionRead(sessionKey, agentId, { setLoading: false });
      }
    }
    if (parsed.kind === "sessions.changed") {
      applySessionChange(parsed.payload);
      void refreshInventory();
    }
  }, [agentId, events, sessionKey, settings.accessToken]);

  const sessionsList = sessions?.sessions ?? [];
  const agentTabs = getAgentTabs(sessionsList);
  const visibleSessions =
    selectedAgentTab === "all"
      ? sessionsList
      : sessionsList.filter((session) => session.agentId === selectedAgentTab);
  const previewList = sessionPreviews?.previews ?? [];
  const runtimeLabel = runtimeStatus?.runtime.status || "idle";
  const sessionCount = sessionsList.length;
  const previewCount = previewList.length;
  const eventCount = events.length + logEvents.length;
  const selectedSessionMeta =
    sessionsList.find((session) => session.key === sessionKey) ??
    sessionDetail?.session ??
    snapshot?.session;
  const filteredDetail = sessionDetail
    ? {
        ...sessionDetail,
        messages: filterMessages(sessionDetail.messages ?? [], transcriptQuery, transcriptFilter),
      }
    : null;
  const filteredSnapshot = snapshot
    ? {
        ...snapshot,
        messages: filterMessages(snapshot.messages ?? [], transcriptQuery, transcriptFilter),
      }
    : null;
  const filteredHistory = history
    ? {
        ...history,
        messages: filterMessages(history.messages ?? [], transcriptQuery, transcriptFilter),
      }
    : null;
  const shellStatusLabel = bootstrap?.gateway?.connected ? "Gateway linked" : "Gateway pending";
  const shellStatusTone = bootstrap?.gateway?.connected ? "is-positive" : "is-muted";
  const activeRuntimeUrl = runtimeStatus?.runtime.gatewayUrl || "(not resolved)";
  const gatewayScopeWarning = bootstrap?.gateway?.error || "";
  const transcriptVisibleCount =
    filteredDetail?.messages.length ??
    filteredSnapshot?.messages.length ??
    filteredHistory?.messages?.length ??
    0;

  if (authRequired) {
    return (
      <main className="deckgo-shell">
        <section className="deckgo-status-band">
          <div className="deckgo-status-copy">
            <p className="deckgo-kicker">deck-go access gate</p>
            <h1 className="deckgo-title">Unlock control plane</h1>
            <p className="deckgo-subtitle">
              The product shell can load without API access, but chat/session control requires the
              configured deck-go access token. Enter it once to restore the live control path.
            </p>
          </div>
        </section>

        <section className="deckgo-grid">
          <div className="deckgo-column" />
          <section className="deckgo-column">
            <section className="deckgo-card is-float">
              <div className="deckgo-card-header">
                <h2 className="deckgo-card-title">Authentication required</h2>
              </div>
              <p className="deckgo-card-subtitle">{authMessage}</p>
              <div className="deckgo-card-body deckgo-form-grid">
                <label className="deckgo-label">
                  <span>Deck access token</span>
                  <input
                    className="deckgo-input"
                    type="password"
                    value={authTokenInput}
                    onChange={(e) => setAuthTokenInput(e.target.value)}
                    placeholder="Enter deck-go access token"
                  />
                </label>
                <div className="deckgo-actions">
                  <button
                    className="deckgo-button is-primary"
                    type="button"
                    onClick={() => void onUnlockControlPlane()}
                  >
                    Unlock control plane
                  </button>
                </div>
              </div>
            </section>
          </section>
          <div className="deckgo-column" />
        </section>
      </main>
    );
  }

  return (
    <main className="deckgo-shell">
      <header className="deckgo-header">
        <div className="deckgo-hero">
          <p className="deckgo-kicker">Phase 3 workflow migration</p>
          <h1 className="deckgo-title">deck-go chat shell</h1>
          <p className="deckgo-subtitle">
            Browse/select/read and the first live conversation path now move onto the deck-go-owned
            product surface. This shell keeps the migration bounded while wiring session
            subscription and continuity-aware read refresh into the real product path.
          </p>
        </div>
        <div className="deckgo-theme-toggle" aria-label="Theme switch">
          <button
            type="button"
            className={themeMode === "dark" ? "is-active" : ""}
            onClick={() => setThemeMode("dark")}
          >
            Dark
          </button>
          <button
            type="button"
            className={themeMode === "light" ? "is-active" : ""}
            onClick={() => setThemeMode("light")}
          >
            Light
          </button>
        </div>
      </header>

      <section className="deckgo-stats" aria-label="Shell summary">
        <ShellStat label="Runtime" value={runtimeLabel} />
        <ShellStat label="Sessions" value={sessionCount} />
        <ShellStat label="Previews" value={previewCount} />
        <ShellStat label="Event feed" value={eventCount} />
      </section>

      <section className="deckgo-status-band" aria-label="Shell control strip">
        <div className="deckgo-status-copy">
          <p className="deckgo-kicker">Control-plane posture</p>
          <h2 className="deckgo-card-title">3A + 3B in progress</h2>
          <p className="deckgo-note">
            Session navigation now drives the read path, and send/abort/session-subscribe are moving
            onto the same deck-go-owned shell without pulling in later approval or artifact/canvas
            migrations.
          </p>
        </div>
        <div className="deckgo-status-actions">
          <div className="deckgo-tab-strip" aria-label="Agent tabs">
            <button
              type="button"
              className={`deckgo-tab ${selectedAgentTab === "all" ? "is-active" : ""}`}
              onClick={() => {
                setSelectedAgentTab("all");
                setAgentId("");
              }}
            >
              AgentTabs · All
            </button>
            {agentTabs.map((agentTab) => (
              <button
                key={agentTab}
                type="button"
                className={`deckgo-tab ${selectedAgentTab === agentTab ? "is-active" : ""}`}
                onClick={() => {
                  setSelectedAgentTab(agentTab);
                  setAgentId(agentTab);
                }}
              >
                AgentTabs · {agentTab}
              </button>
            ))}
          </div>
          <div className="deckgo-pill-row">
            <span className={`deckgo-pill ${shellStatusTone}`}>{shellStatusLabel}</span>
            <span className="deckgo-pill">Runtime {runtimeLabel}</span>
            <span className="deckgo-pill">Stream {serverStreamState}</span>
            <span className="deckgo-pill">Visible transcript {transcriptVisibleCount}</span>
            <span className="deckgo-pill">
              Selected agent {selectedAgentTab === "all" ? "all" : selectedAgentTab}
            </span>
            <span className="deckgo-pill">Selected session {sessionKey || "(none)"}</span>
          </div>
          {gatewayScopeWarning ? (
            <div className="deckgo-pill-row">
              <span className="deckgo-pill is-danger">Gateway scope warning</span>
              <span className="deckgo-pill">{gatewayScopeWarning}</span>
            </div>
          ) : null}
        </div>
      </section>

      <div className="deckgo-grid">
        <aside className="deckgo-column">
          <section className="deckgo-card">
            <div className="deckgo-card-header">
              <h2 className="deckgo-card-title">Shell redlines</h2>
            </div>
            <p className="deckgo-card-subtitle">
              Phase 2 preserves the capability map while the shell is redesigned.
            </p>
            <div className="deckgo-card-body">
              <div className="deckgo-pill-row">
                <span className="deckgo-pill is-primary">AgentTabs</span>
                <span className="deckgo-pill">Abort control</span>
                <span className="deckgo-pill">Approval surface</span>
                <span className="deckgo-pill">Tool progress</span>
                <span className="deckgo-pill">Context bar</span>
                <span className="deckgo-pill">Session config</span>
                <span className="deckgo-pill">Search / filter</span>
                <span className="deckgo-pill">Artifact entry</span>
                <span className="deckgo-pill">Canvas entry</span>
              </div>
            </div>
          </section>

          <section className="deckgo-card">
            <div className="deckgo-card-header">
              <h2 className="deckgo-card-title">Session browser</h2>
            </div>
            <p className="deckgo-card-subtitle">
              Session list, preview overlays, and agent selection now drive the actual 3A read path
              instead of a manual workbench flow.
            </p>
            <div className="deckgo-card-body deckgo-dividerless">
              <div>
                <p className="deckgo-kicker" style={{ marginBottom: 8 }}>
                  Sessions {inventoryState === "loading" ? "· loading" : ""}
                </p>
                {visibleSessions.length === 0 ? (
                  <p className="deckgo-note">No sessions loaded.</p>
                ) : (
                  <SessionListCard
                    sessions={visibleSessions}
                    selectedKey={sessionKey}
                    onSelect={onSelectSession}
                  />
                )}
              </div>

              <div>
                <p className="deckgo-kicker" style={{ marginBottom: 8 }}>
                  Preview overlays
                </p>
                {previewList.length === 0 ? (
                  <p className="deckgo-note">No previews loaded.</p>
                ) : (
                  <SessionPreviewCard
                    previews={previewList}
                    selectedKey={sessionKey}
                    onSelect={(preview) => {
                      const matchedSession = sessionsList.find(
                        (session) => session.key === preview.key,
                      );
                      if (matchedSession) {
                        onSelectSession(matchedSession);
                        return;
                      }
                      setSessionKey(preview.key);
                    }}
                  />
                )}
              </div>
            </div>
          </section>

          <section className="deckgo-card">
            <div className="deckgo-card-header">
              <h2 className="deckgo-card-title">Context + session config</h2>
            </div>
            <p className="deckgo-card-subtitle">
              Keep context bar and session configuration explicit in the shell even before workflow
              migration finishes.
            </p>
            <div className="deckgo-card-body deckgo-form-grid">
              <div className="deckgo-pill-row">
                <span className="deckgo-pill is-primary">Context bar</span>
                <span className="deckgo-pill">Session config</span>
              </div>
              <div className="deckgo-form-row">
                <label className="deckgo-label">
                  <span>Agent ID</span>
                  <input
                    className="deckgo-input"
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                  />
                </label>
                <label className="deckgo-label">
                  <span>Session key</span>
                  <input
                    className="deckgo-input"
                    value={sessionKey}
                    onChange={(e) => setSessionKey(e.target.value)}
                  />
                </label>
                <label className="deckgo-label">
                  <span>Config path</span>
                  <input
                    className="deckgo-input"
                    value={configPath}
                    onChange={(e) => setConfigPath(e.target.value)}
                  />
                </label>
                <label className="deckgo-label">
                  <span>Model override</span>
                  <input
                    className="deckgo-input"
                    value={requestedModel}
                    onChange={(e) => setRequestedModel(e.target.value)}
                    placeholder="cpa/gpt-5.4"
                  />
                </label>
              </div>
              <div className="deckgo-surface-grid">
                <article className="deckgo-surface-tile">
                  <p className="deckgo-surface-label">Selected session</p>
                  <strong>{selectedSessionMeta?.title || sessionKey || "No active session"}</strong>
                  <p className="deckgo-note">
                    {selectedSessionMeta?.agentId
                      ? `Agent ${selectedSessionMeta.agentId}`
                      : "Session metadata will appear here once selected."}
                  </p>
                </article>
                <article className="deckgo-surface-tile">
                  <p className="deckgo-surface-label">Config seam</p>
                  <strong>{configPath || "No schema path queued"}</strong>
                  <p className="deckgo-note">
                    Use schema lookup from the operator rail to inspect the Go-owned config seam.
                  </p>
                </article>
                <article className="deckgo-surface-tile">
                  <p className="deckgo-surface-label">Requested model</p>
                  <strong>{requestedModel || "default runtime model"}</strong>
                  <p className="deckgo-note">
                    New sessions and explicit model patches will use this provider/model path.
                  </p>
                </article>
              </div>
            </div>
          </section>
        </aside>

        <section className="deckgo-column">
          <section className="deckgo-card is-float">
            <div className="deckgo-card-header">
              <h2 className="deckgo-card-title">Composer + control strip</h2>
            </div>
            <p className="deckgo-card-subtitle">
              The shell keeps command, session, and runtime controls explicit while Phase 3 handles
              deeper workflow migration.
            </p>
            <div className="deckgo-card-body deckgo-form-grid">
              <div className="deckgo-hero-strip">
                <div>
                  <p className="deckgo-surface-label">Command center</p>
                  <strong>
                    {selectedAgentTab === "all"
                      ? "All-session control surface"
                      : `Agent-scoped control · ${selectedAgentTab}`}
                  </strong>
                </div>
                <div className="deckgo-pill-row">
                  <span className="deckgo-pill is-primary">Abort</span>
                  <span
                    className={`deckgo-pill ${liveConversationState === "ready" ? "is-positive" : "is-muted"}`}
                  >
                    Live path {liveConversationState}
                  </span>
                  <span className="deckgo-pill">Approval</span>
                  <span className="deckgo-pill">Tool progress</span>
                </div>
              </div>

              <label className="deckgo-label">
                <span>Deck access token</span>
                <input
                  className="deckgo-input"
                  value={settings.accessToken}
                  onChange={(e) =>
                    setSettings((current) => ({ ...current, accessToken: e.target.value }))
                  }
                />
              </label>

              <div className="deckgo-form-row">
                <label className="deckgo-label">
                  <span>Managed Gateway command</span>
                  <input
                    className="deckgo-input"
                    value={settings.managedGateway?.command ?? ""}
                    onChange={(e) => updateManagedGateway({ command: e.target.value })}
                  />
                </label>
                <label className="deckgo-label">
                  <span>Working dir</span>
                  <input
                    className="deckgo-input"
                    value={settings.managedGateway?.workingDir ?? ""}
                    onChange={(e) => updateManagedGateway({ workingDir: e.target.value })}
                  />
                </label>
                <label className="deckgo-label">
                  <span>Gateway token</span>
                  <input
                    className="deckgo-input"
                    value={settings.managedGateway?.gatewayToken ?? ""}
                    onChange={(e) => updateManagedGateway({ gatewayToken: e.target.value })}
                  />
                </label>
              </div>

              <div className="deckgo-form-row">
                <label className="deckgo-label">
                  <span>Bind host</span>
                  <input
                    className="deckgo-input"
                    value={settings.managedGateway?.bindHost ?? ""}
                    onChange={(e) => updateManagedGateway({ bindHost: e.target.value })}
                  />
                </label>
                <label className="deckgo-label">
                  <span>Bind port</span>
                  <input
                    className="deckgo-input"
                    type="number"
                    value={settings.managedGateway?.bindPort ?? 18789}
                    onChange={(e) =>
                      updateManagedGateway({ bindPort: Number(e.target.value) || 18789 })
                    }
                  />
                </label>
                <label className="deckgo-label">
                  <span>Runtime endpoint</span>
                  <input className="deckgo-input" value={activeRuntimeUrl} readOnly />
                </label>
              </div>

              <label className="deckgo-label">
                <span>Message</span>
                <textarea
                  className="deckgo-textarea"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </label>

              <div className="deckgo-pill-row">
                <span className="deckgo-pill">Context bar</span>
                <span className="deckgo-pill">Session config</span>
                <span className="deckgo-pill">Tool progress</span>
                <span className="deckgo-pill">Approval</span>
                <span className="deckgo-pill">Artifact</span>
                <span className="deckgo-pill">Canvas</span>
                <span className="deckgo-pill">Search</span>
                <span className="deckgo-pill">Filter</span>
                <span className="deckgo-pill">Session events</span>
              </div>

              <div className="deckgo-actions">
                <button className="deckgo-button is-primary" type="button" onClick={onSave}>
                  {saving ? "Saving..." : "Save settings"}
                </button>
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void refreshBootstrap()}
                >
                  Refresh bootstrap
                </button>
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void refreshInventory()}
                >
                  Refresh inventory
                </button>
                <button
                  className="deckgo-button is-primary"
                  type="button"
                  onClick={() => void onCreateSession()}
                >
                  Create session
                </button>
                <button
                  className="deckgo-button is-primary"
                  type="button"
                  onClick={() => void onSendMessage()}
                >
                  Send message
                </button>
                <button
                  className="deckgo-button is-danger"
                  type="button"
                  onClick={() => void onAbortRun()}
                >
                  Abort run
                </button>
              </div>
              <p className="deckgo-note">Settings file: {settingsPath || "(not loaded yet)"}</p>
            </div>
          </section>

          <section className="deckgo-card">
            <div className="deckgo-card-header">
              <h2 className="deckgo-card-title">Transcript shell</h2>
            </div>
            <p className="deckgo-card-subtitle">
              Selecting a session now automatically hydrates detail, snapshot alias, and history
              seam from deck-go-owned read contracts.
            </p>
            <div className="deckgo-card-body deckgo-dividerless">
              <div className="deckgo-toolbar">
                <label className="deckgo-label">
                  <span>Transcript search</span>
                  <input
                    className="deckgo-input"
                    value={transcriptQuery}
                    onChange={(e) => setTranscriptQuery(e.target.value)}
                    placeholder="Search ids, roles, content"
                  />
                </label>
                <label className="deckgo-label">
                  <span>Filter</span>
                  <select
                    className="deckgo-input"
                    value={transcriptFilter}
                    onChange={(e) => setTranscriptFilter(e.target.value as TranscriptFilter)}
                  >
                    <option value="all">All roles</option>
                    <option value="user">User</option>
                    <option value="assistant">Assistant</option>
                    <option value="tool">Tool</option>
                  </select>
                </label>
                <label className="deckgo-label">
                  <span>Run ID</span>
                  <input
                    className="deckgo-input"
                    value={runId}
                    onChange={(e) => setRunId(e.target.value)}
                  />
                </label>
                <label className="deckgo-label">
                  <span>Channel ID</span>
                  <input
                    className="deckgo-input"
                    value={channelId}
                    onChange={(e) => setChannelId(e.target.value)}
                  />
                </label>
              </div>

              <div className="deckgo-actions">
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void refreshSessionDetail()}
                >
                  Refresh detail
                </button>
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void refreshSnapshot()}
                >
                  Refresh snapshot
                </button>
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void refreshHistory()}
                >
                  Refresh history
                </button>
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void onPreviewSession()}
                >
                  Preview
                </button>
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void onResetSession()}
                >
                  Reset
                </button>
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void onClearSession()}
                >
                  Clear
                </button>
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void onPatchSession()}
                >
                  Patch
                </button>
              </div>

              <div className="deckgo-pill-row">
                <span
                  className={`deckgo-pill ${sessionReadState === "ready" ? "is-positive" : "is-muted"}`}
                >
                  Read lane {sessionReadState}
                </span>
                <span
                  className={`deckgo-pill ${liveConversationState === "ready" ? "is-positive" : "is-muted"}`}
                >
                  Live lane {liveConversationState}
                </span>
                <span className="deckgo-pill">
                  Detail {sessionDetail?.session?.key ? "loaded" : "pending"}
                </span>
                <span className="deckgo-pill">
                  Snapshot {snapshot?.session?.key ? "loaded" : "pending"}
                </span>
                <span className="deckgo-pill">
                  History{" "}
                  {history?.messages?.length ? `${history.messages.length} msgs` : "pending"}
                </span>
              </div>

              {continuityState.lastProjectionGapReason ? (
                <div className="deckgo-surface-tile">
                  <p className="deckgo-surface-label">Continuity notice</p>
                  <strong>projection.gap recovered</strong>
                  <p className="deckgo-note">
                    Reason: {continuityState.lastProjectionGapReason}. The shell rehydrates the
                    selected session after a stream gap to preserve the read path.
                  </p>
                </div>
              ) : null}

              <div className="deckgo-surface-tile">
                <p className="deckgo-surface-label">Live event tape</p>
                {liveTimeline.length === 0 ? (
                  <p className="deckgo-note">No live session events captured yet.</p>
                ) : (
                  <ul className="deckgo-shell-list">
                    {liveTimeline.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>

              <SessionDetailCard
                detail={filteredDetail}
                snapshot={filteredSnapshot}
                history={filteredHistory}
              />
            </div>
          </section>
        </section>

        <aside className="deckgo-column">
          <section className="deckgo-card is-float">
            <div className="deckgo-card-header">
              <h2 className="deckgo-card-title">Runtime + continuity</h2>
            </div>
            <p className="deckgo-card-subtitle">
              Bootstrap, continuity, session events, auxiliary surfaces, and raw diagnostics remain
              explicit shell regions.
            </p>
            <div className="deckgo-card-body deckgo-dividerless">
              <div className="deckgo-pill-row">
                <span className="deckgo-pill is-primary">Runtime {runtimeLabel}</span>
                <span className="deckgo-pill">Stream {serverStreamState}</span>
                <span className="deckgo-pill">Logs {logStreamState}</span>
                <span className="deckgo-pill">
                  Session events {continuityState.sessionEventCount}
                </span>
                <span className="deckgo-pill">Gaps {continuityState.projectionGapCount}</span>
              </div>

              {gatewayScopeWarning ? (
                <div className="deckgo-surface-tile">
                  <p className="deckgo-surface-label">Gateway scope warning</p>
                  <strong>Connected runtime, limited operator scopes</strong>
                  <p className="deckgo-note">
                    {gatewayScopeWarning}. This explains why runtime-backed chat actions can stay
                    blocked even while the managed Gateway is `running/healthy`.
                  </p>
                </div>
              ) : null}

              <div className="deckgo-actions">
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void onStartGateway()}
                >
                  Start gateway
                </button>
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void onRestartGateway()}
                >
                  Restart gateway
                </button>
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void onStopGateway()}
                >
                  Stop gateway
                </button>
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void onLookupSchema()}
                >
                  Lookup schema
                </button>
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void onLogoutChannel()}
                >
                  Logout channel
                </button>
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void onSubscribeSessionEvents()}
                >
                  Subscribe session
                </button>
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void onUnsubscribeSessionEvents()}
                >
                  Unsubscribe session
                </button>
              </div>

              <div className="deckgo-surface-grid">
                <article className="deckgo-surface-tile">
                  <p className="deckgo-surface-label">Approval surface</p>
                  <strong>Awaiting migration</strong>
                  <p className="deckgo-note">
                    The shell keeps a visible approval slot so Phase 3 can attach approval flows
                    without rediscovering the right rail.
                  </p>
                </article>
                <article className="deckgo-surface-tile">
                  <p className="deckgo-surface-label">Tool progress / run status</p>
                  <strong>
                    {toolProgressEntries.length > 0
                      ? `${toolProgressEntries[0].label} · ${toolProgressEntries[0].phase}`
                      : runId
                        ? `Run ${runId.slice(0, 8)} · ${liveConversationState}`
                        : "No recent action"}
                  </strong>
                  {toolProgressEntries.length > 0 ? (
                    <ul className="deckgo-shell-list" style={{ marginTop: 12 }}>
                      {toolProgressEntries.map((entry) => (
                        <li key={`${entry.runId}-${entry.label}`}>
                          <strong>{entry.label}</strong>
                          <div className="deckgo-meta">
                            phase: {entry.phase} | run: {entry.runId.slice(0, 8)} | ts: {entry.ts}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="deckgo-note">
                      Run control stays visible here even while detailed progress projections remain
                      shallow.
                    </p>
                  )}
                </article>
                <article className="deckgo-surface-tile">
                  <p className="deckgo-surface-label">Artifact panel entry</p>
                  <strong>
                    {selectedAgentTab === "artifacts"
                      ? "Artifact tab armed"
                      : "Artifact slot ready"}
                  </strong>
                  <p className="deckgo-note">
                    Artifact views will migrate onto this surface without changing the shell map.
                  </p>
                </article>
                <article className="deckgo-surface-tile">
                  <p className="deckgo-surface-label">Canvas / A2UI entry</p>
                  <strong>Canvas handoff preserved</strong>
                  <p className="deckgo-note">
                    Canvas stays discoverable from the right rail even before its detailed
                    interaction model lands.
                  </p>
                </article>
              </div>

              <div className="deckgo-card">
                <div className="deckgo-card-header">
                  <h3 className="deckgo-card-title">Continuity state</h3>
                </div>
                <div className="deckgo-card-body">
                  <p className="deckgo-note">
                    lastEventId: {continuityState.lastEventId || "(none)"}
                  </p>
                  <p className="deckgo-note">
                    projectionGapCount: {continuityState.projectionGapCount}
                  </p>
                  <p className="deckgo-note">
                    lastProjectionGapReason: {continuityState.lastProjectionGapReason || "(none)"}
                  </p>
                  <p className="deckgo-note">
                    sessionEventCount: {continuityState.sessionEventCount}
                  </p>
                  <p className="deckgo-note">
                    lastSessionEventKind: {continuityState.lastSessionEventKind || "(none)"}
                  </p>
                </div>
              </div>

              <div className="deckgo-card">
                <div className="deckgo-card-header">
                  <h3 className="deckgo-card-title">Stream events</h3>
                </div>
                <div className="deckgo-card-body">
                  {events.length === 0 ? (
                    <p className="deckgo-note">No stream events</p>
                  ) : (
                    <EventFeedCard title="Stream events" events={events} kind="server" />
                  )}
                </div>
              </div>

              <div className="deckgo-card">
                <div className="deckgo-card-header">
                  <h3 className="deckgo-card-title">Log events</h3>
                </div>
                <div className="deckgo-card-body">
                  {logEvents.length === 0 ? (
                    <p className="deckgo-note">No log events</p>
                  ) : (
                    <EventFeedCard title="Log events" events={logEvents} kind="log" />
                  )}
                </div>
              </div>

              <div className="deckgo-card">
                <div className="deckgo-card-header">
                  <h3 className="deckgo-card-title">Operator diagnostics</h3>
                </div>
                <div className="deckgo-card-body deckgo-dividerless">
                  {bootstrap ? <JsonDetails title="Bootstrap status" payload={bootstrap} /> : null}
                  {runtimeStatus ? (
                    <JsonDetails title="Runtime status" payload={runtimeStatus} />
                  ) : null}
                  {channels ? <JsonDetails title="Channels" payload={channels} /> : null}
                  {plugins ? <JsonDetails title="Plugins" payload={plugins} /> : null}
                  {schemaLookup ? (
                    <JsonDetails title="Schema lookup" payload={schemaLookup} />
                  ) : null}
                  {chatActionResult ? (
                    <JsonDetails title="Action result" payload={chatActionResult} />
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {error ? (
        <pre className="deckgo-code" style={{ marginTop: 24 }}>
          {error}
        </pre>
      ) : null}
    </main>
  );
}
