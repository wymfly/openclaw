#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const modules = [
  ["activity", "activity-workspace-ready.png"],
  ["agents", "agents-workbench-ready.png"],
  ["alerts", "alerts-workbench-ready.png"],
  ["api-explorer", "api-explorer-workspace-ready.png"],
  ["approvals", "approvals-workbench-ready.png"],
  ["budget", "budget-workbench-ready.png"],
  ["channels", "channels-list-ready.png"],
  ["chat", "chat-rich-workbench.png"],
  ["config", "config-workbench-ready.png"],
  ["cron", "cron-workbench-ready.png"],
  ["docs", "docs-workbench-ready.png"],
  ["gateway", "gateway-control-plane-ready.png"],
  ["identity", "identity-workbench-ready.png"],
  ["logs", "logs-workbench-ready.png"],
  ["memory", "memory-workspace-ready.png"],
  ["models", "models-workbench-ready.png"],
  ["nodes", "nodes-workbench-ready.png"],
  ["plugins", "plugins-workbench-ready.png"],
  ["routing", "routing-workbench-ready.png"],
  ["sessions", "sessions-workbench-ready.png"],
  ["settings", "settings-workbench-ready.png"],
  ["skills", "skills-workbench-ready.png"],
  ["subagents", "subagents-workbench-ready.png"],
  ["threads", "threads-workspace-ready.png"],
  ["usage", "usage-cockpit-ready.png"],
  ["webhooks", "webhooks-workbench-ready.png"],
];

const options = parseArgs(process.argv.slice(2));
const deckRoot = process.cwd();
const prototypeDir = path.resolve(deckRoot, options.prototypeDir ?? ".local/prototype-gap-audit");
const mockDir = path.resolve(deckRoot, options.mockDir ?? ".local/mock-visual-run");
const outDir = path.resolve(deckRoot, options.outDir ?? ".local/mock-prototype-audit");
const sheetSize = Number(options.sheetSize ?? 5);

mkdirSync(outDir, { recursive: true });

const verdicts = modules.map(([moduleId, screenshotName]) => {
  const prototypePath = path.join(prototypeDir, `${moduleId}--prototype.png`);
  const currentPath = findFileByName(mockDir, screenshotName);
  const missing = [];
  if (!existsSync(prototypePath)) {
    missing.push("prototype");
  }
  if (!currentPath) {
    missing.push("current");
  }
  return {
    module: moduleId,
    prototype: existsSync(prototypePath)
      ? normalizePath(path.relative(outDir, prototypePath))
      : null,
    current: currentPath ? normalizePath(path.relative(outDir, currentPath)) : null,
    evidenceStatus: missing.length === 0 ? "ready-for-review" : `missing-${missing.join("-and-")}`,
    verdict: "unreviewed",
    materialGaps: [],
    acceptedExceptions: [],
    notes:
      missing.length === 0
        ? "Contact sheet generated. Requires human or structured visual verdict before parity can be claimed."
        : `Missing ${missing.join(" and ")} screenshot evidence.`,
  };
});

writeFileSync(path.join(outDir, "verdict.json"), `${JSON.stringify(verdicts, null, 2)}\n`);
writeFileSync(path.join(outDir, "verdict.md"), renderVerdictMarkdown(verdicts));

const sheets = chunk(verdicts, sheetSize);
sheets.forEach((rows, index) => {
  writeFileSync(path.join(outDir, `sheet-${index + 1}.html`), renderSheet(rows, index + 1));
});
writeFileSync(path.join(outDir, "index.html"), renderIndex(sheets.length));

await renderPngSheets(outDir, sheets.length);

console.log(`Prototype parity report written to ${path.relative(deckRoot, outDir)}`);
console.log(
  `Modules ready for review: ${verdicts.filter((entry) => entry.evidenceStatus === "ready-for-review").length}/${verdicts.length}`,
);
const missing = verdicts.filter((entry) => entry.evidenceStatus !== "ready-for-review");
if (missing.length > 0) {
  console.log(
    `Missing evidence: ${missing.map((entry) => `${entry.module}:${entry.evidenceStatus}`).join(", ")}`,
  );
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    parsed[key.replaceAll("-", "")] = inlineValue ?? args[index + 1];
    if (inlineValue == null) {
      index += 1;
    }
  }
  return {
    prototypeDir: parsed.prototypedir,
    mockDir: parsed.mockdir,
    outDir: parsed.outdir,
    sheetSize: parsed.sheetsize,
  };
}

function findFileByName(root, name) {
  if (!existsSync(root)) {
    return null;
  }
  const pending = [root];
  while (pending.length > 0) {
    const dir = pending.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const current = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        pending.push(current);
      } else if (entry.name === name) {
        return current;
      }
    }
  }
  return null;
}

