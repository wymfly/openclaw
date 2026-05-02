import { execFile } from "node:child_process";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
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

type ManagedProcess = {
  stop: () => Promise<void>;
  output: () => string;
};

export type E2EStack = {
  backendBase: string;
  frontendBase: string;
  requestLog: string;
  accessToken?: string;
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

async function waitForGatewayHealth(backendBase: string, accessToken?: string) {
  await expect
    .poll(
      async () => {
        const response = await fetch(`${backendBase}/api/gateway/health`, {
          headers: deckTokenHeaders(accessToken),
        });
        if (!response.ok) {
          return response.status;
        }
        const payload = (await response.json()) as { ok?: boolean };
        return payload.ok === false ? 502 : 200;
      },
      { timeout: 180_000 },
    )
    .toBe(200);
}

async function waitForGatewayRPC(backendBase: string, accessToken?: string) {
  await expect
    .poll(
      async () => {
        const response = await fetch(`${backendBase}/api/v1/runtimes/rt_local/gateway/rpc`, {
          method: "POST",
          headers: {
            ...deckTokenHeaders(accessToken),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ method: "agents.list", params: {} }),
        });
        if (!response.ok) {
          return response.status;
        }
        const payload = (await response.json()) as { result?: { agents?: unknown[] } };
        return Array.isArray(payload.result?.agents) ? 200 : 502;
      },
      { timeout: 180_000 },
    )
    .toBe(200);
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
      RUNTIME_BUNDLED_COMMAND: "pnpm",
      RUNTIME_BUNDLED_ARGS: `openclaw gateway run --bind loopback --port ${gatewayPort} --allow-unconfigured`,
      RUNTIME_BUNDLED_WORKDIR: repoRoot,
      RUNTIME_BUNDLED_BIND_HOST: "127.0.0.1",
      RUNTIME_BUNDLED_BIND_PORT: String(gatewayPort),
      RUNTIME_BUNDLED_TOKEN: gatewayToken,
      RUNTIME_BUNDLED_AUTO_START: "true",
      RUNTIME_BUNDLED_ENV_NO_PROXY: localNoProxy,
    },
  });
  const cleanup: Array<() => Promise<void>> = [backend.stop];
  try {
    await waitForHTTP(`${backendBase}/healthz`, "backend", backend.output);
    await waitForBundledRuntime(backendBase, accessToken);
    await waitForGatewayHealth(backendBase, accessToken);
    await waitForGatewayRPC(backendBase, accessToken);
    const frontend = await startFrontend(backendBase, frontendPort, accessToken);
    cleanup.push(frontend.process.stop);
    return {
      backendBase,
      frontendBase: frontend.frontendBase,
      requestLog,
      accessToken,
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
) {
  const response = await request.post(`${backendBase}/api/chat/sessions/create`, {
    headers: deckTokenHeaders(accessToken),
    data: {
      agentId: "main",
      label: "E2E smoke",
      message,
    },
  });
  expect(response.ok(), `chat session create returned ${response.status()}`).toBe(true);
  return (await response.json()) as Record<string, unknown>;
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
