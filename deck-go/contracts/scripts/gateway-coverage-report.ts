import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import {
  DECK_GO_ROOT,
  REPO_ROOT,
  methodToPascalName,
  typedMethodNames,
} from "./protocol-common.js";

// Methods whose generated typed bindings exist but Deck Go intentionally does
// not consume them yet. Each entry is excluded from the "Deck Go Go migrated"
// denominator and surfaced as a deferred row in docs/gateway-coverage.md.
//
// Per Codex F-11 decision (R1.1): chat.send/abort live behind /chat/* BFF
// routes that internally use sessions.send/abort; approval.request methods are
// producer-side flows the Deck operator surface does not invoke; config.set
// and sessions.compaction.get have no current Deck UX caller; agent.wait is a
// long-poll RPC the Deck UI does not use directly.
const DECK_GO_DEFERRED_METHODS = new Map<string, string>([
  ["agent.wait", "Long-poll RPC; Deck UI does not invoke directly."],
  ["chat.abort", "Deck routes /chat/abort through BFF using sessions.abort."],
  ["chat.send", "Deck routes /chat/send through BFF using sessions.send."],
  ["config.set", "No Deck UX caller; deck-go writes config via deck-go-bff."],
  ["exec.approval.request", "Producer-side flow; Deck exposes list/resolve only."],
  ["exec.approval.waitDecision", "Producer-side flow; Deck exposes list/resolve only."],
  ["exec.approvals.node.get", "Producer-side flow; Deck exposes list/resolve only."],
  ["exec.approvals.node.set", "Producer-side flow; Deck exposes list/resolve only."],
  ["plugin.approval.request", "Producer-side flow; Deck exposes list/resolve only."],
  ["sessions.compaction.get", "No Deck UX caller; deferred until consumed."],
]);

const REALTIME_OWNED_METHODS = new Map<string, string>([
  // Subscription protocol methods are issued by gateway.Realtime via doRequest
  // ("sessions.subscribe" etc.) and surfaced to callers through the typed
  // channel API in gateway_subscriptions.go (proposal.md:14-22). They are not
  // expected to appear as TypedClient.X(...) call sites.
  [
    "sessions.messages.subscribe",
    "Issued by Realtime; surfaced via typed subscription channel API.",
  ],
  [
    "sessions.messages.unsubscribe",
    "Issued by Realtime; surfaced via typed subscription channel API.",
  ],
  ["sessions.subscribe", "Issued by Realtime; surfaced via typed subscription channel API."],
  ["sessions.unsubscribe", "Issued by Realtime; surfaced via typed subscription channel API."],
]);

type CoverageBaseline = {
  deck_go_fe_migrated: number;
  deck_go_go_migrated: number;
  fork_divergent: number;
  upstream_typed: number;
};

const BASELINE_JSON = resolve(DECK_GO_ROOT, "docs/gateway-coverage-baseline.json");
const COVERAGE_MD = resolve(DECK_GO_ROOT, "docs/gateway-coverage.md");
const CLASSIFICATION_DOC = resolve(DECK_GO_ROOT, "docs/fe-endpoint-classification.md");
const FORK_DIVERGENCE_DOC = resolve(DECK_GO_ROOT, "docs/fork-divergent-methods.md");
const GATEWAY_ADAPTER_CATEGORY = "gateway-protocol-adapter";
const GO_TYPED_SCAN_DIRS = [
  resolve(DECK_GO_ROOT, "backend/internal/runtime/openclaw"),
  resolve(DECK_GO_ROOT, "backend/internal/handlers"),
];

function walkGoFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkGoFiles(path));
    } else if (extname(entry.name) === ".go" && !entry.name.endsWith("_test.go")) {
      out.push(path);
    }
  }
  return out;
}

// Detect both `<receiver>.typed.<MethodName>(` (the wrapper-style consumers in
// runtime/openclaw) and `generated.NewTypedClient(...).<MethodName>(` (direct
// callers spec PR-12/13/15/16 anticipated).
function readGoMigratedPascalNames(): Set<string> {
  const names = new Set<string>();
  const wrapperPattern = /\.typed\.([A-Z][A-Za-z0-9_]+)\s*\(/g;
  const directPattern = /generated\.NewTypedClient\([^)]*\)\.([A-Z][A-Za-z0-9_]+)\s*\(/g;
  for (const dir of GO_TYPED_SCAN_DIRS) {
    for (const file of walkGoFiles(dir)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(wrapperPattern)) {
        names.add(match[1]);
      }
      for (const match of source.matchAll(directPattern)) {
        names.add(match[1]);
      }
    }
  }
  return names;
}

