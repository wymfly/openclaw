import { execFile } from "node:child_process";
import { spawn, type ChildProcess } from "node:child_process";
import { copyFile, mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";

const execFileAsync = promisify(execFile);
const thisFile = fileURLToPath(import.meta.url);
const deckRoot = path.resolve(path.dirname(thisFile), "../..");
const repoRoot = path.resolve(deckRoot, "..");
const backendRoot = path.join(deckRoot, "backend");
const frontendRoot = path.join(deckRoot, "frontend-new");
const mockGatewayEntry = path.join(deckRoot, "test/fixtures/mock-gateway.mjs");
const localNoProxy = "localhost,127.0.0.1,::1";
const openClawConfigFile = "openclaw.json";
const realGatewayPortPlaceholderPattern =
  /\{\{\s*gatewayPort\s*\}\}|\$\{\s*gatewayPort\s*\}|\{gatewayPort\}/g;
const maxBootstrapCopyBytes = 512 * 1024;
const maxSidecarCopyBytes = 1024 * 1024;
const realGatewayReadyTimeoutMs = Number(
  process.env.DECK_GO_REAL_GATEWAY_READY_TIMEOUT_MS ?? 420_000,
);
const workspaceBootstrapFiles = [
  "AGENTS.md",
  "SOUL.md",
  "TOOLS.md",
  "IDENTITY.md",
  "USER.md",
  "HEARTBEAT.md",
  "BOOTSTRAP.md",
  "MEMORY.md",
  "memory.md",
  "README.md",
] as const;
const stateSidecarFiles = [
  ".env",
  "oauth.json",
  "credentials.json",
  "credentials.enc.json",
  "secrets.json",
] as const;
const sensitiveKeyPattern = /token|secret|password|api[-_]?key|authorization|cookie|credential/i;

type JsonObject = Record<string, unknown>;
type WorkspaceCopy = {
  agentId: string;
  source?: string;
  target: string;
};

type ManagedProcess = {
  stop: () => Promise<void>;
  output: () => string;
};

export type E2EStack = {
  backendBase: string;
  frontendBase: string;
  requestLog: string;
  accessToken?: string;
  realE2E?: RealE2EIsolation;
  mockGateway?: {
    url: string;
    token: string;
  };
  realGateway?: {
    url: string;
    token: string;
  };
  stop: () => Promise<void>;
};

export type RealE2EIsolation = {
  runId: string;
  root: string;
  dataDir: string;
  logDir: string;
  gatewayStateDir: string;
  configPath: string;
  homeDir: string;
  workspaceRoot: string;
  evidenceDir: string;
  copiedConfig: boolean;
  sourceConfigPath?: string;
  sanitizedConfig?: RealE2EConfigSanitization;
};

export type RealE2EConfigSanitization = {
  removedChannels: string[];
  removedPluginEntries: string[];
  reason: string;
};

let backendBinaryPromise: Promise<string> | null = null;

async function buildBackendBinary() {
  if (!backendBinaryPromise) {
    backendBinaryPromise = (async () => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "deck-go-e2e-bin-"));
      const binary = path.join(dir, process.platform === "win32" ? "deck-go.exe" : "deck-go");
      await execFileAsync("go", ["build", "-o", binary, "./cmd/deck-go"], {
        cwd: backendRoot,
        env: {
          ...process.env,
          GOCACHE: process.env.GOCACHE ?? "/tmp/deck-go-buildcache",
          GOSUMDB: "off",
        },
      });
      return binary;
    })();
  }
  return backendBinaryPromise;
}

async function freePort() {
  return await new Promise<number>((resolve, reject) => {
    const server = http.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("failed to allocate a TCP port")));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

function spawnManaged(
  label: string,
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
): ManagedProcess {
  const chunks: string[] = [];
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const append = (data: Buffer) => chunks.push(data.toString());
  child.stdout?.on("data", append);
  child.stderr?.on("data", append);
  child.once("error", (error) => chunks.push(`[${label}] ${error.message}\n`));

  return {
    output: () => chunks.join(""),
    stop: async () => stopProcess(child),
  };
}

async function stopProcess(child: ChildProcess) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  try {
    if (process.platform === "win32") {
      child.kill("SIGTERM");
    } else {
      process.kill(-child.pid, "SIGTERM");
    }
  } catch {
    child.kill("SIGTERM");
  }
  const timedOut = await Promise.race([
    exited.then(() => false),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 5_000)),
  ]);
  if (timedOut) {
    try {
      if (process.platform === "win32") {
        child.kill("SIGKILL");
      } else {
        process.kill(-child.pid, "SIGKILL");
      }
    } catch {
      child.kill("SIGKILL");
    }
    await exited.catch(() => {});
  }
}

async function waitForHTTP(
  url: string,
  label: string,
  processOutput: () => string,
  accepts: (response: Response) => boolean = (response) => response.ok,
  options?: RequestInit,
) {
  const deadline = Date.now() + 30_000;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, options);
      if (accepts(response)) {
        return;
      }
      lastError = `${response.status} ${await response.text()}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${label} did not become ready: ${lastError}\n${processOutput()}`);
}

function deckTokenHeaders(accessToken?: string): Record<string, string> {
  return accessToken ? { "x-deck-token": accessToken } : {};
}

async function waitForCapabilities(backendBase: string, configured: boolean, accessToken?: string) {
  await expect
    .poll(
      async () => {
        const response = await fetch(`${backendBase}/api/runtime/capabilities`, {
          headers: deckTokenHeaders(accessToken),
        });
        if (!response.ok) {
          return null;
        }
        const payload = (await response.json()) as { configured?: boolean };
        return payload.configured;
      },
      { timeout: 30_000 },
    )
    .toBe(configured);
}

async function waitForBundledRuntime(backendBase: string, accessToken?: string) {
  await expect
    .poll(
      async () => {
        const response = await fetch(`${backendBase}/api/runtime/gateway`, {
          headers: deckTokenHeaders(accessToken),
        });
        if (!response.ok) {
          return 0;
        }
        const payload = (await response.json()) as { mode?: string; pid?: number };
        return payload.mode === "bundled" ? (payload.pid ?? 0) : 0;
      },
      { timeout: 180_000 },
    )
    .toBeGreaterThan(0);
}

