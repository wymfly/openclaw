#!/usr/bin/env node
/**
 * seed.js — Cross-platform seed injection for OpenClaw + Deck.
 *
 * Usage: node deploy/scripts/seed.js <target-dir> [--force]
 *
 * Strategies:
 *   init-once      — IDENTITY.md, models.json, cron, extensions (skip if exists)
 *   additive-merge — openclaw.json, auth-profiles.json (add new entries, never overwrite existing)
 *   always-sync    — skills (overwrite every run)
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
  "MOONSHOT_API_KEY",
  "OPENCLAW_GATEWAY_TOKEN",
  "DEFAULT_MODEL",
  "TELEGRAM_BOT_TOKEN",
  "DISCORD_BOT_TOKEN",
];

// --- Helpers ---

function log(msg) {
  console.log(`[seed] ${msg}`);
}

/**
 * Atomic JSON write: write to .tmp then rename.
 * Prevents corruption if process crashes mid-write.
 */
function atomicWriteJson(filePath, data) {
  const content = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, filePath);
}

/**
 * Atomic file write (non-JSON).
 */
function atomicWriteFile(filePath, content) {
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, filePath);
}

function renderTemplate(src) {
  let content = fs.readFileSync(src, "utf-8");
  for (const v of TEMPLATE_VARS) {
    content = content.replaceAll(`\${${v}}`, process.env[v] || "");
  }
  return content;
}