function readForkDivergentMethods(): Set<string> {
  if (!existsSync(FORK_DIVERGENCE_DOC)) {
    return new Set();
  }
  const methods = new Set<string>();
  for (const rawLine of readFileSync(FORK_DIVERGENCE_DOC, "utf8").split("\n")) {
    const firstCell = rawLine.split("|")[1]?.trim() ?? "";
    const match = firstCell.match(/^`([^`]+)`$/);
    if (match?.[1]?.includes(".")) {
      const method = match[1];
      methods.add(method);
    }
  }
  return methods;
}

function readFEMigratedTargets(): string[] {
  if (!existsSync(CLASSIFICATION_DOC)) {
    return [];
  }
  const targets: string[] = [];
  for (const rawLine of readFileSync(CLASSIFICATION_DOC, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("| `") || !line.includes(`\`${GATEWAY_ADAPTER_CATEGORY}\``)) {
      continue;
    }
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim().replace(/^`|`$/g, ""));
    const target = cells[2] ?? "";
    if (target.startsWith("gw.")) {
      targets.push(target);
    }
  }
  return targets.toSorted((a, b) => a.localeCompare(b));
}

function percentage(part: number, total: number): string {
  if (total === 0) {
    return "100.00%";
  }
  return `${((part / total) * 100).toFixed(2)}%`;
}

function gitShow(path: string): string | undefined {
  const result = spawnSync("git", ["show", `origin/main:${path}`], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    const details =
      result.stderr?.trim() || result.stdout?.trim() || result.error?.message || "unknown error";
    console.warn(`regression baseline unavailable: ${details}`);
    if (process.env.GATEWAY_COVERAGE_BASELINE_REQUIRED?.trim() === "1") {
      process.exitCode = 1;
    }
    return undefined;
  }
  return result.stdout;
}