async function recordGatewayHealthStartup(
  backendBase: string,
  accessToken: string | undefined,
  testInfo: TestInfo,
) {
  const samples: unknown[] = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${backendBase}/api/gateway/health`, {
        headers: deckTokenHeaders(accessToken),
      });
      const text = await response.text();
      samples.push({
        attempt,
        ok: response.ok,
        status: response.status,
        payload: parseJsonOrText(text),
      });
      if (response.ok) {
        break;
      }
    } catch (error) {
      samples.push({
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  await testInfo.attach("real-gateway-health-startup", {
    body: JSON.stringify(samples, null, 2),
    contentType: "application/json",
  });
}

async function waitForGatewayRPC(
  backendBase: string,
  accessToken: string | undefined,
  processOutput: () => string,
) {
  const deadline = Date.now() + realGatewayReadyTimeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${backendBase}/api/v1/runtimes/rt_local/gateway/rpc`, {
        method: "POST",
        headers: {
          ...deckTokenHeaders(accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ method: "agents.list", params: {} }),
      });
      const text = await response.text();
      if (response.ok) {
        const payload = parseJsonOrText(text) as { result?: { agents?: unknown[] } };
        if (Array.isArray(payload.result?.agents)) {
          return;
        }
      }
      lastError = `${response.status} ${text}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`gateway RPC did not become ready: ${lastError}\n${tailOutput(processOutput())}`);
}

function tailOutput(output: string) {
  return output.length > 40_000 ? output.slice(output.length - 40_000) : output;
}

function resolveRealGatewayLaunch(gatewayPort: number) {
  const command = process.env.DECK_GO_REAL_GATEWAY_COMMAND?.trim() || process.execPath;
  const argsTemplate =
    process.env.DECK_GO_REAL_GATEWAY_ARGS?.trim() ||
    "dist/entry.js gateway run --bind loopback --port {gatewayPort} --allow-unconfigured";
  const args = argsTemplate.replace(realGatewayPortPlaceholderPattern, String(gatewayPort));
  const workdir = process.env.DECK_GO_REAL_GATEWAY_WORKDIR?.trim() || repoRoot;

  if (isUnstableSourceGatewayLauncher(command, args)) {
    throw new Error(
      [
        "refusing to start real Gateway E2E through `pnpm openclaw` because it can trigger",
        "`scripts/run-node.mjs` dirty-tree rebuilds and runtime-postbuild dependency staging.",
        "Use the default direct-dist launcher or set DECK_GO_REAL_GATEWAY_COMMAND=node and",
        'DECK_GO_REAL_GATEWAY_ARGS="dist/entry.js gateway run --bind loopback --port {gatewayPort} --allow-unconfigured".',
        "Set DECK_GO_ALLOW_SOURCE_GATEWAY_LAUNCHER=1 only for a deliberate source-run diagnostic.",
      ].join(" "),
    );
  }

  return { command, args, workdir };
}

function isUnstableSourceGatewayLauncher(command: string, args: string) {
  if (process.env.DECK_GO_ALLOW_SOURCE_GATEWAY_LAUNCHER === "1") {
    return false;
  }
  const executable = path.basename(command).replace(/\.(?:cmd|exe)$/i, "");
  return executable === "pnpm" && /\bopenclaw\b/.test(args);
}

async function startFrontend(backendBase: string, frontendPort: number, accessToken?: string) {
  const frontendBase = `http://127.0.0.1:${frontendPort}`;
  const process = spawnManaged(
    "frontend",
    "npm",
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(frontendPort)],
    {
      cwd: frontendRoot,
      env: {
        ...processEnv(),
        VITE_DECK_GO_API_BASE: backendBase,
        VITE_DECK_VISUAL_STATE: "0",
        VITE_DECK_GO_ACCESS_TOKEN: accessToken ?? "",
        VITE_DECK_GO_AUTO_UNLOCK: accessToken ? "1" : "0",
      },
    },
  );
  await waitForHTTP(frontendBase, "frontend", process.output);
  return { frontendBase, process };
}

function processEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NO_PROXY: process.env.NO_PROXY ? `${localNoProxy},${process.env.NO_PROXY}` : localNoProxy,
    no_proxy: process.env.no_proxy ? `${localNoProxy},${process.env.no_proxy}` : localNoProxy,
    NPM_CONFIG_CACHE: process.env.NPM_CONFIG_CACHE ?? "/tmp/deck-go-npm-cache",
    npm_config_cache: process.env.npm_config_cache ?? "/tmp/deck-go-npm-cache",
  };
}

async function createStackDirs(testInfo: TestInfo, mode: string) {
  const root = await mkdtemp(path.join(os.tmpdir(), `deck-go-${mode}-e2e-`));
  const dataDir = path.join(root, "data");
  const logDir = path.join(root, "logs");
  await mkdir(dataDir, { recursive: true });
  await mkdir(logDir, { recursive: true });
  await testInfo.attach(`${mode}-stack-root`, {
    body: root,
    contentType: "text/plain",
  });
  return { root, dataDir, logDir };
}

export function buildRealE2ERunId(testInfo: Pick<TestInfo, "workerIndex" | "retry">) {
  return `deckgo-e2e-${Date.now().toString(36)}-w${testInfo.workerIndex}-r${testInfo.retry}`;
}

