import fs from "node:fs/promises";
import path from "node:path";

const contractsRoot = new URL("../", import.meta.url);
const deckGoRoot = path.resolve(contractsRoot.pathname, "..");
const repoRoot = path.resolve(deckGoRoot, "..");
const sourcePath = path.join(deckGoRoot, "contracts/source/deck-live-projections.contract.json");
const streamContractPath = path.join(deckGoRoot, "contracts/source/deck-streams.contract.json");
const endpointContractPath = path.join(deckGoRoot, "contracts/source/deck-endpoints.contract.json");
const generatedTsPath = path.join(
  deckGoRoot,
  "contracts/generated/ts/deck-live-projections.generated.ts",
);
const docPath = path.join(deckGoRoot, "docs/deck-live-projection-contract.md");

const allowedGapPolicies = new Set(["none", "mark-stale", "refresh"]);

function repoPath(file) {
  return path.relative(repoRoot, file).replaceAll(path.sep, "/");
}

export function normalizeEndpointKey(endpoint) {
  const [rawMethod, ...pathParts] = String(endpoint ?? "")
    .trim()
    .split(/\s+/);
  const method = rawMethod?.toUpperCase();
  const rawPath = pathParts.join(" ");
  if (!method || !rawPath) {
    return "";
  }
  const withoutQuery = rawPath.split("?")[0];
  const normalizedPath = withoutQuery.startsWith("/api/")
    ? withoutQuery
    : `/api${withoutQuery.startsWith("/") ? "" : "/"}${withoutQuery}`;
  return `${method} ${normalizedPath}`;
}

export function collectEndpointKeys(endpointContract) {
  const keys = new Set();
  for (const endpoint of endpointContract.endpoints ?? []) {
    for (const entry of endpoint.paths ?? []) {
      const key = normalizeEndpointKey(entry);
      if (key) {
        keys.add(key);
      }
    }
  }
  return keys;
}

export function collectStreamEvents(streamContract) {
  const streams = new Map();
  for (const stream of streamContract.streams ?? []) {
    const key = normalizeEndpointKey(stream.endpoint);
    const events = new Set((stream.events ?? []).map((event) => event.event).filter(Boolean));
    streams.set(key, { endpoint: stream.endpoint, events });
  }
  return streams;
}

function pushIssue(issues, path, message) {
  issues.push({ path, message });
}