function renderIndex(count) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>deck-go prototype parity report</title>
  <style>${baseCss()}</style>
</head>
<body>
  <main class="index">
    <h1>deck-go prototype parity report</h1>
    <p>This report separates mock functional screenshots from mock prototype parity. A row is not visually aligned until its verdict is updated from <code>unreviewed</code>.</p>
    <ul>
      ${Array.from({ length: count }, (_, index) => `<li><a href="sheet-${index + 1}.html">Sheet ${index + 1}</a></li>`).join("\n      ")}
    </ul>
    <p><a href="verdict.md">Verdict markdown</a> · <a href="verdict.json">Verdict JSON</a></p>
  </main>
</body>
</html>
`;
}

function renderSheet(rows, index) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Prototype parity sheet ${index}</title>
  <style>${baseCss()}</style>
</head>
<body>
  <h1>Prototype vs mock current sheet ${index}</h1>
  <div class="grid">
    <div class="head">Module</div>
    <div class="head">Prototype</div>
    <div class="head">Mock current</div>
    ${rows
      .map(
        (entry) => `
          <div class="cell name">
            ${escapeHtml(entry.module)}
            <div class="status ${entry.evidenceStatus === "ready-for-review" ? "ready" : "missing"}">${escapeHtml(entry.evidenceStatus)}</div>
            <div class="verdict">verdict: ${escapeHtml(entry.verdict)}</div>
          </div>
          <div class="cell">${entry.prototype ? `<img class="shot" src="${entry.prototype}" alt="${escapeHtml(entry.module)} prototype">` : `<div class="missing-box">Missing prototype screenshot</div>`}</div>
          <div class="cell">${entry.current ? `<img class="shot" src="${entry.current}" alt="${escapeHtml(entry.module)} mock current">` : `<div class="missing-box">Missing mock-current screenshot</div>`}</div>
        `,
      )
      .join("\n")}
  </div>
</body>
</html>
`;
}

function renderVerdictMarkdown(entries) {
  const lines = [
    "# Prototype Parity Verdict Skeleton",
    "",
    "Generated by `deck-go/scripts/generate-prototype-parity-report.mjs`.",
    "",
    "A `ready-for-review` row is not a pass. Update `verdict`, `materialGaps`, and `acceptedExceptions` after structured visual review.",
    "",
    "| Module | Evidence | Verdict | Notes |",
    "|---|---|---|---|",
  ];
  for (const entry of entries) {
    lines.push(
      `| ${entry.module} | ${entry.evidenceStatus} | ${entry.verdict} | ${entry.notes.replaceAll("|", "\\|")} |`,
    );
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function baseCss() {
  return `
    body { margin: 0; background: #101113; color: #e5e7eb; font: 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    h1 { margin: 16px; font-size: 16px; }
    a { color: #93c5fd; }
    code { color: #bfdbfe; }
    .index { max-width: 920px; margin: 0 auto; padding: 24px; }
    .grid { display: grid; grid-template-columns: 140px 1fr 1fr; gap: 10px; padding: 0 16px 24px; }
    .head { padding-bottom: 6px; border-bottom: 1px solid #30343b; color: #9ca3af; font-weight: 700; }
    .cell { min-height: 220px; padding-top: 10px; border-top: 1px solid #262a31; }
    .name { color: #f9fafb; font-size: 14px; font-weight: 700; }
    .status { margin-top: 8px; font-size: 11px; }
    .status.ready { color: #86efac; }
    .status.missing { color: #fbbf24; }
    .verdict { margin-top: 8px; color: #9ca3af; font-size: 11px; }
    .shot { width: 100%; height: auto; border: 1px solid #30343b; background: #181a1f; }
    .missing-box { display: flex; align-items: center; justify-content: center; min-height: 260px; border: 1px dashed #7c4f16; background: #1f1a11; color: #fbbf24; text-align: center; }
  `;
}

async function renderPngSheets(outputDir, count) {
  let chromium;
  try {
    ({ chromium } = await import("@playwright/test"));
  } catch {
    return;
  }
  const browser = await chromium.launch({ args: ["--no-proxy-server"] });
  try {
    const page = await browser.newPage({
      viewport: { width: 2400, height: 1800 },
      deviceScaleFactor: 1,
    });
    for (let index = 1; index <= count; index += 1) {
      const htmlPath = path.join(outputDir, `sheet-${index}.html`);
      if (!existsSync(htmlPath)) {
        continue;
      }
      await page.goto(pathToFileURL(htmlPath).toString());
      await page.screenshot({ path: path.join(outputDir, `sheet-${index}.png`), fullPage: true });
    }
  } finally {
    await browser.close();
  }
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