export async function prepareIsolatedOpenClawState(params: {
  root: string;
  dataDir: string;
  logDir: string;
  runId: string;
  gatewayToken?: string;
  testInfo?: TestInfo;
  sourceConfigPath?: string;
}): Promise<RealE2EIsolation> {
  const gatewayStateDir = path.join(params.dataDir, "managed-gateway-state");
  const homeDir = path.join(params.root, "openclaw-home");
  const workspaceRoot = path.join(params.root, "workspaces");
  const evidenceDir = path.join(params.root, "evidence");
  const configPath = path.join(gatewayStateDir, openClawConfigFile);
  await mkdir(gatewayStateDir, { recursive: true, mode: 0o700 });
  await mkdir(homeDir, { recursive: true, mode: 0o700 });
  await mkdir(workspaceRoot, { recursive: true, mode: 0o700 });
  await mkdir(evidenceDir, { recursive: true, mode: 0o700 });

  const sourceConfigPath =
    params.sourceConfigPath ?? (await resolveSourceOpenClawConfigPath(process.env));
  const defaultWorkspace = path.join(workspaceRoot, "main");
  let copiedConfig = false;
  let config: JsonObject;
  let workspaceCopies: WorkspaceCopy[];
  let sanitizedConfig: RealE2EConfigSanitization | undefined;

  if (sourceConfigPath) {
    const raw = await readFile(sourceConfigPath, "utf8");
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!isObject(parsed)) {
        throw new Error("config root is not an object");
      }
      config = parsed;
    } catch (error) {
      throw new Error(
        `real E2E source config must be JSON so workspaces can be isolated (${sourceConfigPath}): ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }
    workspaceCopies = rewriteOpenClawConfigForIsolation(config, {
      gatewayToken: params.gatewayToken,
      workspaceRoot,
      defaultWorkspace,
      sourceConfigPath,
      sourceHome: os.homedir(),
    });
    sanitizedConfig = sanitizeOpenClawConfigForRealSeed(config);
    await copyOpenClawSidecars(path.dirname(sourceConfigPath), gatewayStateDir);
    copiedConfig = true;
  } else {
    config = {
      agents: {
        defaults: {
          workspace: defaultWorkspace,
        },
        list: [
          {
            id: "main",
            default: true,
            name: "Main",
            workspace: defaultWorkspace,
          },
        ],
      },
    };
    if (params.gatewayToken) {
      rewriteGatewayAuthToken(config, params.gatewayToken);
    }
    sanitizedConfig = sanitizeOpenClawConfigForRealSeed(config);
    workspaceCopies = [{ agentId: "main", target: defaultWorkspace }];
  }

  await Promise.all(workspaceCopies.map((copy) => copyWorkspaceBootstrap(copy, params.runId)));
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  const isolation: RealE2EIsolation = {
    runId: params.runId,
    root: params.root,
    dataDir: params.dataDir,
    logDir: params.logDir,
    gatewayStateDir,
    configPath,
    homeDir,
    workspaceRoot,
    evidenceDir,
    copiedConfig,
    sourceConfigPath,
    sanitizedConfig,
  };

  await writeRealE2EIsolationManifest(isolation);
  if (params.testInfo) {
    await params.testInfo.attach("real-e2e-isolation", {
      body: JSON.stringify(redactSecrets(isolation), null, 2),
      contentType: "application/json",
    });
  }
  return isolation;
}

async function resolveSourceOpenClawConfigPath(env: NodeJS.ProcessEnv) {
  const explicit = env.DECK_GO_REAL_E2E_SOURCE_CONFIG?.trim();
  if (explicit) {
    const resolved = resolveUserPath(explicit, os.homedir());
    if (!(await pathExists(resolved))) {
      throw new Error(`DECK_GO_REAL_E2E_SOURCE_CONFIG does not exist: ${resolved}`);
    }
    return resolved;
  }

  const candidates = [
    env.OPENCLAW_CONFIG_PATH,
    env.OPENCLAW_STATE_DIR
      ? path.join(resolveUserPath(env.OPENCLAW_STATE_DIR, os.homedir()), openClawConfigFile)
      : "",
    path.join(os.homedir(), ".openclaw", openClawConfigFile),
    path.join(os.homedir(), ".clawdbot", "clawdbot.json"),
  ];
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const resolved = resolveUserPath(candidate, os.homedir());
    if (await pathExists(resolved)) {
      return resolved;
    }
  }
  return undefined;
}

function rewriteOpenClawConfigForIsolation(
  config: JsonObject,
  params: {
    gatewayToken?: string;
    workspaceRoot: string;
    defaultWorkspace: string;
    sourceConfigPath: string;
    sourceHome: string;
  },
): WorkspaceCopy[] {
  if (params.gatewayToken) {
    rewriteGatewayAuthToken(config, params.gatewayToken);
  }
  const agents = ensureObject(config, "agents");
  const defaults = ensureObject(agents, "defaults");
  const sourceDefaultWorkspace =
    readString(defaults.workspace) ?? path.join(params.sourceHome, ".openclaw", "workspace");
  const sourceDefaultRepoRoot = readString(defaults.repoRoot);
  defaults.workspace = params.defaultWorkspace;
  if (sourceDefaultRepoRoot) {
    defaults.repoRoot = params.defaultWorkspace;
  }

  const workspaceCopies: WorkspaceCopy[] = [
    {
      agentId: "defaults",
      source: resolvePossiblyRelativePath(sourceDefaultWorkspace, params.sourceHome),
      target: params.defaultWorkspace,
    },
  ];

  const list = Array.isArray(agents.list) ? agents.list : [];
  if (list.length === 0) {
    agents.list = [
      {
        id: "main",
        default: true,
        name: "Main",
        workspace: params.defaultWorkspace,
      },
    ];
    workspaceCopies.push({
      agentId: "main",
      source: resolvePossiblyRelativePath(sourceDefaultWorkspace, params.sourceHome),
      target: params.defaultWorkspace,
    });
    return uniqueWorkspaceCopies(workspaceCopies);
  }

  let hasMain = false;
  const nextList: unknown[] = [];
  for (const [index, entry] of list.entries()) {
    if (!isObject(entry)) {
      nextList.push(entry);
      continue;
    }
    const agentId = readString(entry.id) ?? `agent-${index + 1}`;
    hasMain = hasMain || agentId === "main";
    const target = path.join(params.workspaceRoot, sanitizePathSegment(agentId));
    const source = readString(entry.workspace) ?? sourceDefaultWorkspace;
    entry.workspace = target;
    rewriteAgentRuntimeCwd(entry, target);
    workspaceCopies.push({
      agentId,
      source: resolvePossiblyRelativePath(source, params.sourceHome),
      target,
    });
    nextList.push(entry);
  }
  if (!hasMain) {
    nextList.push({
      id: "main",
      default: true,
      name: "Main",
      workspace: params.defaultWorkspace,
    });
    workspaceCopies.push({
      agentId: "main",
      source: resolvePossiblyRelativePath(sourceDefaultWorkspace, params.sourceHome),
      target: params.defaultWorkspace,
    });
  }
  agents.list = nextList;
  return uniqueWorkspaceCopies(workspaceCopies);
}

function rewriteGatewayAuthToken(config: JsonObject, gatewayToken: string) {
  const gateway = ensureObject(config, "gateway");
  const auth = ensureObject(gateway, "auth");
  auth.mode = "token";
  auth.token = gatewayToken;
}

function sanitizeOpenClawConfigForRealSeed(config: JsonObject): RealE2EConfigSanitization {
  const sanitization: RealE2EConfigSanitization = {
    removedChannels: [],
    removedPluginEntries: [],
    reason:
      "real E2E seed runs chat/session through cpa + main; external channel accounts are skipped-safe in the isolated copy",
  };
  if (process.env.DECK_GO_REAL_E2E_PRESERVE_CHANNELS === "1") {
    return sanitization;
  }

  if (isObject(config.channels)) {
    sanitization.removedChannels = Object.keys(config.channels).toSorted();
    delete config.channels;
  }

  if (sanitization.removedChannels.length > 0 && isObject(config.plugins)) {
    const plugins = config.plugins;
    if (isObject(plugins.entries)) {
      for (const channelId of sanitization.removedChannels) {
        if (Object.prototype.hasOwnProperty.call(plugins.entries, channelId)) {
          delete plugins.entries[channelId];
          sanitization.removedPluginEntries.push(channelId);
        }
      }
      sanitization.removedPluginEntries.sort();
    }
  }
  return sanitization;
}

function rewriteAgentRuntimeCwd(agent: JsonObject, targetWorkspace: string) {
  if (!isObject(agent.runtime)) {
    return;
  }
  const runtime = agent.runtime;
  if (!isObject(runtime.acp)) {
    return;
  }
  runtime.acp.cwd = targetWorkspace;
}

async function copyWorkspaceBootstrap(copy: WorkspaceCopy, runId: string) {
  await mkdir(copy.target, { recursive: true, mode: 0o700 });
  let copied = 0;
  if (copy.source && (await pathExists(copy.source))) {
    for (const name of workspaceBootstrapFiles) {
      const sourceFile = path.join(copy.source, name);
      const targetFile = path.join(copy.target, name);
      if (await copyFileIfSmall(sourceFile, targetFile, maxBootstrapCopyBytes)) {
        copied += 1;
      }
    }
  }
  if (copied === 0) {
    await writeFile(
      path.join(copy.target, "AGENTS.md"),
      [
        "# deck-go isolated real E2E workspace",
        "",
        `Run id: ${runId}`,
        `Agent id: ${copy.agentId}`,
        "",
        "This workspace is a temporary copy used by deck-go real E2E tests.",
        "",
      ].join("\n"),
      { encoding: "utf8", mode: 0o600 },
    );
  }
  await writeFile(
    path.join(copy.target, ".deck-go-e2e-run.json"),
    `${JSON.stringify({ agentId: copy.agentId, runId, source: copy.source ?? null }, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
}

async function copyOpenClawSidecars(sourceDir: string, targetDir: string) {
  await Promise.all(
    stateSidecarFiles.map((name) =>
      copyFileIfSmall(path.join(sourceDir, name), path.join(targetDir, name), maxSidecarCopyBytes),
    ),
  );
}

async function copyFileIfSmall(source: string, target: string, maxBytes: number) {
  try {
    const info = await stat(source);
    if (!info.isFile() || info.size > maxBytes) {
      return false;
    }
    await copyFile(source, target);
    return true;
  } catch {
    return false;
  }
}

async function writeRealE2EIsolationManifest(isolation: RealE2EIsolation) {
  await writeFile(
    path.join(isolation.evidenceDir, "isolation.json"),
    `${JSON.stringify(redactSecrets(isolation), null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
}

function uniqueWorkspaceCopies(copies: WorkspaceCopy[]) {
  const byTarget = new Map<string, WorkspaceCopy>();
  for (const copy of copies) {
    if (byTarget.has(copy.target)) {
      byTarget.delete(copy.target);
    }
    byTarget.set(copy.target, copy);
  }
  return Array.from(byTarget.values());
}

function ensureObject(parent: JsonObject, key: string): JsonObject {
  const current = parent[key];
  if (isObject(current)) {
    return current;
  }
  const next: JsonObject = {};
  parent[key] = next;
  return next;
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveUserPath(input: string, home: string) {
  if (input === "~") {
    return path.resolve(home);
  }
  if (input.startsWith("~/")) {
    return path.resolve(home, input.slice(2));
  }
  return path.resolve(input);
}

function resolvePossiblyRelativePath(input: string, home: string) {
  return resolveUserPath(input, home);
}

async function pathExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function sanitizePathSegment(value: string) {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "resource"
  );
}

export function buildRunScopedName(runId: string, label: string) {
  const suffix = sanitizePathSegment(label);
  return `${runId}-${suffix}`.slice(0, 140);
}

export function isRunScopedValue(value: unknown, runId: string): boolean {
  if (typeof value === "string") {
    return value.includes(runId);
  }
  if (Array.isArray(value)) {
    return value.some((entry) => isRunScopedValue(entry, runId));
  }
  if (!isObject(value)) {
    return false;
  }
  for (const key of ["id", "name", "label", "title", "description", "runId"]) {
    if (isRunScopedValue(value[key], runId)) {
      return true;
    }
  }
  if (isObject(value.metadata) && isRunScopedValue(value.metadata.deckGoE2ERunId, runId)) {
    return true;
  }
  return false;
}

export function filterRunScopedResources<T>(resources: T[], runId: string): T[] {
  return resources.filter((resource) => isRunScopedValue(resource, runId));
}

export function assertRunScopedCleanupTarget(resource: unknown, runId: string) {
  if (!isRunScopedValue(resource, runId)) {
    throw new Error(`refusing to clean up resource without current real E2E run id ${runId}`);
  }
}

export const unsafeRealE2EFixtureClasses = [
  "channel accounts",
  "installed skills",
  "device tokens",
  "user memory mutations",
] as const;

export const deferredRealE2EFixtureClasses = ["routing bindings", "docs registry entries"] as const;

export const realE2EEvidenceStatuses = [
  "passed",
  "degraded",
  "empty-valid",
  "skipped-safe",
  "handoff-blocked",
] as const;

export type RealE2EEvidenceStatus = (typeof realE2EEvidenceStatuses)[number];

export type BudgetRuleFixture = {
  id: string;
  name: string;
  runId: string;
};

export type AlertRuleFixture = {
  id: string;
  name: string;
  runId: string;
};

export type AgentFixture = {
  id: string;
  name: string;
  runId: string;
  workspace: string;
};

export type ExecApprovalFixture = {
  id: string;
  command: string;
  runId: string;
};

export type WebhookFixture = {
  id: string;
  name: string;
  runId: string;
};

export function buildRealE2EFixtureName(
  stack: Pick<E2EStack, "realE2E">,
  label: string,
  fallbackRunId = "deckgo-e2e-unknown",
) {
  return buildRunScopedName(stack.realE2E?.runId ?? fallbackRunId, label);
}

export async function createBudgetRuleFixture(
  request: APIRequestContext,
  stack: Pick<E2EStack, "accessToken" | "backendBase" | "realE2E">,
  label: string,
  overrides: Partial<{
    dimension: string;
    enabled: boolean;
    overThreshold: number;
    period: string;
    scope: string;
    warnThreshold: number;
  }> = {},
): Promise<BudgetRuleFixture> {
  const runId = stack.realE2E?.runId ?? "deckgo-e2e-unknown";
  const name = buildRunScopedName(runId, label);
  const response = await request.post(`${stack.backendBase}/api/usage/budget`, {
    headers: deckTokenHeaders(stack.accessToken),
    data: {
      name,
      scope: overrides.scope ?? "global",
      dimension: overrides.dimension ?? "cost",
      warnThreshold: overrides.warnThreshold ?? 100,
      overThreshold: overrides.overThreshold ?? 200,
      period: overrides.period ?? "monthly",
      enabled: overrides.enabled ?? false,
    },
  });
  expect(response.ok(), `/usage/budget fixture create returned ${response.status()}`).toBe(true);
  const payload = (await response.json()) as { id?: unknown; name?: unknown };
  expect(payload.name).toBe(name);
  expect(typeof payload.id).toBe("string");
  const fixture = { id: String(payload.id), name, runId };
  assertRunScopedCleanupTarget(fixture, runId);
  return fixture;
}

export async function deleteBudgetRuleFixture(
  request: APIRequestContext,
  stack: Pick<E2EStack, "accessToken" | "backendBase" | "realE2E">,
  fixture: BudgetRuleFixture,
) {
  const runId = stack.realE2E?.runId ?? fixture.runId;
  assertRunScopedCleanupTarget(fixture, runId);
  const response = await request.delete(
    `${stack.backendBase}/api/usage/budget/${encodeURIComponent(fixture.id)}`,
    { headers: deckTokenHeaders(stack.accessToken) },
  );
  expect(response.ok(), `/usage/budget fixture cleanup returned ${response.status()}`).toBe(true);
}

export async function createAlertRuleFixture(
  request: APIRequestContext,
  stack: Pick<E2EStack, "accessToken" | "backendBase" | "realE2E">,
  label: string,
  overrides: Partial<{
    action: string;
    condition: string;
    cooldownMs: number;
    enabled: boolean;
    entityType: string;
    threshold: number;
  }> = {},
): Promise<AlertRuleFixture> {
  const runId = stack.realE2E?.runId ?? "deckgo-e2e-unknown";
  const name = buildRunScopedName(runId, label);
  const response = await request.post(`${stack.backendBase}/api/alerts`, {
    headers: deckTokenHeaders(stack.accessToken),
    data: {
      name,
      entityType: overrides.entityType ?? "usage",
      condition: overrides.condition ?? "usage_pct > threshold",
      threshold: overrides.threshold ?? 72,
      action: overrides.action ?? "toast",
      cooldownMs: overrides.cooldownMs ?? 300000,
      enabled: overrides.enabled ?? true,
    },
  });
  expect(response.ok(), `/alerts fixture create returned ${response.status()}`).toBe(true);
  const payload = (await response.json()) as {
    rule?: { id?: unknown; name?: unknown };
  };
  expect(payload.rule?.name).toBe(name);
  expect(typeof payload.rule?.id).toBe("string");
  const fixture = { id: String(payload.rule?.id), name, runId };
  assertRunScopedCleanupTarget(fixture, runId);
  return fixture;
}

export async function deleteAlertRuleFixture(
  request: APIRequestContext,
  stack: Pick<E2EStack, "accessToken" | "backendBase" | "realE2E">,
  fixture: AlertRuleFixture,
) {
  const runId = stack.realE2E?.runId ?? fixture.runId;
  assertRunScopedCleanupTarget(fixture, runId);
  const response = await request.delete(
    `${stack.backendBase}/api/alerts/${encodeURIComponent(fixture.id)}`,
    { headers: deckTokenHeaders(stack.accessToken) },
  );
  expect(response.ok(), `/alerts fixture cleanup returned ${response.status()}`).toBe(true);
}

export async function createAgentFixture(
  request: APIRequestContext,
  stack: Pick<E2EStack, "accessToken" | "backendBase" | "realE2E">,
  label: string,
  overrides: Partial<{
    emoji: string;
    model: string;
    workspace: string;
  }> = {},
): Promise<AgentFixture> {
  const runId = stack.realE2E?.runId ?? "deckgo-e2e-unknown";
  const name = buildRunScopedName(runId, label);
  const workspace =
    overrides.workspace ??
    path.join(stack.realE2E?.workspaceRoot ?? os.tmpdir(), "fixtures", sanitizePathSegment(name));
  const response = await request.post(`${stack.backendBase}/api/agents`, {
    headers: deckTokenHeaders(stack.accessToken),
    data: {
      name,
      workspace,
      ...(overrides.model ? { model: overrides.model } : {}),
      ...(overrides.emoji ? { emoji: overrides.emoji } : {}),
    },
  });
  expect(response.ok(), `/agents fixture create returned ${response.status()}`).toBe(true);
  const payload = (await response.json()) as {
    agentId?: unknown;
    id?: unknown;
    name?: unknown;
    workspace?: unknown;
  };
  const id = typeof payload.id === "string" ? payload.id : payload.agentId;
  expect(typeof id).toBe("string");
  const fixture = {
    id: String(id),
    name: typeof payload.name === "string" ? payload.name : name,
    runId,
    workspace: typeof payload.workspace === "string" ? payload.workspace : workspace,
  };
  assertRunScopedCleanupTarget(fixture, runId);
  return fixture;
}

export async function deleteAgentFixture(
  request: APIRequestContext,
  stack: Pick<E2EStack, "accessToken" | "backendBase" | "realE2E">,
  fixture: AgentFixture,
) {
  const runId = stack.realE2E?.runId ?? fixture.runId;
  assertRunScopedCleanupTarget(fixture, runId);
  const response = await request.delete(
    `${stack.backendBase}/api/agents?agentId=${encodeURIComponent(fixture.id)}`,
    { headers: deckTokenHeaders(stack.accessToken) },
  );
  expect(response.ok(), `/agents fixture cleanup returned ${response.status()}`).toBe(true);
}

export async function createExecApprovalFixture(
  request: APIRequestContext,
  stack: Pick<E2EStack, "accessToken" | "backendBase" | "realE2E">,
  label: string,
  overrides: Partial<{
    agentId: string;
    cwd: string;
    timeoutMs: number;
  }> = {},
): Promise<ExecApprovalFixture> {
  const runId = stack.realE2E?.runId ?? "deckgo-e2e-unknown";
  const id = buildRunScopedName(runId, label);
  const command = `echo ${id}`;
  const rpc = await callRuntimeGatewayRpc(request, stack, "exec.approval.request", {
    id,
    command,
    commandArgv: ["echo", id],
    cwd: overrides.cwd ?? stack.realE2E?.workspaceRoot ?? os.tmpdir(),
    agentId: overrides.agentId ?? "main",
    sessionKey: buildRunScopedName(runId, `${label}-session`),
    ask: "always",
    security: "deny",
    timeoutMs: overrides.timeoutMs ?? 300_000,
    twoPhase: true,
  });
  const result = isObject(rpc.result) ? rpc.result : {};
  const fixture = {
    id: typeof result.id === "string" ? result.id : id,
    command,
    runId,
  };
  assertRunScopedCleanupTarget(fixture, runId);
  return fixture;
}

export async function resolveExecApprovalFixture(
  request: APIRequestContext,
  stack: Pick<E2EStack, "accessToken" | "backendBase" | "realE2E">,
  fixture: ExecApprovalFixture,
  decision: "allow-once" | "allow-always" | "deny" = "deny",
  options: { allowMissing?: boolean } = {},
) {
  const runId = stack.realE2E?.runId ?? fixture.runId;
  assertRunScopedCleanupTarget(fixture, runId);
  const pending = await request.get(`${stack.backendBase}/api/approvals/pending`, {
    headers: deckTokenHeaders(stack.accessToken),
  });
  if (pending.ok()) {
    const payload = (await pending.json()) as { pending?: Array<{ id?: unknown }> };
    const stillPending = (payload.pending ?? []).some((entry) => entry.id === fixture.id);
    if (!stillPending) {
      if (options.allowMissing) {
        return;
      }
      throw new Error(`exec approval fixture ${fixture.id} is not pending`);
    }
  } else if (options.allowMissing) {
    return;
  }
  const response = await request.post(`${stack.backendBase}/api/approvals`, {
    headers: deckTokenHeaders(stack.accessToken),
    data: { id: fixture.id, decision },
  });
  if (options.allowMissing && !response.ok()) {
    return;
  }
  expect(response.ok(), `/approvals fixture resolve returned ${response.status()}`).toBe(true);
}

export async function createWebhookFixture(
  request: APIRequestContext,
  stack: Pick<E2EStack, "accessToken" | "backendBase" | "realE2E">,
  label: string,
  params: {
    url: string;
    enabled?: boolean;
    events?: string[];
    secret?: string;
  },
): Promise<WebhookFixture> {
  const runId = stack.realE2E?.runId ?? "deckgo-e2e-unknown";
  const name = buildRunScopedName(runId, label);
  const response = await request.post(`${stack.backendBase}/api/webhooks`, {
    headers: deckTokenHeaders(stack.accessToken),
    data: {
      enabled: params.enabled ?? true,
      events: params.events ?? ["alert.fired", "test.ping"],
      name,
      secret: params.secret ?? "real-secret",
      url: params.url,
    },
  });
  expect(response.ok(), `/webhooks fixture create returned ${response.status()}`).toBe(true);
  const payload = (await response.json()) as { id?: unknown; name?: unknown; secret?: unknown };
  expect(payload.name).toBe(name);
  expect(payload.secret).toBe("***redacted");
  expect(typeof payload.id).toBe("string");
  const fixture = { id: String(payload.id), name, runId };
  assertRunScopedCleanupTarget(fixture, runId);
  return fixture;
}

export async function deleteWebhookFixture(
  request: APIRequestContext,
  stack: Pick<E2EStack, "accessToken" | "backendBase" | "realE2E">,
  fixture: WebhookFixture,
) {
  const runId = stack.realE2E?.runId ?? fixture.runId;
  assertRunScopedCleanupTarget(fixture, runId);
  const response = await request.delete(
    `${stack.backendBase}/api/webhooks/${encodeURIComponent(fixture.id)}`,
    { headers: deckTokenHeaders(stack.accessToken) },
  );
  expect(response.ok(), `/webhooks fixture cleanup returned ${response.status()}`).toBe(true);
}

export function isRealE2EEvidenceStatus(value: unknown): value is RealE2EEvidenceStatus {
  return (
    typeof value === "string" && realE2EEvidenceStatuses.includes(value as RealE2EEvidenceStatus)
  );
}

export function normalizeRealE2EScenarioEvidence(evidence: JsonObject): JsonObject {
  const scenarioId = readString(evidence.scenarioId);
  const runId = readString(evidence.runId);
  if (!scenarioId) {
    throw new Error("real E2E scenario evidence requires scenarioId");
  }
  if (!runId) {
    throw new Error(`real E2E scenario ${scenarioId} requires runId`);
  }
  if (!isRealE2EEvidenceStatus(evidence.status)) {
    throw new Error(
      `real E2E scenario ${scenarioId} has invalid status ${String(evidence.status)}`,
    );
  }

  const attempts = Array.isArray(evidence.attempts) ? evidence.attempts : [];
  const maxAttempts =
    typeof evidence.maxAttempts === "number" && Number.isInteger(evidence.maxAttempts)
      ? evidence.maxAttempts
      : undefined;
  if (maxAttempts !== undefined && (maxAttempts < 0 || attempts.length > maxAttempts)) {
    throw new Error(
      `real E2E scenario ${scenarioId} recorded ${attempts.length} attempts over max ${maxAttempts}`,
    );
  }

  return {
    ...evidence,
    scenarioId,
    runId,
    status: evidence.status,
    attemptCount: attempts.length,
    ...(maxAttempts !== undefined ? { maxAttempts } : {}),
  };
}

export async function writeRealE2EScenarioEvidence(
  stack: Pick<E2EStack, "realE2E">,
  name: string,
  evidence: JsonObject,
  testInfo?: TestInfo,
) {
  return writeRealE2EEvidence(stack, name, normalizeRealE2EScenarioEvidence(evidence), testInfo);
}

export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSecrets(entry));
  }
  if (!isObject(value)) {
    if (typeof value === "string" && /^Bearer\s+\S+/i.test(value)) {
      return "Bearer ***redacted***";
    }
    return value;
  }
  const redacted: JsonObject = {};
  for (const [key, entry] of Object.entries(value)) {
    redacted[key] = sensitiveKeyPattern.test(key) ? "***redacted***" : redactSecrets(entry);
  }
  return redacted;
}

export async function writeRealE2EEvidence(
  stack: Pick<E2EStack, "realE2E">,
  name: string,
  evidence: unknown,
  testInfo?: TestInfo,
) {
  const evidenceDir =
    stack.realE2E?.evidenceDir ?? path.join(os.tmpdir(), "deck-go-real-e2e-evidence");
  await mkdir(evidenceDir, { recursive: true, mode: 0o700 });
  const evidenceName = sanitizePathSegment(name);
  const redactedEvidence = redactSecrets(evidence);
  const evidencePath = path.join(evidenceDir, `${evidenceName}.json`);
  await writeFile(evidencePath, `${JSON.stringify(redactedEvidence, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  const persistentEvidenceDir = process.env.DECK_GO_REAL_E2E_EVIDENCE_DIR?.trim();
  if (persistentEvidenceDir) {
    const runId = sanitizePathSegment(stack.realE2E?.runId ?? "no-run-id");
    const persistentDir = resolveUserPath(persistentEvidenceDir, os.homedir());
    await mkdir(persistentDir, { recursive: true, mode: 0o700 });
    await writeFile(
      path.join(persistentDir, `${runId}-${evidenceName}.json`),
      `${JSON.stringify(redactedEvidence, null, 2)}\n`,
      {
        encoding: "utf8",
        mode: 0o600,
      },
    );
  }
  if (testInfo) {
    await testInfo.attach(name, {
      path: evidencePath,
      contentType: "application/json",
    });
  }
  return evidencePath;
}

export async function startBundledStack(testInfo: TestInfo): Promise<E2EStack> {
  const { root, dataDir, logDir } = await createStackDirs(testInfo, "bundled");
  const backendPort = await freePort();
  const frontendPort = await freePort();
  const gatewayPort = await freePort();
  const backendBase = `http://127.0.0.1:${backendPort}`;
  const requestLog = path.join(logDir, "mock-gateway-requests.jsonl");
  const binary = await buildBackendBinary();
  const token = "bundled-e2e-gateway-token";

  const backend = spawnManaged("backend", binary, [], {
    cwd: deckRoot,
    env: {
      ...processEnv(),
      DECK_GO_ACCESS_TOKEN: "",
      DECK_GO_ADDR: `127.0.0.1:${backendPort}`,
      DECK_GO_DATA_DIR: dataDir,
      DECK_STATE_PATH: path.join(dataDir, "deck-state.json"),
      RUNTIME_ADMIN_SOCKET: path.join(dataDir, "admin.sock"),
      RUNTIME_MODE: "bundled",
      RUNTIME_BUNDLED_COMMAND: process.execPath,
      RUNTIME_BUNDLED_ARGS: "test/fixtures/mock-gateway.mjs",
      RUNTIME_BUNDLED_WORKDIR: deckRoot,
      RUNTIME_BUNDLED_BIND_HOST: "127.0.0.1",
      RUNTIME_BUNDLED_BIND_PORT: String(gatewayPort),
      RUNTIME_BUNDLED_TOKEN: token,
      RUNTIME_BUNDLED_AUTO_START: "true",
      RUNTIME_BUNDLED_ENV_MOCK_GATEWAY_PORT: String(gatewayPort),
      RUNTIME_BUNDLED_ENV_MOCK_GATEWAY_TOKEN: token,
      RUNTIME_BUNDLED_ENV_MOCK_GATEWAY_REQUEST_LOG: requestLog,
    },
  });
  const cleanup: Array<() => Promise<void>> = [backend.stop];
  try {
    await waitForHTTP(`${backendBase}/healthz`, "backend", backend.output);
    await waitForBundledRuntime(backendBase);
    const frontend = await startFrontend(backendBase, frontendPort);
    cleanup.push(frontend.process.stop);
    return {
      backendBase,
      frontendBase: frontend.frontendBase,
      requestLog,
      stop: async () => {
        for (const stop of cleanup.toReversed()) {
          await stop();
        }
        await rm(root, { recursive: true, force: true });
      },
    };
  } catch (error) {
    const output = backend.output();
    await writeFile(path.join(logDir, "backend-output.log"), output, {
      encoding: "utf8",
      mode: 0o600,
    }).catch(() => {});
    await testInfo
      .attach("real-gateway-backend-output", {
        body: output,
        contentType: "text/plain",
      })
      .catch(() => {});
    for (const stop of cleanup.toReversed()) {
      await stop();
    }
    throw error;
  }
}

export async function startRemoteFirstRunStack(testInfo: TestInfo): Promise<E2EStack> {
  const { root, dataDir, logDir } = await createStackDirs(testInfo, "remote");
  const backendPort = await freePort();
  const frontendPort = await freePort();
  const gatewayPort = await freePort();
  const backendBase = `http://127.0.0.1:${backendPort}`;
  const requestLog = path.join(logDir, "mock-gateway-requests.jsonl");
  const binary = await buildBackendBinary();
  const token = "remote-e2e-gateway-token";

  const mockGateway = await startMockGatewayProcess(gatewayPort, token, requestLog);
  const backend = spawnManaged("backend", binary, [], {
    cwd: deckRoot,
    env: {
      ...processEnv(),
      DECK_GO_ACCESS_TOKEN: "",
      DECK_GO_ADDR: `127.0.0.1:${backendPort}`,
      DECK_GO_DATA_DIR: dataDir,
      DECK_STATE_PATH: path.join(dataDir, "deck-state.json"),
      RUNTIME_ADMIN_SOCKET: path.join(dataDir, "admin.sock"),
      RUNTIME_MODE: "remote",
      RUNTIME_REMOTE_URL: "",
      RUNTIME_REMOTE_TOKEN: "",
      RUNTIME_REMOTE_TLS_VERIFY: "true",
    },
  });
  const cleanup: Array<() => Promise<void>> = [backend.stop, mockGateway.process.stop];
  try {
    await waitForHTTP(`${backendBase}/healthz`, "backend", backend.output);
    await waitForCapabilities(backendBase, false);
    const frontend = await startFrontend(backendBase, frontendPort);
    cleanup.push(frontend.process.stop);
    return {
      backendBase,
      frontendBase: frontend.frontendBase,
      requestLog,
      mockGateway: {
        url: mockGateway.url,
        token,
      },
      stop: async () => {
        for (const stop of cleanup.toReversed()) {
          await stop();
        }
        await rm(root, { recursive: true, force: true });
      },
    };
  } catch (error) {
    for (const stop of cleanup.toReversed()) {
      await stop();
    }
    throw error;
  }
}

async function startMockGatewayProcess(port: number, token: string, requestLog: string) {
  const mockProcess = spawnManaged("mock-gateway", process.execPath, [mockGatewayEntry], {
    cwd: deckRoot,
    env: {
      ...processEnv(),
      MOCK_GATEWAY_PORT: String(port),
      MOCK_GATEWAY_TOKEN: token,
      MOCK_GATEWAY_REQUEST_LOG: requestLog,
    },
  });
  const url = `http://127.0.0.1:${port}`;
  await waitForHTTP(url, "mock gateway", mockProcess.output, () => true).catch(async () => {
    await mockProcess.stop();
    throw new Error(`mock gateway did not start\n${mockProcess.output()}`);
  });
  return { url, process: mockProcess };
}

export async function startRealGatewayStack(testInfo: TestInfo): Promise<E2EStack> {
  const { root, dataDir, logDir } = await createStackDirs(testInfo, "real-gateway");
  const backendPort = await freePort();
  const frontendPort = await freePort();
  const gatewayPort = await freePort();
  const backendBase = `http://127.0.0.1:${backendPort}`;
  const requestLog = path.join(logDir, "real-gateway-requests.jsonl");
  const binary = await buildBackendBinary();
  const accessToken = `real-e2e-deck-token-${testInfo.workerIndex}`;
  const gatewayToken = `real-e2e-gateway-token-${testInfo.workerIndex}`;
  const gatewayLaunch = resolveRealGatewayLaunch(gatewayPort);
  const realE2E = await prepareIsolatedOpenClawState({
    root,
    dataDir,
    logDir,
    gatewayToken,
    runId: buildRealE2ERunId(testInfo),
    testInfo,
  });

  const backend = spawnManaged("backend", binary, [], {
    cwd: deckRoot,
    env: {
      ...processEnv(),
      DECK_GO_ACCESS_TOKEN: accessToken,
      DECK_GO_ADDR: `127.0.0.1:${backendPort}`,
      DECK_GO_DATA_DIR: dataDir,
      DECK_STATE_PATH: path.join(dataDir, "deck-state.json"),
      RUNTIME_ADMIN_SOCKET: path.join(dataDir, "admin.sock"),
      RUNTIME_MODE: "bundled",
      RUNTIME_BUNDLED_COMMAND: gatewayLaunch.command,
      RUNTIME_BUNDLED_ARGS: gatewayLaunch.args,
      RUNTIME_BUNDLED_WORKDIR: gatewayLaunch.workdir,
      RUNTIME_BUNDLED_BIND_HOST: "127.0.0.1",
      RUNTIME_BUNDLED_BIND_PORT: String(gatewayPort),
      RUNTIME_BUNDLED_TOKEN: gatewayToken,
      RUNTIME_BUNDLED_AUTO_START: "true",
      RUNTIME_BUNDLED_ENV_OPENCLAW_CONFIG_PATH: realE2E.configPath,
      RUNTIME_BUNDLED_ENV_OPENCLAW_HOME: realE2E.homeDir,
      RUNTIME_BUNDLED_ENV_NO_PROXY: localNoProxy,
    },
  });
  const cleanup: Array<() => Promise<void>> = [backend.stop];
  try {
    await waitForHTTP(`${backendBase}/healthz`, "backend", backend.output);
    await waitForBundledRuntime(backendBase, accessToken);
    await recordGatewayHealthStartup(backendBase, accessToken, testInfo);
    await waitForGatewayRPC(backendBase, accessToken, backend.output);
    const frontend = await startFrontend(backendBase, frontendPort, accessToken);
    cleanup.push(frontend.process.stop);
    return {
      backendBase,
      frontendBase: frontend.frontendBase,
      requestLog,
      accessToken,
      realE2E,
      realGateway: {
        url: `http://127.0.0.1:${gatewayPort}`,
        token: gatewayToken,
      },
      stop: async () => {
        for (const stop of cleanup.toReversed()) {
          await stop();
        }
        await rm(root, { recursive: true, force: true });
      },
    };
  } catch (error) {
    for (const stop of cleanup.toReversed()) {
      await stop();
    }
    throw error;
  }
}

export async function openDeck(
  page: Page,
  frontendBase: string,
  panel: string,
  accessToken?: string,
  options: {
    deckVisualState?: string;
    locale?: "en" | "zh";
    nav?: "expanded" | "collapsed";
    theme?: "dark" | "light" | "system";
  } = {},
) {
  const token = accessToken ?? null;
  const locale = options.locale ?? "en";
  const sidebarCollapsed = options.nav === "collapsed" ? "true" : "false";
  const theme = options.theme ?? null;
  await page.addInitScript(
    ({ localeValue, sidebarCollapsedValue, themeValue }) => {
      try {
        document.cookie = `NEXT_LOCALE=${localeValue};path=/;max-age=31536000`;
        window.localStorage.setItem("deckGoLocale", localeValue);
        window.localStorage.setItem("deckGoSidebarCollapsed", sidebarCollapsedValue);
        window.localStorage.removeItem("deckGoActivePanel");
        if (themeValue) {
          window.localStorage.setItem("deckGoThemeMode", themeValue);
          window.localStorage.setItem("openclaw-deck-theme", themeValue);
        }
      } catch {
        // Playwright init scripts also run in data: iframes used by visual seeds.
      }
    },
    { localeValue: locale, sidebarCollapsedValue: sidebarCollapsed, themeValue: theme },
  );
  if (token) {
    await page.addInitScript((value) => {
      try {
        window.localStorage.setItem("deckGoAccessToken", value);
      } catch {
        // Ignore storage-disabled child frames.
      }
    }, token);
  }
  const url = new URL(frontendBase);
  url.searchParams.set("surface", "deck-ui");
  url.searchParams.set("panel", panel);
  url.searchParams.set("nav", options.nav ?? "expanded");
  if (options.deckVisualState) {
    url.searchParams.set("deckVisualState", options.deckVisualState);
  }
  await page.goto(url.toString());
}

export async function waitForGatewayMethod(requestLog: string, method: string) {
  await expect
    .poll(async () => {
      try {
        const raw = await readFile(requestLog, "utf8");
        return raw
          .split("\n")
          .filter(Boolean)
          .some((line) => {
            try {
              return (JSON.parse(line) as { method?: string }).method === method;
            } catch {
              return false;
            }
          });
      } catch {
        return false;
      }
    })
    .toBe(true);
}

export async function createChatSession(
  request: APIRequestContext,
  backendBase: string,
  message: string,
  accessToken?: string,
  options: {
    agentId?: string;
    label?: string;
    model?: string;
  } = {},
) {
  const response = await request.post(`${backendBase}/api/chat/sessions/create`, {
    headers: deckTokenHeaders(accessToken),
    data: {
      agentId: options.agentId ?? "main",
      label: options.label ?? "E2E smoke",
      message,
      ...(options.model ? { model: options.model } : {}),
    },
  });
  expect(response.ok(), `chat session create returned ${response.status()}`).toBe(true);
  return (await response.json()) as Record<string, unknown>;
}

export async function seedRealGatewayChat(
  request: APIRequestContext,
  stack: E2EStack,
  testInfo: TestInfo,
  options: {
    agentId?: string;
    channel?: string;
    maxAttempts?: number;
    model?: string;
  } = {},
) {
  const runId = stack.realE2E?.runId ?? buildRealE2ERunId(testInfo);
  const agentId = options.agentId ?? "main";
  const channel = options.channel ?? process.env.DECK_GO_REAL_GATEWAY_E2E_CHANNEL ?? "cpa";
  const model = options.model ?? process.env.DECK_GO_REAL_GATEWAY_E2E_MODEL ?? "gpt-5.4";
  const maxAttempts = options.maxAttempts ?? 3;
  const headers = deckTokenHeaders(stack.accessToken);
  const evidence: JsonObject = {
    scenarioId: "real-e2e.cpa-main-seed",
    runId,
    agentId,
    channel,
    model,
    maxAttempts,
    attempts: [],
    endpoints: {},
    configuredModels: await requestJsonEvidence(
      request,
      stack,
      "POST",
      "/api/v1/runtimes/rt_local/gateway/rpc",
      headers,
      { method: "models.configured", params: {} },
    ),
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const label = buildRunScopedName(runId, `real-seed-${attempt}`);
    const message = `deck-go isolated real E2E seed ${runId} attempt ${attempt}`;
    const session = await requestJsonEvidence(
      request,
      stack,
      "POST",
      "/api/chat/sessions/create",
      headers,
      {
        agentId,
        label,
        message,
        model,
      },
    );
    (evidence.attempts as unknown[]).push(session);
    if (session.ok) {
      evidence.sessionStatus = "passed";
      evidence.session = session.payload;
      break;
    }
  }
  if (evidence.sessionStatus !== "passed") {
    evidence.sessionStatus = "handoff-blocked";
  }

  const endpoints = evidence.endpoints as JsonObject;
  for (const endpoint of [
    "/api/sessions?limit=20",
    "/api/activity?limit=20",
    "/api/logs?limit=10&maxBytes=65536",
    "/api/usage/cost?days=7",
    "/api/docs",
  ]) {
    endpoints[endpoint] = await requestJsonEvidence(request, stack, "GET", endpoint, headers);
  }

  const endpointStatuses = Object.values(endpoints).map((entry) =>
    isObject(entry) && entry.statusLabel ? entry.statusLabel : "degraded",
  );
  evidence.status =
    evidence.sessionStatus === "passed"
      ? endpointStatuses.includes("degraded")
        ? "degraded"
        : "passed"
      : "handoff-blocked";

  await writeRealE2EScenarioEvidence(stack, "real-gateway-cpa-main-seed", evidence, testInfo);
  return evidence;
}

async function requestJsonEvidence(
  request: APIRequestContext,
  stack: E2EStack,
  method: "GET" | "POST",
  endpoint: string,
  headers: Record<string, string>,
  data?: unknown,
) {
  const response =
    method === "GET"
      ? await request.get(`${stack.backendBase}${endpoint}`, { headers })
      : await request.post(`${stack.backendBase}${endpoint}`, { headers, data });
  const text = await response.text();
  const payload = parseJsonOrText(text);
  return {
    endpoint,
    method,
    ok: response.ok(),
    status: response.status(),
    statusLabel: response.ok() ? classifyPayloadStatus(payload) : "degraded",
    payload,
  };
}

export async function callRuntimeGatewayRpc(
  request: APIRequestContext,
  stack: Pick<E2EStack, "accessToken" | "backendBase">,
  method: string,
  params: Record<string, unknown>,
) {
  const response = await request.post(`${stack.backendBase}/api/v1/runtimes/rt_local/gateway/rpc`, {
    headers: deckTokenHeaders(stack.accessToken),
    data: { method, params },
  });
  const payload = parseJsonOrText(await response.text()) as { result?: unknown; error?: unknown };
  expect(
    response.ok() && !payload.error,
    `${method} gateway RPC returned ${response.status()}: ${JSON.stringify(payload)}`,
  ).toBe(true);
  return payload;
}

function parseJsonOrText(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text.slice(0, 4000);
  }
}

function classifyPayloadStatus(payload: unknown) {
  if (payload === null || payload === undefined || payload === "") {
    return "empty-valid";
  }
  if (Array.isArray(payload)) {
    return payload.length > 0 ? "passed" : "empty-valid";
  }
  if (isObject(payload)) {
    const values = Object.values(payload);
    const hasNonEmptyArray = values.some((value) => Array.isArray(value) && value.length > 0);
    if (hasNonEmptyArray) {
      return "passed";
    }
    const hasEmptyArray = values.some((value) => Array.isArray(value) && value.length === 0);
    return hasEmptyArray ? "empty-valid" : "passed";
  }
  return "passed";
}

export async function sendChatMessage(page: Page, text: string) {
  const input = page.getByPlaceholder("Type a message...");
  await expect(input).toBeVisible();
  await input.fill(text);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText(text).first()).toBeVisible();
}

export async function waitForRemoteConfigured(backendBase: string) {
  await waitForCapabilities(backendBase, true);
}

export function authHeaders(accessToken?: string) {
  return deckTokenHeaders(accessToken);
}
