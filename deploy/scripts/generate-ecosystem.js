#!/usr/bin/env node
/**
 * generate-ecosystem.js — Generate PM2 ecosystem.config.cjs from template + env.
 *
 * Usage: node deploy/scripts/generate-ecosystem.js <repo-dir>
 *
 * Reads environment variables (already loaded by install.sh from .env) and
 * generates ecosystem.config.cjs with properly escaped values via JSON.stringify.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoDir = process.argv[2] || path.resolve(__dirname, "../..");

const stateDir =
	process.env.OPENCLAW_STATE_DIR ||
	path.join(repoDir, "deploy/data/.openclaw");
const deckDataDir =
	process.env.DECK_DATA_DIR ||
	path.join(repoDir, "deploy/data/openclaw-deck");
const gwPort = process.env.GATEWAY_PORT || "18789";
const dkPort = process.env.DECK_PORT || "3000";
const token = process.env.OPENCLAW_GATEWAY_TOKEN || "";

// Derive OPENCLAW_HOME from state dir
const openclawHome =
	stateDir.endsWith("/.openclaw") || stateDir.endsWith("\\.openclaw")
		? path.dirname(stateDir)
		: stateDir;

// Collect provider env vars
const providerKeys = [
	"CPA_API_KEY",
	"CPA_BASE_URL",
	"DEEPSEEK_API_KEY",
	"ANTHROPIC_API_KEY",
	"OPENAI_API_KEY",
	"TELEGRAM_BOT_TOKEN",
	"DISCORD_BOT_TOKEN",
];

const gatewayEnv = {
	NODE_ENV: "production",
	OPENCLAW_HOME: openclawHome,
	OPENCLAW_GATEWAY_TOKEN: token,
	NO_PROXY: "localhost,127.0.0.1",
};
for (const k of providerKeys) {
	if (process.env[k]) gatewayEnv[k] = process.env[k];
}

const deckEnv = {
	NODE_ENV: "production",
	PORT: dkPort,
	DECK_GATEWAY_URL: `ws://localhost:${gwPort}`,
	DECK_GATEWAY_TOKEN: token,
	DECK_DB_PATH: path.join(deckDataDir, "deck.db"),
	NO_PROXY: "localhost,127.0.0.1",
};

// Read template and replace placeholders with JSON-safe values
let tmpl = fs.readFileSync(
	path.join(__dirname, "../ecosystem.config.cjs.tmpl"),
	"utf-8",
);
tmpl = tmpl.replace(/__REPO_DIR__/g, repoDir.replace(/\\/g, "\\\\"));
tmpl = tmpl.replace("__GATEWAY_PORT__", gwPort);
tmpl = tmpl.replace("__GATEWAY_ENV__", JSON.stringify(gatewayEnv, null, 6));
tmpl = tmpl.replace("__DECK_ENV__", JSON.stringify(deckEnv, null, 6));

const outPath = path.join(__dirname, "../ecosystem.config.cjs");
fs.writeFileSync(outPath, tmpl);
console.log(`[ecosystem] Generated: ${outPath}`);