export function validateLiveProjectionContract(contract, context) {
  const issues = [];
  const endpointKeys = context.endpointKeys ?? new Set();
  const streamEvents = context.streamEvents ?? new Map();

  if (contract.schemaVersion !== 1) {
    pushIssue(issues, "schemaVersion", "must be 1");
  }
  if (contract.metadataSourceFormat !== "deck-live-projections-json") {
    pushIssue(issues, "metadataSourceFormat", "must be deck-live-projections-json");
  }

  const streamById = new Map();
  for (const [index, stream] of (contract.streams ?? []).entries()) {
    const base = `streams[${index}]`;
    if (!stream.id) {
      pushIssue(issues, `${base}.id`, "missing stream id");
    } else if (streamById.has(stream.id)) {
      pushIssue(issues, `${base}.id`, `duplicate stream id: ${stream.id}`);
    } else {
      streamById.set(stream.id, stream);
    }
    if (stream.transport !== "sse") {
      pushIssue(issues, `${base}.transport`, "must be sse");
    }
    const endpointKey = normalizeEndpointKey(stream.endpoint);
    if (!endpointKeys.has(endpointKey)) {
      pushIssue(issues, `${base}.endpoint`, `unknown endpoint: ${stream.endpoint ?? "<missing>"}`);
    }
    if (!streamEvents.has(endpointKey)) {
      pushIssue(
        issues,
        `${base}.endpoint`,
        `endpoint is not declared in stream contract: ${stream.endpoint}`,
      );
    }
    if (stream.gapEvent !== null && stream.gapEvent !== undefined) {
      const declaredEvents = streamEvents.get(endpointKey)?.events ?? new Set();
      if (!declaredEvents.has(stream.gapEvent)) {
        pushIssue(
          issues,
          `${base}.gapEvent`,
          `gap event is not declared by stream: ${stream.gapEvent}`,
        );
      }
    }
  }

  const projectionById = new Map();
  for (const [index, projection] of (contract.projections ?? []).entries()) {
    const base = `projections[${index}]`;
    if (!projection.id) {
      pushIssue(issues, `${base}.id`, "missing projection id");
    } else if (projectionById.has(projection.id)) {
      pushIssue(issues, `${base}.id`, `duplicate projection id: ${projection.id}`);
    } else {
      projectionById.set(projection.id, projection);
    }
    if (!projection.panel) {
      pushIssue(issues, `${base}.panel`, "missing panel id");
    }
    if (!Number.isInteger(projection.staleAfterMs) || projection.staleAfterMs < 1000) {
      pushIssue(issues, `${base}.staleAfterMs`, "must be an integer >= 1000");
    }
    if (!allowedGapPolicies.has(projection.gapPolicy)) {
      pushIssue(
        issues,
        `${base}.gapPolicy`,
        `unknown gap policy: ${projection.gapPolicy ?? "<missing>"}`,
      );
    }

    const refreshEndpoints = projection.refreshEndpoints ?? [];
    if (projection.gapPolicy === "refresh" && refreshEndpoints.length === 0) {
      pushIssue(
        issues,
        `${base}.refreshEndpoints`,
        "refresh gap policy requires at least one endpoint",
      );
    }
    for (const endpoint of refreshEndpoints) {
      const endpointKey = normalizeEndpointKey(endpoint);
      if (!endpointKeys.has(endpointKey)) {
        pushIssue(issues, `${base}.refreshEndpoints.${endpoint}`, "unknown refresh endpoint");
      }
    }

    if (projection.stream === null) {
      if ((projection.events ?? []).length > 0) {
        pushIssue(
          issues,
          `${base}.events`,
          "refresh-only projections must not declare stream events",
        );
      }
      if (projection.cursorStorageKey !== null) {
        pushIssue(
          issues,
          `${base}.cursorStorageKey`,
          "refresh-only projections must not declare cursor storage",
        );
      }
      continue;
    }

    const stream = streamById.get(projection.stream);
    if (!stream) {
      pushIssue(issues, `${base}.stream`, `unknown stream id: ${projection.stream ?? "<missing>"}`);
      continue;
    }
    if (stream.lastEventId && !projection.cursorStorageKey) {
      pushIssue(
        issues,
        `${base}.cursorStorageKey`,
        "stream projections with Last-Event-ID require a cursor storage key",
      );
    }
    const streamKey = normalizeEndpointKey(stream.endpoint);
    const declaredEvents = streamEvents.get(streamKey)?.events ?? new Set();
    for (const event of projection.events ?? []) {
      if (!declaredEvents.has(event)) {
        pushIssue(
          issues,
          `${base}.events.${event}`,
          `event is not declared for stream ${stream.endpoint}`,
        );
      }
    }
    if (
      projection.gapPolicy !== "none" &&
      stream.gapEvent &&
      !(projection.events ?? []).includes(stream.gapEvent)
    ) {
      pushIssue(
        issues,
        `${base}.events`,
        `gap policy ${projection.gapPolicy} requires event ${stream.gapEvent}`,
      );
    }
  }

  return issues;
}

function escapeCell(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
}

