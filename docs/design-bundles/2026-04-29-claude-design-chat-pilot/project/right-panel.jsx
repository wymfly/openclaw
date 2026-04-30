// Right panel — Canvas + Artifact, with state variants.
const { useState: useStateR } = React;

function RightPanel({ mode, width, onClose, onResize, canvasState, artifactKind }) {
  if (mode === "hidden") {
    return null;
  }
  return (
    <div className="right-panel" style={{ width: width + "px" }}>
      <div className="rp-resize" onMouseDown={onResize} title="Drag to resize" />
      {mode === "canvas" && <CanvasPanel state={canvasState} onClose={onClose} />}
      {mode === "artifact" && <ArtifactPanel kind={artifactKind} onClose={onClose} />}
    </div>
  );
}

function CanvasPanel({ state, onClose }) {
  const [debug, setDebug] = useStateR(false);
  return (
    <div className="cp">
      <div className="rp-head">
        <I.Canvas size={13} />
        <span className="rp-title">Canvas</span>
        <span className="rp-sub mono small">a2ui-bridge · ready in 240ms</span>
        <span className="grow" />
        <button
          className={"icon-btn " + (debug ? "active" : "")}
          onClick={() => setDebug(!debug)}
          title="Debug"
        >
          <I.Bug size={12} />
        </button>
        <button className="icon-btn">
          <I.Refresh size={12} />
        </button>
        <button className="icon-btn" onClick={onClose}>
          <I.X size={12} />
        </button>
      </div>
      <div className="cp-body">
        <div className="cp-stage">
          {state === "loading" && (
            <div className="cp-overlay">
              <span className="spin" style={{ width: 18, height: 18 }} />
              <span className="mono small">Loading canvas…</span>
            </div>
          )}
          {state === "error" && (
            <div className="cp-overlay error">
              <I.X size={20} />
              <div className="mono">Bridge handshake failed</div>
              <button className="btn-ghost">
                <I.Refresh size={11} /> Reload
              </button>
            </div>
          )}
          {state === "empty" && (
            <div className="cp-overlay muted">
              <I.Canvas size={24} />
              <div className="mono">No canvas yet</div>
              <div className="mono small">Waiting for agent to push a UI tree…</div>
            </div>
          )}
          {state === "ready" && (
            <div className="cp-iframe-mock">
              <div className="cp-iframe-bar mono small">a2ui:tree · 14 nodes</div>
              <div className="cp-iframe-content">
                <div className="cp-card">
                  <div className="cp-card-h mono">DataTable</div>
                  <div className="cp-row mono">
                    <span>id</span>
                    <span>tokens</span>
                    <span>cost</span>
                  </div>
                  <div className="cp-row mono">
                    <span>m1</span>
                    <span>4,218</span>
                    <span>$0.018</span>
                  </div>
                  <div className="cp-row mono">
                    <span>m2</span>
                    <span>5,102</span>
                    <span>$0.011</span>
                  </div>
                  <div className="cp-row mono">
                    <span>m3</span>
                    <span>3,210</span>
                    <span>$0.007</span>
                  </div>
                </div>
                <div className="cp-actions">
                  <button className="btn-secondary small">Refresh</button>
                  <button className="btn-primary small">Export</button>
                </div>
              </div>
            </div>
          )}
        </div>
        {debug && state === "ready" && (
          <div className="cp-debug mono small">
            <div className="cp-debug-h">Tree inspector</div>
            <div>▾ Stack [16,16]</div>
            <div style={{ paddingLeft: 14 }}>▾ DataTable rows=4 cols=3</div>
            <div style={{ paddingLeft: 28 }}>· Header [id, tokens, cost]</div>
            <div style={{ paddingLeft: 28 }}>· Rows [m1, m2, m3]</div>
            <div style={{ paddingLeft: 14 }}>▸ ButtonGroup count=2</div>
            <div className="cp-debug-h" style={{ marginTop: 6 }}>
              Events
            </div>
            <div>14:02:18 · tree:replace</div>
            <div>14:02:24 · row:hover m2</div>
            <div>14:02:31 · button:click Export</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ArtifactPanel({ kind, onClose }) {
  const [tab, setTab] = useStateR(kind || "code");
  return (
    <div className="ap">
      <div className="rp-head">
        <I.Artifact size={13} />
        <span className="rp-title">ToolPair.tsx</span>
        <span className="rp-sub mono small">tsx · 38 lines</span>
        <span className="grow" />
        <button className="icon-btn" title="Download">
          <I.Download size={12} />
        </button>
        <button className="icon-btn" title="Copy">
          <I.Copy size={12} />
        </button>
        <button className="icon-btn" title="Fullscreen">
          <I.Maximize size={12} />
        </button>
        <button className="icon-btn" onClick={onClose}>
          <I.X size={12} />
        </button>
      </div>
      <div className="ap-tabs">
        {[
          ["code", "Code"],
          ["markdown", "Markdown"],
          ["json", "JSON"],
          ["table", "Table"],
          ["html", "HTML"],
        ].map(([k, l]) => (
          <button
            key={k}
            className={"ap-tab " + (tab === k ? "active" : "")}
            onClick={() => setTab(k)}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="ap-body">
        {tab === "code" && <ApCode />}
        {tab === "markdown" && <ApMarkdown />}
        {tab === "json" && <ApJson />}
        {tab === "table" && <ApTable />}
        {tab === "html" && <ApHtml />}
      </div>
    </div>
  );
}

function ApCode() {
  const lines = [
    'import { ToolUseHeader } from "./ToolUseCard";',
    'import { ResolveResultBody } from "./ToolResultCard";',
    'import type { ToolUseBlock, ToolResultBlock } from "@/types/blocks";',
    "",
    "type Props = {",
    "  use: ToolUseBlock;",
    "  result?: ToolResultBlock;",
    "  paired: boolean;",
    "};",
    "",
    "export function ToolPair({ use, result, paired }: Props) {",
    '  const variant = result?.isError ? "error" : "ok";',
    "  return (",
    "    <section data-paired={paired} data-variant={variant}>",
    "      <ToolUseHeader block={use} compact />",
    "      {result && <ResolveResultBody block={result} embedded />}",
    "    </section>",
    "  );",
    "}",
  ];
  return (
    <pre className="ap-code">
      {lines.map((l, i) => (
        <div key={i} className="code-line">
          <span className="ln">{i + 1}</span>
          <code>{l || " "}</code>
        </div>
      ))}
    </pre>
  );
}
function ApMarkdown() {
  return (
    <div className="ap-md md">
      <h3>ToolPair component</h3>
      <p>
        Merges <code className="inline-code">tool_use</code> +{" "}
        <code className="inline-code">tool_result</code> into a single visual unit. Variants:{" "}
        <strong>ok</strong>, <strong>error</strong>.
      </p>
      <ul>
        <li>Top: tool name + summary + status badge</li>
        <li>
          Bottom: result body via <code className="inline-code">viewType</code> dispatch
        </li>
        <li>Border: shared between halves; tinted by variant</li>
      </ul>
    </div>
  );
}
function ApJson() {
  return (
    <pre className="ap-json mono small">
      {`{
  "tool": "shell_command",
  "input": {
    "command": "pnpm typecheck",
    "cwd": "/workspace/deck-go/frontend"
  },
  "result": {
    "exit": 0,
    "stdout": "Found 0 errors.",
    "stderr": ""
  },
  "meta": {
    "duration_ms": 7400,
    "tokens_in": 4218,
    "tokens_out": 612
  }
}`}
    </pre>
  );
}
function ApTable() {
  const rows = [
    ["m1", "user", "4218", "10:42"],
    ["m2", "assistant", "612", "10:42"],
    ["m4", "user", "5102", "10:51"],
    ["m5", "assistant", "248", "10:51"],
  ];
  return (
    <table className="ap-table">
      <thead>
        <tr>
          <th>id</th>
          <th>role</th>
          <th>tokens</th>
          <th>time</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} className={j === 0 ? "mono" : ""}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function ApHtml() {
  return (
    <div className="ap-html-stub">
      <div className="mono small ap-html-bar">srcdoc iframe (sandbox=allow-scripts)</div>
      <div className="ap-html-canvas">
        <div style={{ padding: 24, fontFamily: "system-ui" }}>
          <h2 style={{ margin: 0 }}>Hello, artifact world</h2>
          <p>Rendered HTML inside a sandboxed iframe.</p>
          <button style={{ padding: "6px 12px", border: "1px solid #888" }}>Click me</button>
        </div>
      </div>
    </div>
  );
}

window.RightPanel = RightPanel;
window.CanvasPanel = CanvasPanel;
window.ArtifactPanel = ArtifactPanel;
