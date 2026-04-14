#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      result[key] = true;
      continue;
    }
    result[key] = value;
    i += 1;
  }
  return result;
}

function stripQuotes(value) {
  if (!value) {
    return value;
  }
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

async function readEnvFile(envPath) {
  try {
    const raw = await fsp.readFile(envPath, "utf8");
    const result = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const idx = trimmed.indexOf("=");
      if (idx <= 0) {
        continue;
      }
      const key = trimmed.slice(0, idx).trim();
      const value = stripQuotes(trimmed.slice(idx + 1));
      result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

function getOpenClawHome(stateDir) {
  if (stateDir.endsWith(`${path.sep}.openclaw`) || stateDir.endsWith(".openclaw")) {
    return path.dirname(stateDir);
  }
  return stateDir;
}

function timestamp() {
  return new Date().toISOString();
}

function appendLog(stream, label, chunk) {
  const text = chunk.toString();
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line) {
      continue;
    }
    stream.write(`[${timestamp()}] [${label}] ${line}\n`);
  }
}

const options = parseArgs(process.argv.slice(2));
const deployDir = options["deploy-dir"] ? path.resolve(options["deploy-dir"]) : null;
const sourceDir = options["source-dir"] ? path.resolve(options["source-dir"]) : null;
const runtimeDir = options["runtime-dir"] ? path.resolve(options["runtime-dir"]) : null;

if (!deployDir || !sourceDir || !runtimeDir) {
  console.error("Missing required args: --deploy-dir, --source-dir, --runtime-dir");
  process.exit(2);
}

const envFile = path.join(deployDir, ".env");
const envValues = await readEnvFile(envFile);
const packageRoot = path.resolve(sourceDir, "..");
const resolveMaybeRelative = (value, fallback) => {
  if (!value) {
    return fallback;
  }
  return path.isAbsolute(value) ? value : path.resolve(packageRoot, value);
};
const stateDir = resolveMaybeRelative(
  envValues.OPENCLAW_STATE_DIR,
  path.join(packageRoot, "data", ".openclaw"),
);
const deckDataDir = resolveMaybeRelative(
  envValues.DECK_DATA_DIR,
  path.join(packageRoot, "data", "openclaw-deck"),
);
const gatewayPort = envValues.GATEWAY_PORT || "18789";
const deckPort = envValues.DECK_PORT || "3000";
const token = envValues.OPENCLAW_GATEWAY_TOKEN || "";
const logsDir = path.join(path.dirname(runtimeDir), "logs");
const supervisorStatePath = path.join(runtimeDir, "supervisor-state.json");

await fsp.mkdir(runtimeDir, { recursive: true });
await fsp.mkdir(logsDir, { recursive: true });
await fsp.mkdir(stateDir, { recursive: true });
await fsp.mkdir(deckDataDir, { recursive: true });

const supervisorLog = fs.createWriteStream(path.join(logsDir, "windows-supervisor.log"), {
  flags: "a",
});
const gatewayLog = fs.createWriteStream(path.join(logsDir, "gateway.log"), { flags: "a" });
const deckLog = fs.createWriteStream(path.join(logsDir, "deck.log"), { flags: "a" });

function log(message) {
  supervisorLog.write(`[${timestamp()}] ${message}\n`);
}

const gatewayEnv = {
  ...process.env,
  ...envValues,
  NODE_ENV: "production",
  NO_PROXY: "localhost,127.0.0.1",
  OPENCLAW_HOME: getOpenClawHome(stateDir),
  OPENCLAW_STATE_DIR: stateDir,
  OPENCLAW_GATEWAY_TOKEN: token,
};

const deckEnv = {
  ...process.env,
  ...envValues,
  NODE_ENV: "production",
  NO_PROXY: "localhost,127.0.0.1",
  HOSTNAME: "0.0.0.0",
  PORT: deckPort,
  DECK_GATEWAY_URL: `ws://localhost:${gatewayPort}`,
  DECK_GATEWAY_TOKEN: token,
  DECK_DATA_DIR: deckDataDir,
};

const childSpecs = {
  gateway: {
    cwd: sourceDir,
    args: [
      "openclaw.mjs",
      "gateway",
      "run",
      "--bind",
      "loopback",
      "--port",
      String(gatewayPort),
      "--force",
    ],
    env: gatewayEnv,
    logStream: gatewayLog,
  },
  deck: {
    cwd: path.join(sourceDir, "dashboard"),
    args: [".next/standalone/dashboard/standalone-entry.mjs"],
    env: deckEnv,
    logStream: deckLog,
  },
};

let stopping = false;
const children = {
  gateway: null,
  deck: null,
};

async function writeSupervisorState() {
  const payload = {
    updatedAt: timestamp(),
    supervisorPid: process.pid,
    deployDir,
    sourceDir,
    runtimeDir,
    gatewayPid: children.gateway?.pid ?? null,
    deckPid: children.deck?.pid ?? null,
    gatewayPort: Number(gatewayPort),
    deckPort: Number(deckPort),
  };
  await fsp.writeFile(supervisorStatePath, JSON.stringify(payload, null, 2));
}

async function clearSupervisorState() {
  try {
    await fsp.unlink(supervisorStatePath);
  } catch {}
}

function scheduleRestart(name) {
  if (stopping) {
    return;
  }
  log(`${name} exited unexpectedly; restarting in 5 seconds`);
  setTimeout(() => {
    if (!stopping) {
      startChild(name);
    }
  }, 5000);
}

function attachChild(name, child, spec) {
  children[name] = child;
  void writeSupervisorState();

  child.stdout?.on("data", (chunk) => appendLog(spec.logStream, `${name}:stdout`, chunk));
  child.stderr?.on("data", (chunk) => appendLog(spec.logStream, `${name}:stderr`, chunk));
  child.on("error", (error) => {
    log(`${name} error: ${error instanceof Error ? error.message : String(error)}`);
  });
  child.on("exit", (code, signal) => {
    log(`${name} exited code=${code ?? "null"} signal=${signal ?? "null"}`);
    children[name] = null;
    void writeSupervisorState();
    if (!stopping) {
      scheduleRestart(name);
    }
  });
}

function startChild(name) {
  const spec = childSpecs[name];
  const child = spawn(process.execPath, spec.args, {
    cwd: spec.cwd,
    env: spec.env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  log(`started ${name} pid=${child.pid}`);
  attachChild(name, child, spec);
}

async function shutdown(exitCode = 0) {
  if (stopping) {
    return;
  }
  stopping = true;
  log("shutdown requested");
  for (const child of Object.values(children)) {
    if (child && !child.killed) {
      try {
        child.kill("SIGTERM");
      } catch {}
    }
  }
  await clearSupervisorState();
  setTimeout(() => process.exit(exitCode), 250).unref();
}

process.on("SIGINT", () => {
  void shutdown(0);
});
process.on("SIGTERM", () => {
  void shutdown(0);
});
process.on("exit", () => {
  supervisorLog.end();
  gatewayLog.end();
  deckLog.end();
});

log("supervisor starting");
startChild("gateway");
startChild("deck");
await writeSupervisorState();
