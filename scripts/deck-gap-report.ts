#!/usr/bin/env bun
/**
 * Deck capability gap report — classifies Gateway methods by Deck adaptation readiness.
 *
 * Produces a structured report showing:
 *   - FULL: typed client ready (has result schema in methodDefs)
 *   - PARTIAL: in allowlist but no result type (low cost to complete)
 *   - UNTYPED/RELEVANT: not in methodDefs, but potentially useful for Deck
 *   - UNTYPED/INTERNAL: not in methodDefs, internal-only (skip)
 *
 * Usage:
 *   bun scripts/deck-gap-report.ts              # human-readable report
 *   bun scripts/deck-gap-report.ts --json       # machine-readable JSON
 *   bun scripts/deck-gap-report.ts --changelog  # include upstream changelog diff
 */
import { execSync } from "node:child_process";
import { allMethodDefs, allMethodNames } from "../src/gateway/method-registry-data.js";

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/** Methods that are purely internal — Deck should never consume these. */
const INTERNAL_EXACT = new Set([
  "send",
  "agent",
  "wake",
  "heartbeat",
  "presence",
  "system-presence",
  "system-event",
  "last-heartbeat",
  "set-heartbeats",
]);

const INTERNAL_PREFIXES = ["node.", "node.pair.", "node.pending.", "node.invoke.", "node.canvas."];

function isInternal(method: string): boolean {
  if (INTERNAL_EXACT.has(method)) return true;
  return INTERNAL_PREFIXES.some((p) => method.startsWith(p));
}

interface MethodClassification {
  name: string;
  tier: "full" | "partial" | "untyped-relevant" | "untyped-internal";
  hasParams: boolean;
  hasResult: boolean;
  scope: string | null;
}

interface NamespaceGroup {
  namespace: string;
  methods: MethodClassification[];
  tier: "full" | "partial" | "untyped-relevant" | "untyped-internal" | "mixed";
}

interface GapReport {
  timestamp: string;
  totals: {
    registered: number;
    full: number;
    partial: number;
    untypedRelevant: number;
    untypedInternal: number;
  };
  namespaces: NamespaceGroup[];
  methods: MethodClassification[];
}

function classifyMethods(): MethodClassification[] {
  return allMethodNames.map((name) => {
    const def = allMethodDefs[name];
    if (!def) {
      return {
        name,
        tier: isInternal(name) ? "untyped-internal" : "untyped-relevant",
        hasParams: false,
        hasResult: false,
        scope: null,
      };
    }
    return {
      name,
      tier: def.result ? "full" : "partial",
      hasParams: Boolean(def.params),
      hasResult: Boolean(def.result),
      scope: typeof def.scope === "string" ? def.scope : null,
    };
  });
}

function groupByNamespace(methods: MethodClassification[]): NamespaceGroup[] {
  const groups = new Map<string, MethodClassification[]>();
  for (const m of methods) {
    const parts = m.name.split(".");
    const ns = parts.length > 1 ? parts.slice(0, -1).join(".") : m.name;
    const list = groups.get(ns) ?? [];
    list.push(m);
    groups.set(ns, list);
  }
  return [...groups.entries()]
    .map(([namespace, methods]) => {
      const tiers = new Set(methods.map((m) => m.tier));
      const tier = tiers.size === 1 ? [...tiers][0] : "mixed";
      return { namespace, methods, tier } as NamespaceGroup;
    })
    .sort((a, b) => a.namespace.localeCompare(b.namespace));
}

function buildReport(): GapReport {
  const methods = classifyMethods();
  const namespaces = groupByNamespace(methods);
  return {
    timestamp: new Date().toISOString(),
    totals: {
      registered: methods.length,
      full: methods.filter((m) => m.tier === "full").length,
      partial: methods.filter((m) => m.tier === "partial").length,
      untypedRelevant: methods.filter((m) => m.tier === "untyped-relevant").length,
      untypedInternal: methods.filter((m) => m.tier === "untyped-internal").length,
    },
    namespaces,
    methods,
  };
}

// ---------------------------------------------------------------------------
// Changelog diff (optional)
// ---------------------------------------------------------------------------

function getUpstreamChangelogDiff(): string | null {
  try {
    const mergeBase = execSync("git merge-base HEAD upstream/main", { encoding: "utf-8" }).trim();
    const diff = execSync(
      `git diff ${mergeBase}..upstream/main -- CHANGELOG.md | grep '^+' | grep -v '^+++'`,
      { encoding: "utf-8" },
    );
    return diff || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const JSON_MODE = process.argv.includes("--json");
const CHANGELOG_MODE = process.argv.includes("--changelog");

const report = buildReport();

if (JSON_MODE) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

// Human-readable output
const { totals } = report;

console.log("=== Deck Capability Gap Report ===\n");
console.log(`Registered methods:  ${totals.registered}`);
console.log(`  Full (typed):      ${totals.full}  (ready to use)`);
console.log(`  Partial (no type): ${totals.partial}  (low cost to complete)`);
console.log(`  Untyped/relevant:  ${totals.untypedRelevant}  (evaluate for adaptation)`);
console.log(`  Untyped/internal:  ${totals.untypedInternal}  (skip)\n`);

const tierIcon: Record<string, string> = {
  full: "[ok]",
  partial: "[!!]",
  "untyped-relevant": "[??]",
  "untyped-internal": "[--]",
  mixed: "[~~]",
};

// Show actionable namespaces first
const actionable = report.namespaces.filter(
  (ns) => ns.tier === "partial" || ns.tier === "untyped-relevant" || ns.tier === "mixed",
);
const ok = report.namespaces.filter((ns) => ns.tier === "full");
const skip = report.namespaces.filter((ns) => ns.tier === "untyped-internal");

if (actionable.length > 0) {
  console.log("--- Actionable (adaptation opportunity) ---");
  for (const ns of actionable) {
    const counts = {
      partial: ns.methods.filter((m) => m.tier === "partial").length,
      relevant: ns.methods.filter((m) => m.tier === "untyped-relevant").length,
      full: ns.methods.filter((m) => m.tier === "full").length,
    };
    console.log(
      `  ${tierIcon[ns.tier]} ${ns.namespace.padEnd(25)} (${ns.methods.length} methods: ${counts.full} typed, ${counts.partial} partial, ${counts.relevant} untyped)`,
    );
    for (const m of ns.methods.filter((m) => m.tier !== "full")) {
      console.log(`       ${tierIcon[m.tier]} ${m.name}`);
    }
  }
  console.log();
}

if (ok.length > 0) {
  console.log(
    `--- Fully adapted (${ok.length} namespaces, ${ok.reduce((n, ns) => n + ns.methods.length, 0)} methods) ---`,
  );
  for (const ns of ok) {
    console.log(`  [ok] ${ns.namespace.padEnd(25)} (${ns.methods.length} methods)`);
  }
  console.log();
}

if (skip.length > 0) {
  console.log(
    `--- Internal/skip (${skip.length} namespaces, ${skip.reduce((n, ns) => n + ns.methods.length, 0)} methods) ---`,
  );
  for (const ns of skip) {
    console.log(`  [--] ${ns.namespace.padEnd(25)} (${ns.methods.length} methods)`);
  }
  console.log();
}

// Changelog diff
if (CHANGELOG_MODE) {
  const diff = getUpstreamChangelogDiff();
  if (diff) {
    console.log("--- Upstream Changelog Additions ---");
    console.log(diff);
  } else {
    console.log("(No upstream changelog diff available — run 'git fetch upstream main' first)");
  }
}