export function renderMarkdown(contract) {
  const lines = [
    "# Deck Go Live Projection Contract",
    "",
    "Generated by `make live-projection-contract-sync`.",
    "",
    "This document maps Deck Go product projections to their BFF stream source, refresh endpoint, stale-state threshold, and projection-gap policy. Code remains the final truth; regenerate this document from `contracts/source/deck-live-projections.contract.json` after source changes.",
    "",
    "## Streams",
    "",
    "| ID | Endpoint | Transport | Last-Event-ID | Gap Event | Notes |",
    "| --- | --- | --- | --- | --- | --- |",
  ];

  for (const stream of contract.streams ?? []) {
    lines.push(
      `| \`${escapeCell(stream.id)}\` | \`${escapeCell(stream.endpoint)}\` | \`${escapeCell(stream.transport)}\` | ${stream.lastEventId ? "yes" : "no"} | ${stream.gapEvent ? `\`${escapeCell(stream.gapEvent)}\`` : "none"} | ${escapeCell(stream.notes)} |`,
    );
  }

  lines.push(
    "",
    "## Projections",
    "",
    "| ID | Panel | Stream | Events | Refresh Endpoints | Stale After | Gap Policy | Cursor Key | Notes |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );

  for (const projection of contract.projections ?? []) {
    lines.push(
      `| \`${escapeCell(projection.id)}\` | \`${escapeCell(projection.panel)}\` | ${projection.stream ? `\`${escapeCell(projection.stream)}\`` : "refresh-only"} | ${escapeCell((projection.events ?? []).join(", ")) || "none"} | ${escapeCell((projection.refreshEndpoints ?? []).join(", "))} | ${projection.staleAfterMs}ms | \`${escapeCell(projection.gapPolicy)}\` | ${projection.cursorStorageKey ? `\`${escapeCell(projection.cursorStorageKey)}\`` : "none"} | ${escapeCell(projection.notes)} |`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

export function renderTypescript(contract) {
  return [
    "// AUTO-GENERATED FROM contracts/source/deck-live-projections.contract.json",
    "// Do not edit this file directly.",
    "",
    `export const deckGoLiveProjectionContract = ${JSON.stringify(contract, null, 2)} as const;`,
    "",
    "export type DeckGoLiveProjectionContract = typeof deckGoLiveProjectionContract;",
    'export type DeckGoLiveProjectionId = DeckGoLiveProjectionContract["projections"][number]["id"];',
    'export type DeckGoLiveProjectionStreamId = NonNullable<DeckGoLiveProjectionContract["projections"][number]["stream"]>;',
    'export type DeckGoLiveProjectionGapPolicy = DeckGoLiveProjectionContract["gapPolicies"][number];',
    'export type DeckGoLiveProjectionStatus = DeckGoLiveProjectionContract["statusValues"][number];',
    "",
  ].join("\n");
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function main() {
  const [contract, streamContract, endpointContract] = await Promise.all([
    readJson(sourcePath),
    readJson(streamContractPath),
    readJson(endpointContractPath),
  ]);
  const issues = validateLiveProjectionContract(contract, {
    endpointKeys: collectEndpointKeys(endpointContract),
    streamEvents: collectStreamEvents(streamContract),
  });
  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`live-projection-contract: ${issue.path}: ${issue.message}`);
    }
    process.exit(1);
  }

  const expectedTs = renderTypescript(contract);
  const expectedMarkdown = renderMarkdown(contract);
  if (process.env.CHECK_MODE === "1") {
    const [actualTs, actualMarkdown] = await Promise.all([
      fs.readFile(generatedTsPath, "utf8"),
      fs.readFile(docPath, "utf8"),
    ]);
    let drift = false;
    if (actualTs !== expectedTs) {
      console.error(
        `${repoPath(generatedTsPath)} is stale. Run: make live-projection-contract-sync`,
      );
      drift = true;
    }
    if (actualMarkdown !== expectedMarkdown) {
      console.error(`${repoPath(docPath)} is stale. Run: make live-projection-contract-sync`);
      drift = true;
    }
    if (drift) {
      process.exit(1);
    }
    console.log("live projection contract is up to date");
    return;
  }

  await fs.mkdir(path.dirname(generatedTsPath), { recursive: true });
  await Promise.all([
    fs.writeFile(generatedTsPath, expectedTs, "utf8"),
    fs.writeFile(docPath, expectedMarkdown, "utf8"),
  ]);
  console.log(`wrote ${repoPath(generatedTsPath)}`);
  console.log(`wrote ${repoPath(docPath)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
