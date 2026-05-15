import { execFile } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type GatewayLifecycleOptions = {
  entrypoint: string;
  repoRoot: string;
  port: number;
  token: string;
  stateDir: string;
  cwd?: string;
  baseEnv?: NodeJS.ProcessEnv;
  extraEnv?: NodeJS.ProcessEnv;
  timeoutMs?: number;
};

export type GatewayLifecycleResult = {
  serviceName: string;
};

export function deriveGatewayServiceName(repoRoot: string): string {
  const absRepoRoot = path.resolve(repoRoot);
  const hash = crypto.createHash("sha256").update(absRepoRoot).digest("hex").slice(0, 12);
  return `openclaw-gateway.${hash}`;
}

export function buildGatewayLifecycleEnv(options: {
  repoRoot: string;
  stateDir: string;
  token?: string;
  baseEnv?: NodeJS.ProcessEnv;
  extraEnv?: NodeJS.ProcessEnv;
}): NodeJS.ProcessEnv {
  const serviceName = deriveGatewayServiceName(options.repoRoot);
  return {
    ...(options.baseEnv ?? process.env),
    ...options.extraEnv,
    OPENCLAW_LAUNCHD_LABEL: serviceName,
    OPENCLAW_SYSTEMD_UNIT: serviceName,
    OPENCLAW_WINDOWS_TASK_NAME: serviceName,
    OPENCLAW_STATE_DIR: options.stateDir,
    ...(options.token ? { OPENCLAW_GATEWAY_TOKEN: options.token } : {}),
  };
}

export async function installAndStart(options: GatewayLifecycleOptions) {
  const serviceName = deriveGatewayServiceName(options.repoRoot);
  await runGatewayLifecycleCommand(options, [
    "gateway",
    "install",
    "--port",
    String(options.port),
    "--token",
    options.token,
    "--force",
  ]);
  await runGatewayLifecycleCommand(options, ["gateway", "start"]);
  return { serviceName };
}

export async function uninstall(
  options: Omit<GatewayLifecycleOptions, "port" | "token"> & {
    token?: string;
  },
) {
  await runGatewayLifecycleCommand(
    {
      ...options,
      port: 0,
      token: options.token ?? "",
    },
    ["gateway", "uninstall"],
  );
}

async function runGatewayLifecycleCommand(options: GatewayLifecycleOptions, args: string[]) {
  const env = buildGatewayLifecycleEnv({
    repoRoot: options.repoRoot,
    stateDir: options.stateDir,
    token: options.token,
    baseEnv: options.baseEnv,
    extraEnv: options.extraEnv,
  });
  try {
    await execFileAsync(process.execPath, [options.entrypoint, ...args], {
      cwd: options.cwd ?? options.repoRoot,
      env,
      timeout: options.timeoutMs ?? 180_000,
      maxBuffer: 1024 * 1024,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`gateway lifecycle command failed (${args.join(" ")}): ${message}`, {
      cause: error,
    });
  }
}
