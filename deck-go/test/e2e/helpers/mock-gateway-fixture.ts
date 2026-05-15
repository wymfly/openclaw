import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const thisFile = fileURLToPath(import.meta.url);
const deckRoot = path.resolve(path.dirname(thisFile), "../../..");
const mockGatewayEntry = "test/fixtures/mock-gateway.mjs";

export type MockGatewayHandle = {
  pid: number;
  port: number;
  token: string;
  url: string;
  output: () => string;
  stop: () => Promise<string>;
};

export async function startMockGateway(options: {
  port: number;
  token?: string;
  requestLog?: string;
  timeoutMs?: number;
}): Promise<MockGatewayHandle> {
  const token = options.token ?? "deck-go-mock-gateway-token";
  const chunks: string[] = [];
  const child = spawn(process.execPath, [mockGatewayEntry], {
    cwd: deckRoot,
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      MOCK_GATEWAY_PORT: String(options.port),
      MOCK_GATEWAY_TOKEN: token,
      MOCK_GATEWAY_REQUEST_LOG: options.requestLog ?? "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const append = (data: Buffer) => chunks.push(data.toString());
  child.stdout?.on("data", append);
  child.stderr?.on("data", append);
  child.once("error", (error) => chunks.push(`[mock-gateway] ${error.message}\n`));

  const output = () => chunks.join("");
  const handle: MockGatewayHandle = {
    pid: child.pid ?? 0,
    port: options.port,
    token,
    url: `http://127.0.0.1:${options.port}`,
    output,
    stop: () => stopChildProcess(child, output),
  };

  try {
    await waitForHealth(handle.url, output, options.timeoutMs ?? 5_000);
  } catch (error) {
    await handle.stop().catch(() => "");
    throw error;
  }

  return handle;
}

export async function stopMockGateway(handle: MockGatewayHandle): Promise<string> {
  return await handle.stop();
}

async function waitForHealth(url: string, output: () => string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/healthz`);
      if (response.ok) {
        return;
      }
      lastError = `${response.status} ${await response.text()}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`mock gateway did not become ready: ${lastError}\n${output()}`);
}

async function stopChildProcess(child: ChildProcess, output: () => string): Promise<string> {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) {
    return output();
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
    new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 3_000)),
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

  return output();
}
