#!/usr/bin/env node
import { execSync } from "node:child_process";
import crypto from "node:crypto";
/**
 * write-installed.js — Write or read .installed.json state tracking.
 *
 * Usage:
 *   node write-installed.js <data-dir> <source-dir>    # Write .installed.json
 *   node write-installed.js <data-dir> --read           # Read and print current state
 *   node write-installed.js <data-dir> --check <manifest.json>  # Compare with package manifest
 *
 * The .installed.json file tracks:
 *   - version, commit, timestamp
 *   - checksums (lockfile, gatewayDist, deckStandalone)
 *   - seedVersion
 *   - knownEnvVars (from .env)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEPLOY_DIR = path.resolve(__dirname, "..");

// --- Helpers ---

function sha256File(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

function getVersion(sourceDir) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(sourceDir, "package.json"), "utf-8"));
    return pkg.version || "unknown";
  } catch {
    return "unknown";
  }
}

function getCommit(sourceDir) {
  try {
    // Try reading from build stamp first (works in packages without git)
    const stamp = path.join(sourceDir, "dist", "build-info.json");
    if (fs.existsSync(stamp)) {
      const info = JSON.parse(fs.readFileSync(stamp, "utf-8"));
      if (info.commit) {
        return info.commit.slice(0, 10);
      }
    }
    // Try git (target machine may not have git)
    return execSync("git rev-parse --short HEAD", {
      cwd: sourceDir,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function parseEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return [];
  }
  const content = fs.readFileSync(envPath, "utf-8");
  const vars = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=/);
    if (match) {
      vars.push(match[1]);
    }
  }
  return vars.toSorted((a, b) => a.localeCompare(b));
}

function getSeedVersion() {
  // Read from seed directory marker or default to 1
  const versionFile = path.join(DEPLOY_DIR, "seed", "VERSION");
  if (fs.existsSync(versionFile)) {
    const v = parseInt(fs.readFileSync(versionFile, "utf-8").trim(), 10);
    if (!isNaN(v)) {
      return v;
    }
  }
  return 1;
}

function atomicWriteJson(filePath, data) {
  const content = JSON.stringify(data, null, 2);
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, filePath);
}

// --- Commands ---

async function writeInstalled(dataDir, sourceDir) {
  const installed = {
    version: getVersion(sourceDir),
    commit: await getCommit(sourceDir),
    installedAt: new Date().toISOString(),
    seedVersion: getSeedVersion(),
    checksums: {
      lockfile: sha256File(path.join(sourceDir, "pnpm-lock.yaml")),
      gatewayDist: sha256File(path.join(sourceDir, "dist", "cli-startup-metadata.json")),
      deckStandalone: sha256File(
        path.join(sourceDir, "dashboard", ".next", "standalone", "dashboard", "server.js"),
      ),
    },
    knownEnvVars: parseEnvFile(path.join(DEPLOY_DIR, ".env")),
  };

  const outPath = path.join(dataDir, ".installed.json");
  atomicWriteJson(outPath, installed);
  console.log(`[installed] Written: ${outPath}`);
  console.log(`[installed] Version: ${installed.version} (${installed.commit})`);
  return installed;
}

function readInstalled(dataDir) {
  const filePath = path.join(dataDir, ".installed.json");
  if (!fs.existsSync(filePath)) {
    // Legacy detection: .installed.json missing but openclaw.json exists
    const configPath = path.join(dataDir, ".openclaw", "openclaw.json");
    const configPath2 = path.join(dataDir, "openclaw.json");
    if (fs.existsSync(configPath) || fs.existsSync(configPath2)) {
      console.log(`[installed] Legacy install detected (no .installed.json but config exists)`);
      return { version: "unknown", commit: "unknown", seedVersion: 0, legacy: true };
    }
    console.log(`[installed] No installation found`);
    return null;
  }
  const installed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  console.log(`[installed] Version: ${installed.version} (${installed.commit})`);
  console.log(`[installed] Installed: ${installed.installedAt}`);
  console.log(`[installed] Seed version: ${installed.seedVersion}`);
  return installed;
}

function checkUpgrade(dataDir, manifestPath) {
  const current = readInstalled(dataDir);
  if (!current) {
    console.log(`[check] No current installation — fresh install required`);
    return { needsInstall: true };
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const result = {
    currentVersion: current.version,
    newVersion: manifest.version || "unknown",
    sameVersion: current.version === (manifest.version || "unknown"),
    needsInstall: false,
    needsPnpmInstall: false,
    needsGatewayRestart: false,
    needsDeckRestart: false,
    needsSeed: false,
    newEnvVars: /** @type {string[]} */ ([]),
  };

  // Compare checksums
  if (manifest.checksums) {
    if (
      manifest.checksums.lockfile &&
      manifest.checksums.lockfile !== current.checksums?.lockfile
    ) {
      result.needsPnpmInstall = true;
    }
    if (
      manifest.checksums.gatewayDist &&
      manifest.checksums.gatewayDist !== current.checksums?.gatewayDist
    ) {
      result.needsGatewayRestart = true;
    }
    if (
      manifest.checksums.deckStandalone &&
      manifest.checksums.deckStandalone !== current.checksums?.deckStandalone
    ) {
      result.needsDeckRestart = true;
    }
  }

  // Compare seed version
  if (manifest.seedVersion && manifest.seedVersion > (current.seedVersion || 0)) {
    result.needsSeed = true;
  }

  // Compare env vars
  if (manifest.envVars && current.knownEnvVars) {
    const currentSet = new Set(current.knownEnvVars);
    result.newEnvVars = manifest.envVars.filter((v) => !currentSet.has(v));
  }

  // Print summary
  console.log(`[check] ${current.version} → ${result.newVersion}`);
  if (result.sameVersion) {
    console.log(`[check] Same version`);
  }
  if (result.needsPnpmInstall) {
    console.log(`[check] Dependencies changed — needs pnpm install`);
  }
  if (result.needsGatewayRestart) {
    console.log(`[check] Gateway changed — needs restart`);
  }
  if (result.needsDeckRestart) {
    console.log(`[check] Deck changed — needs restart`);
  }
  if (result.needsSeed) {
    console.log(`[check] Seed updated — will run additive merge`);
  }
  if (result.newEnvVars.length > 0) {
    console.log(`[check] New environment variables:`);
    for (const v of result.newEnvVars) {
      console.log(`[check]   ${v}`);
    }
  }

  // Output as JSON for script consumption
  console.log(`\n__CHECK_RESULT__${JSON.stringify(result)}__END__`);
  return result;
}

// --- Main ---
const dataDir = process.argv[2];
if (!dataDir) {
  console.error("Usage: node write-installed.js <data-dir> <source-dir>");
  console.error("       node write-installed.js <data-dir> --read");
  console.error("       node write-installed.js <data-dir> --check <manifest.json>");
  process.exit(1);
}

const action = process.argv[3];
if (action === "--read") {
  readInstalled(dataDir);
} else if (action === "--check") {
  const manifestPath = process.argv[4];
  if (!manifestPath) {
    console.error("Usage: node write-installed.js <data-dir> --check <manifest.json>");
    process.exit(1);
  }
  checkUpgrade(dataDir, manifestPath);
} else if (action) {
  // action = sourceDir
  await writeInstalled(dataDir, action);
} else {
  console.error("Missing source-dir or action flag");
  process.exit(1);
}
