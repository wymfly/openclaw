#!/usr/bin/env node
/**
 * seed.js — Cross-platform seed injection for OpenClaw + Deck.
 *
 * Usage: node deploy/scripts/seed.js <target-dir> [--force]
 *
 * Strategies:
 *   init-once  — config, agents, cron, extensions (skip if already exists)
 *   always-sync — skills (overwrite every run)
 *
 * Environment variables (from .env):
 *   DEEPSEEK_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY,
 *   CPA_API_KEY, CPA_BASE_URL, OPENCLAW_GATEWAY_TOKEN,
 *   DEFAULT_MODEL, TELEGRAM_BOT_TOKEN, DISCORD_BOT_TOKEN
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DIR = path.resolve(__dirname, "../seed");
const MARKER = ".seed-initialized";

const TEMPLATE_VARS = [
  "DEEPSEEK_API_KEY",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "CPA_API_KEY",
  "CPA_BASE_URL",
  "OPENCLAW_GATEWAY_TOKEN",
  "DEFAULT_MODEL",
  "TELEGRAM_BOT_TOKEN",
  "DISCORD_BOT_TOKEN",
];

// --- Helpers ---

function log(msg) {
  console.log(`[seed] ${msg}`);
}

function renderTemplate(src) {
  let content = fs.readFileSync(src, "utf-8");
  for (const v of TEMPLATE_VARS) {
    content = content.replaceAll(`\${${v}}`, process.env[v] || "");
  }
  return content;
}

function copyDirRecursive(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function seedInitOnce(src, dst) {
  if (fs.existsSync(dst)) {
    log(`skip (exists): ${dst}`);
    return;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (src.endsWith(".tmpl")) {
    const rendered = renderTemplate(src);
    const finalDst = dst.replace(/\.tmpl$/, "");
    fs.writeFileSync(finalDst, rendered);
    log(`rendered: ${finalDst}`);
  } else if (fs.statSync(src).isDirectory()) {
    copyDirRecursive(src, dst);
    log(`copied dir: ${dst}`);
  } else {
    fs.copyFileSync(src, dst);
    log(`copied: ${dst}`);
  }
}

function seedAlwaysSync(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  copyDirRecursive(src, dst);
  log(`synced: ${dst}`);
}

function mergePluginsConfig(targetDir) {
  const pluginsFile = path.join(SEED_DIR, "plugins-config.json");
  const configFile = path.join(targetDir, "openclaw.json");
  if (!fs.existsSync(pluginsFile) || !fs.existsSync(configFile)) return;
  try {
    const cfg = JSON.parse(fs.readFileSync(configFile, "utf-8"));
    const plugins = JSON.parse(fs.readFileSync(pluginsFile, "utf-8"));
    cfg.plugins = { ...cfg.plugins, ...plugins };
    fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2));
    log("merged plugins config");
  } catch (e) {
    log(`WARN: failed to merge plugins config: ${e.message}`);
  }
}

// --- Main ---

const targetDir = process.argv[2];
const force = process.argv.includes("--force");
if (!targetDir) {
  console.error("Usage: node seed.js <target-dir> [--force]");
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });
const markerPath = path.join(targetDir, MARKER);
const alreadyInit = fs.existsSync(markerPath) && !force;

if (alreadyInit) {
  log("Already initialized. Syncing always-sync content only...");
} else {
  // init-once: config template
  const tmplSrc = path.join(SEED_DIR, "openclaw.json.tmpl");
  const tmplDst = path.join(targetDir, "openclaw.json");
  if (fs.existsSync(tmplSrc)) {
    if (!fs.existsSync(tmplDst)) {
      const rendered = renderTemplate(tmplSrc);
      fs.writeFileSync(tmplDst, rendered);
      log(`rendered: ${tmplDst}`);
    } else {
      log(`skip (exists): ${tmplDst}`);
    }
  }

  // init-once: agents
  const agentsDir = path.join(SEED_DIR, "agents");
  if (fs.existsSync(agentsDir)) {
    for (const d of fs.readdirSync(agentsDir, { withFileTypes: true })) {
      if (d.isDirectory()) {
        seedInitOnce(path.join(agentsDir, d.name), path.join(targetDir, "agents", d.name));
      }
    }
  }

  // init-once: cron
  const cronFile = path.join(SEED_DIR, "cron/jobs.json");
  if (fs.existsSync(cronFile)) {
    seedInitOnce(cronFile, path.join(targetDir, "cron/jobs.json"));
  }

  // init-once: extensions
  const extDir = path.join(SEED_DIR, "extensions");
  if (fs.existsSync(extDir)) {
    for (const d of fs.readdirSync(extDir, { withFileTypes: true })) {
      if (d.isDirectory()) {
        seedInitOnce(path.join(extDir, d.name), path.join(targetDir, "extensions", d.name));
      }
    }
  }

  // merge plugins config
  mergePluginsConfig(targetDir);

  // write marker
  fs.writeFileSync(markerPath, `v1 ${new Date().toISOString()}`);
  log("Seed marker written");
}

// always-sync: skills
const skillsDir = path.join(SEED_DIR, "skills");
if (fs.existsSync(skillsDir)) {
  for (const d of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (d.isDirectory()) {
      seedAlwaysSync(path.join(skillsDir, d.name), path.join(targetDir, "skills", d.name));
    }
  }
}

log("Seed injection complete.");