function copyDirRecursive(src, dst, { renderTemplates = false } = {}) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(s, d, { renderTemplates });
    } else if (renderTemplates && entry.name.endsWith(".tmpl")) {
      const rendered = renderTemplate(s);
      const finalD = d.replace(/\.tmpl$/, "");
      if (!fs.existsSync(finalD)) {
        atomicWriteFile(finalD, rendered);
        log(`rendered: ${finalD}`);
      }
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
    atomicWriteFile(finalDst, rendered);
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

// --- Additive Merge ---

/**
 * Union two arrays of objects by a key field.
 * Adds items from `seedArr` that don't exist in `existingArr` (by key).
 * Never modifies or removes existing items.
 */
function unionArrayByKey(existingArr, seedArr, key) {
  if (!Array.isArray(existingArr) || !Array.isArray(seedArr)) {
    return existingArr;
  }
  const existingKeys = new Set(existingArr.map((item) => item[key]));
  const newItems = seedArr.filter((item) => !existingKeys.has(item[key]));
  if (newItems.length > 0) {
    return [...existingArr, ...newItems];
  }
  return existingArr;
}

/**
 * Additive merge for openclaw.json:
 * - models.providers: add new providers; for existing providers, union models[] by id
 * - plugins.entries: add new plugin entries, never overwrite existing
 * - other top-level keys: add if missing, never overwrite
 */
function additiveMergeConfig(existing, seed) {
  let changed = false;

  // models.providers: deep additive
  if (seed.models?.providers) {
    if (!existing.models) {
      existing.models = {};
    }
    if (!existing.models.providers) {
      existing.models.providers = {};
    }

    for (const [providerId, seedProvider] of Object.entries(seed.models.providers)) {
      if (!existing.models.providers[providerId]) {
        // New provider — add entirely
        existing.models.providers[providerId] = seedProvider;
        log(`  added provider: ${providerId}`);
        changed = true;
      } else {
        // Existing provider — union models array by id
        const existingProvider = existing.models.providers[providerId];
        if (Array.isArray(seedProvider.models) && Array.isArray(existingProvider.models)) {
          const merged = unionArrayByKey(existingProvider.models, seedProvider.models, "id");
          if (merged.length > existingProvider.models.length) {
            const added = merged.length - existingProvider.models.length;
            existingProvider.models = merged;
            log(`  added ${added} model(s) to provider: ${providerId}`);
            changed = true;
          }
        }
      }
    }
  }

  // plugins.entries: additive by key
  if (seed.plugins?.entries) {
    if (!existing.plugins) {
      existing.plugins = {};
    }
    if (!existing.plugins.entries) {
      existing.plugins.entries = {};
    }

    for (const [pluginId, pluginConf] of Object.entries(seed.plugins.entries)) {
      if (!existing.plugins.entries[pluginId]) {
        existing.plugins.entries[pluginId] = pluginConf;
        log(`  added plugin: ${pluginId}`);
        changed = true;
      }
    }
  }

  // channels: additive by key
  if (seed.channels) {
    if (!existing.channels) {
      existing.channels = {};
    }
    for (const [channelId, channelConf] of Object.entries(seed.channels)) {
      if (!existing.channels[channelId]) {
        existing.channels[channelId] = channelConf;
        log(`  added channel: ${channelId}`);
        changed = true;
      }
    }
  }

  // Other top-level keys: add if missing
  for (const key of Object.keys(seed)) {
    if (key === "models" || key === "plugins" || key === "channels") {
      continue;
    }
    if (!(key in existing)) {
      existing[key] = seed[key];
      log(`  added top-level key: ${key}`);
      changed = true;
    }
  }

  return { config: existing, changed };
}

/**
 * Additive merge for auth-profiles.json:
 * Render the seed template, then add new profile keys without overwriting existing.
 */
function additiveMergeAuthProfiles(existingPath, seedTemplatePath) {
  if (!fs.existsSync(seedTemplatePath)) {
    return;
  }

  const rendered = renderTemplate(seedTemplatePath);
  let seedProfiles;
  try {
    seedProfiles = JSON.parse(rendered);
  } catch {
    log(`WARN: failed to parse rendered auth-profiles template`);
    return;
  }

  let existing;
  try {
    existing = JSON.parse(fs.readFileSync(existingPath, "utf-8"));
  } catch {
    // File doesn't exist or is corrupt — write seed as-is
    fs.mkdirSync(path.dirname(existingPath), { recursive: true });
    atomicWriteJson(existingPath, seedProfiles);
    log(`rendered: ${existingPath}`);
    return;
  }

  // Merge profiles object: add new keys only
  let changed = false;
  if (seedProfiles.profiles && existing.profiles) {
    for (const [profileId, profileConf] of Object.entries(seedProfiles.profiles)) {
      if (!existing.profiles[profileId]) {
        existing.profiles[profileId] = profileConf;
        log(`  added auth profile: ${profileId}`);
        changed = true;
      }
    }
  }

  if (changed) {
    atomicWriteJson(existingPath, existing);
    log(`merged auth-profiles: ${existingPath}`);
  }
}

/**
 * Seed openclaw.json with additive merge strategy.
 * First install: render template and write.
 * Subsequent: parse seed template + existing, additive merge.
 */
function seedConfigAdditive(targetDir, force) {
  const tmplSrc = path.join(SEED_DIR, "openclaw.json.tmpl");
  const configDst = path.join(targetDir, "openclaw.json");

  if (!fs.existsSync(tmplSrc)) {
    return;
  }

  // Render seed template
  const rendered = renderTemplate(tmplSrc);
  let seedConfig;
  try {
    seedConfig = JSON.parse(rendered);
  } catch (e) {
    log(`WARN: failed to parse rendered openclaw.json template: ${e.message}`);
    return;
  }

  if (!fs.existsSync(configDst) || force) {
    // First install or force: write seed as-is
    atomicWriteJson(configDst, seedConfig);
    log(`rendered: ${configDst}`);
    return;
  }

  // Existing config: additive merge
  let existingConfig;
  try {
    existingConfig = JSON.parse(fs.readFileSync(configDst, "utf-8"));
  } catch (e) {
    log(`WARN: failed to parse existing openclaw.json: ${e.message}`);
    log(`  skipping additive merge to protect user data`);
    return;
  }

  log(`additive merge: ${configDst}`);
  const { config: merged, changed } = additiveMergeConfig(existingConfig, seedConfig);
  if (changed) {
    atomicWriteJson(configDst, merged);
    log(`config updated with new entries`);
  } else {
    log(`config already up to date`);
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

// --- Config: additive merge (always runs, even on subsequent installs) ---
seedConfigAdditive(targetDir, force);

// --- Auth profiles: additive merge ---
const authTmplSrc = path.join(SEED_DIR, "agents/main/agent/auth-profiles.json.tmpl");
const authDst = path.join(targetDir, "agents/main/agent/auth-profiles.json");
if (fs.existsSync(authTmplSrc)) {
  if (!fs.existsSync(authDst) || force) {
    // First install: render and write
    const rendered = renderTemplate(authTmplSrc);
    fs.mkdirSync(path.dirname(authDst), { recursive: true });
    atomicWriteFile(authDst, rendered);
    log(`rendered: ${authDst}`);
  } else {
    // Existing: additive merge
    additiveMergeAuthProfiles(authDst, authTmplSrc);
  }
}

if (!alreadyInit) {
  // init-once: agents directory (with template rendering, skip auth-profiles handled above)
  const agentsDir = path.join(SEED_DIR, "agents");
  if (fs.existsSync(agentsDir)) {
    for (const d of fs.readdirSync(agentsDir, { withFileTypes: true })) {
      if (d.isDirectory()) {
        const dst = path.join(targetDir, "agents", d.name);
        if (fs.existsSync(dst) && !force) {
          // Directory exists — render any missing .tmpl files (skip auth-profiles.json.tmpl)
          copyDirRecursive(path.join(agentsDir, d.name), dst, { renderTemplates: true });
        } else {
          fs.mkdirSync(dst, { recursive: true });
          copyDirRecursive(path.join(agentsDir, d.name), dst, { renderTemplates: true });
          log(`seeded agent: ${d.name}`);
        }
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

  // write marker
  atomicWriteFile(markerPath, `v1 ${new Date().toISOString()}`);
  log("Seed marker written");
} else {
  log("Already initialized. Running additive merge + always-sync only...");
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