function regressionAllowed(): boolean {
  if (process.env.GATEWAY_COVERAGE_REGRESS_ALLOWED_REASON?.trim()) {
    return true;
  }
  const result = spawnSync("git", ["log", "-1", "--pretty=%B"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return result.stdout.includes("gateway-coverage: regress allowed reason:");
}

function checkRegression(current: CoverageBaseline): void {
  const raw = gitShow("deck-go/docs/gateway-coverage-baseline.json");
  if (!raw) {
    return;
  }
  const previous = JSON.parse(raw) as Partial<CoverageBaseline>;
  const metrics = [
    "upstream_typed",
    "deck_go_go_migrated",
    "deck_go_fe_migrated",
    "fork_divergent",
  ] as const;
  const regressions = metrics.filter((metric) => {
    const before = previous[metric];
    return typeof before === "number" && current[metric] < before;
  });
  if (regressions.length === 0) {
    return;
  }
  for (const metric of regressions) {
    console.error(`coverage-regress: ${metric} ${previous[metric]}→${current[metric]}`);
  }
  if (!regressionAllowed()) {
    process.exitCode = 1;
  }
}

function writeReports(
  current: CoverageBaseline,
  upstreamMethods: string[],
  feTargets: string[],
  missingGo: string[],
  uxDeferredGo: string[],
  realtimeOwnedGo: string[],
): void {
  mkdirSync(dirname(BASELINE_JSON), { recursive: true });
  writeFileSync(BASELINE_JSON, `${JSON.stringify(current, null, 2)}\n`, "utf8");

  const lines = [
    "# Gateway Typed Coverage",
    "",
    "Generated by `make gateway-coverage-report`.",
    "",
    "## Summary",
    "",
    `- Upstream typed methods: ${current.upstream_typed}`,
    `- Deck Go Go migrated: ${current.deck_go_go_migrated}/${current.upstream_typed} (${percentage(current.deck_go_go_migrated, current.upstream_typed)})`,
    `- Deck Go FE migrated Gateway RPC proxy calls: ${current.deck_go_fe_migrated}`,
    `- Fork-divergent methods excluded from denominator: ${current.fork_divergent}`,
    `- Deck Go deferred methods (generated, not yet consumed): ${uxDeferredGo.length + realtimeOwnedGo.length} (${uxDeferredGo.length} UX + ${realtimeOwnedGo.length} Realtime-owned)`,
    "",
    "## Missing Go Typed Methods",
    "",
  ];

  if (missingGo.length === 0) {
    lines.push("- None");
  } else {
    lines.push(...missingGo.map((method) => `- \`${method}\``));
  }

  lines.push("", "## Deferred Go Typed Methods", "");
  lines.push(
    "These methods have generated typed bindings but Deck Go intentionally does not consume them yet.",
  );
  lines.push("");
  if (uxDeferredGo.length === 0) {
    lines.push("- None");
  } else {
    lines.push("| Method | Reason |");
    lines.push("| --- | --- |");
    for (const method of uxDeferredGo) {
      const reason = DECK_GO_DEFERRED_METHODS.get(method) ?? "";
      lines.push(`| \`${method}\` | ${reason} |`);
    }
  }

  lines.push("", "## Realtime-Owned Go Methods", "");
  lines.push(
    "These protocol methods are emitted by the Realtime transport itself rather than typed business wrappers.",
  );
  lines.push("");
  if (realtimeOwnedGo.length === 0) {
    lines.push("- None");
  } else {
    lines.push("| Method | Reason |");
    lines.push("| --- | --- |");
    for (const method of realtimeOwnedGo) {
      const reason = REALTIME_OWNED_METHODS.get(method) ?? "";
      lines.push(`| \`${method}\` | ${reason} |`);
    }
  }

  lines.push("", "## FE Migrated Targets", "");
  if (feTargets.length === 0) {
    lines.push("- None");
  } else {
    lines.push(...feTargets.map((target) => `- \`${target}\``));
  }

  lines.push("", "## Dashboard Alignment", "");
  lines.push(
    "- Frontend typed calls use the same generated `createGatewayClient(request)` shape as the dashboard protocol client.",
  );
  lines.push(
    "- Deck Go BFF and binary/SSE/upload endpoints remain outside the Gateway typed method denominator by classification.",
  );
  lines.push("", "## Upstream Typed Method Denominator", "");
  lines.push(...upstreamMethods.map((method) => `- \`${method}\``));
  lines.push("");

  writeFileSync(COVERAGE_MD, lines.join("\n"), "utf8");
}

function main(): void {
  const forkDivergent = readForkDivergentMethods();
  const upstreamMethods = typedMethodNames()
    .filter((method) => !forkDivergent.has(method))
    .toSorted((a, b) => a.localeCompare(b));
  const goMigratedPascal = readGoMigratedPascalNames();
  const unmigrated = upstreamMethods.filter(
    (method) => !goMigratedPascal.has(methodToPascalName(method)),
  );
  const uxDeferredGo = unmigrated.filter((method) => DECK_GO_DEFERRED_METHODS.has(method));
  const realtimeOwnedGo = unmigrated.filter((method) => REALTIME_OWNED_METHODS.has(method));
  const deferredGo = new Set([...uxDeferredGo, ...realtimeOwnedGo]);
  const missingGo = unmigrated.filter((method) => !deferredGo.has(method));
  const feTargets = readFEMigratedTargets();
  const current: CoverageBaseline = {
    upstream_typed: upstreamMethods.length,
    deck_go_go_migrated: upstreamMethods.length - unmigrated.length,
    deck_go_fe_migrated: feTargets.length,
    fork_divergent: forkDivergent.size,
  };

  writeReports(current, upstreamMethods, feTargets, missingGo, uxDeferredGo, realtimeOwnedGo);
  checkRegression(current);
  console.log(
    `gateway-coverage-report wrote ${BASELINE_JSON} and ${COVERAGE_MD}: ${current.deck_go_go_migrated}/${current.upstream_typed} migrated, ${deferredGo.size} deferred (${uxDeferredGo.length} UX + ${realtimeOwnedGo.length} Realtime-owned), ${missingGo.length} missing`,
  );
  if (missingGo.length > 0) {
    process.exitCode = 1;
    for (const method of missingGo) {
      console.error(`coverage-missing: ${method}`);
    }
  }
}

main();
