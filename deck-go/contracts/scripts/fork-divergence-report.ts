import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DECK_GO_ROOT, REPO_ROOT, allowlistMethodNames, methodDefs } from "./protocol-common.js";

type Entry = {
  method: string;
  type: "added" | "modified" | "baseline-unavailable";
  evidence: string;
  notes: string;
};

function git(args: string[], allowFailure = false): string {
  const result = spawnSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    if (allowFailure) {
      return "";
    }
    const details = result.stderr.trim() || result.stdout.trim();
    throw new Error(`git ${args.join(" ")} failed: ${details}`);
  }
  return result.stdout;
}

function hasRef(ref: string): boolean {
  return (
    spawnSync("git", ["rev-parse", "--verify", "--quiet", ref], { cwd: REPO_ROOT }).status === 0
  );
}

function chooseBaseline(): string | undefined {
  const envBaseline = process.env.OPENCLAW_UPSTREAM_BASE?.trim();
  if (envBaseline) {
    if (!hasRef(envBaseline)) {
      throw new Error(`OPENCLAW_UPSTREAM_BASE does not resolve: ${envBaseline}`);
    }
    return envBaseline;
  }
  if (hasRef("upstream/main")) {
    return "upstream/main";
  }
  if (hasRef("origin/main")) {
    console.error("fallback baseline: origin/main");
    return "origin/main";
  }
  return undefined;
}

function extractMethods(text: string): Set<string> {
  const methods = new Set<string>();
  for (const match of text.matchAll(/["`]([a-zA-Z0-9_.-]+(?:\.[a-zA-Z0-9_.-]+)+)["`]\s*:/g)) {
    methods.add(match[1]);
  }
  for (const match of text.matchAll(/["`]([a-zA-Z0-9_.-]+(?:\.[a-zA-Z0-9_.-]+)+)["`]/g)) {
    const method = match[1];
    if (methodDefs[method]) {
      methods.add(method);
    }
  }
  return methods;
}

function lineEvidenceFor(method: string): string {
  const output = git(
    [
      "grep",
      "-F",
      "-n",
      method,
      "--",
      "src/gateway/server-methods-list.ts",
      "src/gateway/server-methods/",
    ],
    true,
  );
  const lines = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const first = lines.find((line) => !line.includes(".test.ts:")) ?? lines[0];
  if (!first) {
    return "method-registry-data.ts";
  }
  const match = first.match(/^(.+?):(\d+):/);
  return match ? `${match[1]}:${match[2]}` : first;
}

function baselineMethodSet(ref: string): Set<string> {
  const output = git(
    [
      "grep",
      "-h",
      "-E",
      "[a-zA-Z0-9_.-]+\\.[a-zA-Z0-9_.-]+",
      ref,
      "--",
      "src/gateway/server-methods-list.ts",
      "src/gateway/server-methods/",
    ],
    true,
  );
  return extractMethods(output);
}

function diffTouchedMethods(baseline: string): Set<string> {
  const diff = git(
    ["diff", baseline, "--", "src/gateway/server-methods-list.ts", "src/gateway/server-methods/"],
    true,
  );
  const changedLines = diff
    .split("\n")
    .filter((line) => /^[+-](?![+-])/.test(line))
    .join("\n");
  return extractMethods(changedLines);
}

function noteFor(method: string, type: Entry["type"]): string {
  if (type === "baseline-unavailable") {
    return "Baseline unavailable; review before full alignment";
  }
  if (method === "deck.agents.eventStreams.get" || method === "deck.agents.eventStreams.set") {
    return "Channel Event Filter configuration surface";
  }
  if (method === "deck.plugins.list") {
    return "Plugin inventory surface, including WeCom extension visibility when installed";
  }
  if (method === "channels.status" || method === "channels.logout") {
    return "Channel registry/status surface for built-in and plugin channels";
  }
  if (method === "gateway.describe") {
    return "Gateway protocol introspection for typed clients";
  }
  if (method.startsWith("deck.")) {
    return "Deck migration control-plane surface";
  }
  if (method.startsWith("doctor.memory.")) {
    return "Enhanced memory diagnostics";
  }
  if (method.includes("approval")) {
    return "Approval control-plane support";
  }
  if (method.startsWith("node.") || method.startsWith("device.")) {
    return "Node/device pairing control-plane support";
  }
  if (
    method.startsWith("sessions.") ||
    method.startsWith("chat.") ||
    method.startsWith("agents.") ||
    method.startsWith("agent.")
  ) {
    return "Deck runtime interaction surface";
  }
  return "Fork registry delta; review before full alignment";
}

function boundaryNotes(): string[] {
  return [
    "## Boundary Notes",
    "",
    "- SSRF / `browser.request`: `browser.request` is registered by the bundled browser plugin, not by the static `src/gateway/server-methods-list.ts` method definitions that this report diffs. Treat SSRF hardening as an extension/plugin Gateway surface during full alignment.",
    "- WeCom: WeCom is represented as a plugin/channel surface, not a standalone static `wecom.*` Gateway method in the current registry. Static Gateway inventory visibility is through `deck.plugins.list` plus channel status/config methods.",
    "- Channel Event Filter: the static Gateway methods are `deck.agents.eventStreams.get` and `deck.agents.eventStreams.set`; these back the Deck Channel Event Streams UI.",
    "",
  ];
}

function buildEntries(): Entry[] {
  const baseline = chooseBaseline();
  if (!baseline) {
    console.error("no upstream baseline available; report is incomplete");
    return allowlistMethodNames().map((method) => ({
      method,
      type: "baseline-unavailable",
      evidence: lineEvidenceFor(method),
      notes: noteFor(method, "baseline-unavailable"),
    }));
  }

  const baselineMethods = baselineMethodSet(baseline);
  const currentMethods = new Set(allowlistMethodNames());
  const touchedMethods = diffTouchedMethods(baseline);
  const entries: Entry[] = [];

  for (const method of [...currentMethods].toSorted((a, b) => a.localeCompare(b))) {
    if (!baselineMethods.has(method)) {
      const type = "added";
      entries.push({
        method,
        type,
        evidence: lineEvidenceFor(method),
        notes: noteFor(method, type),
      });
    } else if (touchedMethods.has(method)) {
      const type = "modified";
      entries.push({
        method,
        type,
        evidence: lineEvidenceFor(method),
        notes: noteFor(method, type),
      });
    }
  }
  return entries;
}

function render(entries: Entry[]): string {
  const lines = [
    "# Fork-Divergent Gateway Methods",
    "",
    "Generated by `make fork-divergence-report`.",
    "",
    "| Method | Type | Evidence | Notes |",
    "|---|---|---|---|",
  ];
  for (const entry of entries) {
    lines.push(`| \`${entry.method}\` | ${entry.type} | \`${entry.evidence}\` | ${entry.notes} |`);
  }
  lines.push("");
  lines.push(...boundaryNotes());
  return lines.join("\n");
}

const outPath = resolve(DECK_GO_ROOT, "docs/fork-divergent-methods.md");
const content = render(buildEntries());
if (existsSync(outPath) && readFileSync(outPath, "utf8") === content) {
  console.log(`${outPath} is up to date`);
  process.exit(0);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, content);
console.log(`wrote ${outPath}`);
