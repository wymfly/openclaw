// Main app shell — three-column chat layout.
const { useState: useStateA, useEffect: useEffectA, useMemo: useMemoA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
  theme: "dark",
  density: "comfortable",
  userAlign: "right",
  toolStyle: "paired",
  rightPanel: "canvas",
  canvasState: "ready",
  artifactKind: "code",
  sseStatus: "connected",
  contextPct: 64,
  model: "claude-sonnet-4.6",
  reasoning: "high",
  fastMode: false,
  streamingState: "streaming",
  showApproval: false,
  showSearch: false,
  showSubagentTree: false,
  sidebarCollapsed: false,
  showWaiting: false,
  demoAttach: false,
  fontScale: 100,
  view: "prototype",
} /*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [activeKey, setActiveKey] = useStateA("s1");
  const [rightWidth, setRightWidth] = useStateA(480);
  const [blockPrefs, setBlockPrefs] = useStateA({
    thinking: true,
    toolUse: true,
    toolResult: true,
  });
  const [transcript, setTranscript] = useStateA(window.MOCK.transcript);
  const [waitingFrame, setWaitingFrame] = useStateA(0);

  // Apply theme + density
  useEffectA(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme);
    document.documentElement.setAttribute("data-density", tweaks.density);
    document.documentElement.style.setProperty("--fs-body", (13.5 * tweaks.fontScale) / 100 + "px");
  }, [tweaks.theme, tweaks.density, tweaks.fontScale]);

  // Resize handler for right panel
  const onResize = (e) => {
    const startX = e.clientX;
    const startW = rightWidth;
    const move = (ev) =>
      setRightWidth(Math.max(320, Math.min(800, startW + (startX - ev.clientX))));
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  // Switch to canvas view
  if (tweaks.view === "matrix") {
    return <StateMatrixView tweaks={tweaks} setTweak={setTweak} />;
  }

  const runningTools = transcript.flatMap(
    (m) =>
      m.blocks
        ?.filter((b) => b.type === "tool_use" && b.status === "running")
        .map((b) => ({ tool: b.tool, summary: formatRunningSummary(b) })) || [],
  );

  return (
    <div className="app-shell">
      <Sidebar
        collapsed={tweaks.sidebarCollapsed}
        sessions={window.MOCK.sessions}
        activeKey={activeKey}
        onPick={setActiveKey}
        onNew={() => {}}
        density={tweaks.density}
      />

      <main className="main-col">
        <SSEBanner status={tweaks.sseStatus} />
        <ChatContextBar tweaks={tweaks} />
        {tweaks.showSearch && (
          <TranscriptSearch
            open={tweaks.showSearch}
            onClose={() => setTweak("showSearch", false)}
          />
        )}

        <div className="transcript scroll-y">
          {transcript.map((m, i) => (
            <MessageBubble
              key={m.id}
              m={m}
              alignment={tweaks.userAlign}
              prefs={blockPrefs}
              toolStyle={tweaks.toolStyle}
            />
          ))}
          {tweaks.showSubagentTree && <SubagentTree tree={window.MOCK.subagentTree} />}
          {tweaks.showWaiting && <WaitingPlaceholder />}
        </div>

        <BlockFilterBar prefs={blockPrefs} setPrefs={setBlockPrefs} />
        <ToolProgressBar running={runningTools} />

        <div className="composer-zone">
          <Composer tweaks={tweaks} onSend={() => {}} />
        </div>
      </main>

      <RightPanel
        mode={tweaks.rightPanel}
        width={rightWidth}
        onClose={() => setTweak("rightPanel", "hidden")}
        onResize={onResize}
        canvasState={tweaks.canvasState}
        artifactKind={tweaks.artifactKind}
      />

      <TweaksUI tweaks={tweaks} setTweak={setTweak} />
    </div>
  );
}

function formatRunningSummary(b) {
  if (b.input?.command) {
    return b.input.command;
  }
  if (b.input?.path) {
    return b.input.path;
  }
  return "";
}

// ---------------- Tweaks UI ----------------
function TweaksUI({ tweaks, setTweak }) {
  return (
    <TweaksPanel title="Tweaks · deck-go chat">
      <TweakSection title="View">
        <TweakRadio
          label="Mode"
          value={tweaks.view}
          onChange={(v) => setTweak("view", v)}
          options={[
            { value: "prototype", label: "Prototype" },
            { value: "matrix", label: "State matrix" },
          ]}
        />
      </TweakSection>
      <TweakSection title="Theme & density">
        <TweakRadio
          label="Theme"
          value={tweaks.theme}
          onChange={(v) => setTweak("theme", v)}
          options={[
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
          ]}
        />
        <TweakRadio
          label="Density"
          value={tweaks.density}
          onChange={(v) => setTweak("density", v)}
          options={[
            { value: "comfortable", label: "Comfortable" },
            { value: "compact", label: "Compact" },
          ]}
        />
        <TweakSlider
          label="Font scale"
          value={tweaks.fontScale}
          onChange={(v) => setTweak("fontScale", v)}
          min={85}
          max={120}
          step={5}
          unit="%"
        />
      </TweakSection>
      <TweakSection title="Layout">
        <TweakRadio
          label="User msg align"
          value={tweaks.userAlign}
          onChange={(v) => setTweak("userAlign", v)}
          options={[
            { value: "left", label: "Left" },
            { value: "right", label: "Right" },
            { value: "center", label: "Center" },
          ]}
        />
        <TweakRadio
          label="Tool card"
          value={tweaks.toolStyle}
          onChange={(v) => setTweak("toolStyle", v)}
          options={[
            { value: "paired", label: "Paired" },
            { value: "split", label: "Split" },
          ]}
        />
        <TweakToggle
          label="Sidebar collapsed"
          value={tweaks.sidebarCollapsed}
          onChange={(v) => setTweak("sidebarCollapsed", v)}
        />
      </TweakSection>
      <TweakSection title="Right panel">
        <TweakRadio
          label="Mode"
          value={tweaks.rightPanel}
          onChange={(v) => setTweak("rightPanel", v)}
          options={[
            { value: "hidden", label: "Hidden" },
            { value: "canvas", label: "Canvas" },
            { value: "artifact", label: "Artifact" },
          ]}
        />
        <TweakRadio
          label="Canvas state"
          value={tweaks.canvasState}
          onChange={(v) => setTweak("canvasState", v)}
          options={[
            { value: "loading", label: "Loading" },
            { value: "ready", label: "Ready" },
            { value: "error", label: "Error" },
            { value: "empty", label: "Empty" },
          ]}
        />
        <TweakSelect
          label="Artifact medium"
          value={tweaks.artifactKind}
          onChange={(v) => setTweak("artifactKind", v)}
          options={[
            { value: "code", label: "Code" },
            { value: "markdown", label: "Markdown" },
            { value: "json", label: "JSON" },
            { value: "table", label: "Table" },
            { value: "html", label: "HTML" },
          ]}
        />
      </TweakSection>
      <TweakSection title="Status & flow">
        <TweakRadio
          label="SSE"
          value={tweaks.sseStatus}
          onChange={(v) => setTweak("sseStatus", v)}
          options={[
            { value: "connected", label: "OK" },
            { value: "reconnecting", label: "Reconnect" },
            { value: "disconnected", label: "Down" },
          ]}
        />
        <TweakSlider
          label="Context %"
          value={tweaks.contextPct}
          onChange={(v) => setTweak("contextPct", v)}
          min={0}
          max={100}
          step={5}
          unit="%"
        />
        <TweakRadio
          label="Stream"
          value={tweaks.streamingState}
          onChange={(v) => setTweak("streamingState", v)}
          options={[
            { value: "idle", label: "Idle" },
            { value: "streaming", label: "Streaming" },
          ]}
        />
        <TweakToggle
          label="Fast mode"
          value={tweaks.fastMode}
          onChange={(v) => setTweak("fastMode", v)}
        />
      </TweakSection>
      <TweakSection title="Overlays">
        <TweakToggle
          label="Approval dialog"
          value={tweaks.showApproval}
          onChange={(v) => setTweak("showApproval", v)}
        />
        <TweakToggle
          label="Cmd-F search"
          value={tweaks.showSearch}
          onChange={(v) => setTweak("showSearch", v)}
        />
        <TweakToggle
          label="Subagent tree"
          value={tweaks.showSubagentTree}
          onChange={(v) => setTweak("showSubagentTree", v)}
        />
        <TweakToggle
          label="Waiting placeholder"
          value={tweaks.showWaiting}
          onChange={(v) => setTweak("showWaiting", v)}
        />
        <TweakToggle
          label="Composer attachments"
          value={tweaks.demoAttach}
          onChange={(v) => setTweak("demoAttach", v)}
        />
      </TweakSection>
    </TweaksPanel>
  );
}

// ---------------- State Matrix View ----------------
function StateMatrixView({ tweaks, setTweak }) {
  return (
    <div className="matrix-shell" style={{ height: "100vh", overflow: "hidden" }}>
      <DesignCanvas title="deck-go chat — state matrix" defaultZoom={0.5}>
        <DCSection id="bands" title="Top bands · 9 states">
          <DCArtboard id="sse-ok" label="SSE connected" width={680} height={48}>
            <SSEFakeShell>
              <SSEBanner status="connected" />
            </SSEFakeShell>
          </DCArtboard>
          <DCArtboard id="sse-reconnect" label="SSE reconnecting" width={680} height={56}>
            <SSEFakeShell>
              <SSEBanner status="reconnecting" />
            </SSEFakeShell>
          </DCArtboard>
          <DCArtboard id="sse-down" label="SSE disconnected" width={680} height={56}>
            <SSEFakeShell>
              <SSEBanner status="disconnected" />
            </SSEFakeShell>
          </DCArtboard>
          <DCArtboard id="ctx-30" label="Context 30%" width={760} height={56}>
            <SSEFakeShell>
              <ChatContextBar tweaks={{ ...tweaks, contextPct: 30 }} />
            </SSEFakeShell>
          </DCArtboard>
          <DCArtboard id="ctx-72" label="Context 72%" width={760} height={56}>
            <SSEFakeShell>
              <ChatContextBar tweaks={{ ...tweaks, contextPct: 72 }} />
            </SSEFakeShell>
          </DCArtboard>
          <DCArtboard id="ctx-96" label="Context 96% (warn)" width={760} height={56}>
            <SSEFakeShell>
              <ChatContextBar tweaks={{ ...tweaks, contextPct: 96 }} />
            </SSEFakeShell>
          </DCArtboard>
          <DCArtboard id="search" label="Cmd-F search open" width={760} height={56}>
            <SSEFakeShell>
              <TranscriptSearch open={true} onClose={() => {}} />
            </SSEFakeShell>
          </DCArtboard>
          <DCArtboard id="filter-bar" label="Block filter bar" width={760} height={48}>
            <SSEFakeShell>
              <BlockFilterBar
                prefs={{ thinking: true, toolUse: true, toolResult: false }}
                setPrefs={() => {}}
              />
            </SSEFakeShell>
          </DCArtboard>
          <DCArtboard id="tool-progress" label="Tool progress" width={760} height={48}>
            <SSEFakeShell>
              <ToolProgressBar
                running={[
                  { tool: "shell_command", summary: "pnpm typecheck" },
                  { tool: "read_file", summary: "src/state/chat.ts" },
                ]}
              />
            </SSEFakeShell>
          </DCArtboard>
        </DCSection>

        <DCSection
          id="blocks"
          title="Block matrix · text / thinking / tool_use / tool_result / image / file / canvas / unknown"
        >
          <DCArtboard id="text-stream" label="text · streaming" width={520} height={150}>
            <BlockShell>
              <div className="md md-streaming">
                <p>
                  The user wants two things: a paired tool card and a refactor for{" "}
                  <code className="inline-code">MessageInput.tsx</code>
                  <span className="cursor-blink"></span>
                </p>
              </div>
            </BlockShell>
          </DCArtboard>
          <DCArtboard id="text-done" label="text · done (markdown)" width={520} height={210}>
            <BlockShell>
              <TextBlock
                text={
                  "Done. **Findings**:\n- Typecheck is clean.\n- `MessageInput.tsx` is 693 lines; extract `useComposerState`."
                }
              />
            </BlockShell>
          </DCArtboard>
          <DCArtboard id="think-collapsed" label="thinking · collapsed" width={520} height={56}>
            <BlockShell>
              <ThinkingBlock text="…" defaultExpanded={false} />
            </BlockShell>
          </DCArtboard>
          <DCArtboard id="think-expanded" label="thinking · expanded" width={520} height={170}>
            <BlockShell>
              <ThinkingBlock
                text={"Plan:\n1. Run typecheck\n2. Read MessageInput.tsx\n3. Propose refactor"}
                defaultExpanded={true}
              />
            </BlockShell>
          </DCArtboard>
          <DCArtboard id="think-stream" label="thinking · streaming" width={520} height={170}>
            <BlockShell>
              <ThinkingBlock
                text={"Plan:\n1. Run typecheck\n2. Read MessageInput.tsx"}
                streaming={true}
              />
            </BlockShell>
          </DCArtboard>
          <DCArtboard id="tu-running" label="tool_use · running" width={520} height={56}>
            <BlockShell>
              <ToolUseCard
                block={{
                  tool: "shell_command",
                  input: { command: "pnpm typecheck" },
                  status: "running",
                }}
              />
            </BlockShell>
          </DCArtboard>
          <DCArtboard id="tu-done" label="tool_use · completed" width={520} height={56}>
            <BlockShell>
              <ToolUseCard
                block={{
                  tool: "read_file",
                  input: { path: "panels/chat/MessageInput.tsx" },
                  status: "completed",
                }}
              />
            </BlockShell>
          </DCArtboard>
          <DCArtboard id="tr-bash" label="tool_result · bash" width={520} height={220}>
            <BlockShell>
              <ToolResultCard
                block={{
                  viewType: "bash",
                  bash: { exit: 0, stdout: "Found 0 errors.\nWatching for changes…", stderr: "" },
                }}
              />
            </BlockShell>
          </DCArtboard>
          <DCArtboard id="tr-bash-err" label="tool_result · bash error" width={520} height={240}>
            <BlockShell>
              <ToolResultCard
                block={{
                  viewType: "bash",
                  isError: true,
                  bash: {
                    exit: 1,
                    stdout: "",
                    stderr: "src/x.ts:12:5 - error TS2304: Cannot find name 'foo'.",
                  },
                }}
              />
            </BlockShell>
          </DCArtboard>
          <DCArtboard id="tr-read" label="tool_result · read" width={520} height={220}>
            <BlockShell>
              <ToolResultCard
                block={{
                  viewType: "read",
                  read: {
                    lang: "tsx",
                    path: "x.tsx",
                    lines: [
                      "import { useState } from 'react';",
                      "",
                      "export function X() {",
                      "  const [v, set] = useState(0);",
                      "  return <div>{v}</div>;",
                      "}",
                    ],
                  },
                }}
              />
            </BlockShell>
          </DCArtboard>
          <DCArtboard id="tr-diff" label="tool_result · diff" width={520} height={240}>
            <BlockShell>
              <ToolResultCard
                block={{
                  viewType: "diff",
                  diff: {
                    path: "ToolPair.tsx",
                    added: 5,
                    removed: 2,
                    hunks: [
                      { kind: "del", line: "<ToolUse/>" },
                      { kind: "del", line: "<ToolResult/>" },
                      { kind: "add", line: "<ToolPair use={u} result={r}/>" },
                      { kind: "ctx", line: "" },
                      { kind: "add", line: "// merged" },
                    ],
                  },
                }}
              />
            </BlockShell>
          </DCArtboard>
          <DCArtboard id="tr-raw" label="tool_result · raw" width={520} height={220}>
            <BlockShell>
              <ToolResultCard block={{ viewType: "raw" }} />
            </BlockShell>
          </DCArtboard>
          <DCArtboard id="file" label="file block" width={520} height={56}>
            <BlockShell>
              <FileBlock name="trace.har" size="412 KB" />
            </BlockShell>
          </DCArtboard>
          <DCArtboard id="canvas-inline" label="canvas inline" width={520} height={170}>
            <BlockShell>
              <CanvasInline title="canvas-empty preview" />
            </BlockShell>
          </DCArtboard>
          <DCArtboard id="unknown" label="unknown block" width={520} height={48}>
            <BlockShell>
              <UnknownBlock raw="audio_clip" />
            </BlockShell>
          </DCArtboard>
          <DCArtboard id="pair-ok" label="tool pair · ok" width={520} height={300}>
            <BlockShell>
              <ToolPair
                use={{
                  tool: "shell_command",
                  input: { command: "pnpm typecheck" },
                  status: "completed",
                }}
                result={{
                  viewType: "bash",
                  bash: { exit: 0, stdout: "Found 0 errors.", stderr: "" },
                }}
              />
            </BlockShell>
          </DCArtboard>
          <DCArtboard id="pair-err" label="tool pair · error" width={520} height={300}>
            <BlockShell>
              <ToolPair
                use={{ tool: "read_file", input: { path: "missing.tsx" }, status: "completed" }}
                result={{
                  viewType: "read",
                  isError: true,
                  read: { path: "missing.tsx", error: "ENOENT: no such file or directory" },
                }}
              />
            </BlockShell>
          </DCArtboard>
        </DCSection>

        <DCSection id="composer" title="Composer · 8 states">
          <DCArtboard id="cmp-idle" label="idle empty" width={760} height={150}>
            <ComposerShell tweaks={{ ...tweaks, streamingState: "idle" }} />
          </DCArtboard>
          <DCArtboard id="cmp-typing" label="typing" width={760} height={150}>
            <ComposerShell
              tweaks={{ ...tweaks, streamingState: "idle" }}
              initText="Refactor the file I attached for readability."
            />
          </DCArtboard>
          <DCArtboard id="cmp-attach" label="with attachments" width={760} height={200}>
            <ComposerShell tweaks={{ ...tweaks, demoAttach: true, streamingState: "idle" }} />
          </DCArtboard>
          <DCArtboard id="cmp-slash" label="slash palette" width={760} height={320}>
            <ComposerShell tweaks={{ ...tweaks, streamingState: "idle" }} initText="/m" />
          </DCArtboard>
          <DCArtboard id="cmp-streaming" label="streaming (stop)" width={760} height={150}>
            <ComposerShell tweaks={{ ...tweaks, streamingState: "streaming" }} />
          </DCArtboard>
          <DCArtboard id="cmp-warn" label="context warn 96%" width={760} height={180}>
            <ComposerShell tweaks={{ ...tweaks, contextPct: 96, streamingState: "idle" }} />
          </DCArtboard>
          <DCArtboard id="cmp-approval" label="approval dialog" width={760} height={340}>
            <ComposerShell tweaks={{ ...tweaks, showApproval: true, streamingState: "idle" }} />
          </DCArtboard>
        </DCSection>

        <DCSection id="right" title="Right panel · canvas + artifact">
          <DCArtboard id="cv-loading" label="canvas · loading" width={460} height={420}>
            <RPShell>
              <CanvasPanel state="loading" onClose={() => {}} />
            </RPShell>
          </DCArtboard>
          <DCArtboard id="cv-ready" label="canvas · ready" width={460} height={420}>
            <RPShell>
              <CanvasPanel state="ready" onClose={() => {}} />
            </RPShell>
          </DCArtboard>
          <DCArtboard id="cv-error" label="canvas · error" width={460} height={420}>
            <RPShell>
              <CanvasPanel state="error" onClose={() => {}} />
            </RPShell>
          </DCArtboard>
          <DCArtboard id="cv-empty" label="canvas · empty" width={460} height={420}>
            <RPShell>
              <CanvasPanel state="empty" onClose={() => {}} />
            </RPShell>
          </DCArtboard>
          <DCArtboard id="ar-code" label="artifact · code" width={460} height={420}>
            <RPShell>
              <ArtifactPanel kind="code" onClose={() => {}} />
            </RPShell>
          </DCArtboard>
          <DCArtboard id="ar-md" label="artifact · markdown" width={460} height={420}>
            <RPShell>
              <ArtifactPanel kind="markdown" onClose={() => {}} />
            </RPShell>
          </DCArtboard>
          <DCArtboard id="ar-json" label="artifact · json" width={460} height={420}>
            <RPShell>
              <ArtifactPanel kind="json" onClose={() => {}} />
            </RPShell>
          </DCArtboard>
          <DCArtboard id="ar-table" label="artifact · table" width={460} height={420}>
            <RPShell>
              <ArtifactPanel kind="table" onClose={() => {}} />
            </RPShell>
          </DCArtboard>
          <DCArtboard id="ar-html" label="artifact · html" width={460} height={420}>
            <RPShell>
              <ArtifactPanel kind="html" onClose={() => {}} />
            </RPShell>
          </DCArtboard>
        </DCSection>

        <DCSection id="misc" title="Sidebar / subagents / compaction">
          <DCArtboard id="sb-full" label="sidebar · full" width={300} height={520}>
            <Sidebar
              collapsed={false}
              sessions={window.MOCK.sessions}
              activeKey="s1"
              onPick={() => {}}
              onNew={() => {}}
            />
          </DCArtboard>
          <DCArtboard id="sb-collapsed" label="sidebar · collapsed" width={64} height={520}>
            <Sidebar
              collapsed={true}
              sessions={window.MOCK.sessions}
              activeKey="s1"
              onPick={() => {}}
              onNew={() => {}}
            />
          </DCArtboard>
          <DCArtboard id="subagent" label="subagent tree" width={460} height={200}>
            <BlockShell>
              <SubagentTree tree={window.MOCK.subagentTree} />
            </BlockShell>
          </DCArtboard>
          <DCArtboard id="compact" label="compaction notice" width={460} height={56}>
            <BlockShell>
              <CompactionNotice before={12840} after={3210} />
            </BlockShell>
          </DCArtboard>
          <DCArtboard id="run-status" label="run status bar" width={620} height={48}>
            <BlockShell>
              <RunStatusBar
                meta={{
                  model: "claude-sonnet-4.6",
                  inTok: 4218,
                  outTok: 612,
                  cacheHit: 0.71,
                  cost: 0.018,
                  durationMs: 7400,
                }}
              />
            </BlockShell>
          </DCArtboard>
        </DCSection>
      </DesignCanvas>
      <TweaksUI tweaks={tweaks} setTweak={setTweak} />
    </div>
  );
}

function SSEFakeShell({ children }) {
  return (
    <div className="dc-shell" style={{ background: "var(--bg-1)" }}>
      {children}
    </div>
  );
}
function BlockShell({ children }) {
  return (
    <div className="dc-shell" style={{ background: "var(--bg-1)", padding: 14 }}>
      {children}
    </div>
  );
}
function RPShell({ children }) {
  return (
    <div
      className="dc-shell"
      style={{ background: "var(--bg-1)", height: "100%", display: "flex" }}
    >
      <div style={{ flex: 1, display: "flex" }}>{children}</div>
    </div>
  );
}
function ComposerShell({ tweaks, initText }) {
  return (
    <div className="dc-shell" style={{ background: "var(--bg-1)", padding: 14 }}>
      <Composer tweaks={tweaks} onSend={() => {}} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
