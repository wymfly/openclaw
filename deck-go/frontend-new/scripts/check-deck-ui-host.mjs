import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const frontendRoot = new URL("..", import.meta.url);

function read(relativePath) {
  return readFileSync(new URL(relativePath, frontendRoot), "utf8");
}

function fail(message) {
  console.error(`[deck-ui-host-check] ${message}`);
  process.exitCode = 1;
}

function walkFiles(relativePath) {
  const basePath = new URL(relativePath, frontendRoot);
  const results = [];

  function visit(currentPath) {
    for (const entry of readdirSync(currentPath)) {
      const nextPath = path.join(currentPath, entry);
      const stat = statSync(nextPath);
      if (stat.isDirectory()) {
        visit(nextPath);
        continue;
      }
      results.push(nextPath);
    }
  }

  if (existsSync(basePath)) {
    visit(basePath.pathname);
  }
  return results;
}

const main = read("src/main.tsx");
const app = read("src/deck-ui/App.tsx");
const headerBar = read("src/deck-ui/HeaderBar.tsx");
const navRail = read("src/deck-ui/NavRail.tsx");
const shell = read("src/deck-ui/Shell.tsx");
const panelHost = read("src/deck-ui/PanelHost.tsx");
const panelRegistry = read("src/deck-ui/panel-registry.tsx");
const panelComponentRegistry = read("src/deck-ui/panel-component-registry.tsx");
const readiness = read("src/deck-ui/panel-readiness.ts");

if (!main.includes('import { DeckGoApp } from "./deck-ui/App"')) {
  fail("src/main.tsx must boot the final deck-ui app");
}

if (main.includes("RestorationPreviewApp")) {
  fail("src/main.tsx still boots the restoration preview app");
}

for (const forbiddenFile of [
  "src/restoration/RestorationPreviewApp.tsx",
  "src/restoration/layout/HeaderBar.tsx",
  "src/restoration/layout/NavRail.tsx",
  "src/restoration/layout/Shell.tsx",
  "src/restoration/ActivePanelHost.tsx",
  "src/restoration/panel-navigation.ts",
  "src/restoration/panel-registry.tsx",
  "src/restoration/contract-readiness.ts",
  "src/restoration/types.ts",
  "src/restoration/ui-store.tsx",
  "src/restoration/panels/RestoredChatPanel.tsx",
  "src/restoration/panels/RestoredChatPanel.test.tsx",
  "src/restoration/panels/chat-state.ts",
  "src/deck-ui/chat/ChatPage.tsx",
  "src/deck-ui/chat/ChatPage.host-cutover.test.tsx",
  "src/deck-ui/chat/ChatPage.network-recovery.test.tsx",
  "src/deck-ui/chat/useChatController.ts",
  "src/deck-ui/chat/chat-state.ts",
  "src/deck-ui/legacy-panel-bridge.tsx",
  "src/deck-ui/ActivePanelHost.legacy-bridge.test.tsx",
  "src/restoration/panels/RestoredAgentsPanel.tsx",
  "src/restoration/panels/RestoredActivityPanel.tsx",
  "src/restoration/panels/RestoredAlertsPanel.tsx",
  "src/restoration/panels/RestoredApiExplorerPanel.tsx",
  "src/restoration/panels/RestoredApprovalsPanel.tsx",
  "src/restoration/panels/RestoredBudgetPanel.tsx",
  "src/restoration/panels/RestoredChannelsPanel.tsx",
  "src/restoration/panels/RestoredConfigPanel.tsx",
  "src/restoration/panels/RestoredCronPanel.tsx",
  "src/restoration/panels/RestoredDocsPanel.tsx",
  "src/restoration/panels/RestoredGatewayPanel.tsx",
  "src/restoration/panels/RestoredIdentityPanel.tsx",
  "src/restoration/panels/RestoredLogsPanel.tsx",
  "src/restoration/panels/RestoredMemoryPanel.tsx",
  "src/restoration/panels/RestoredModelsPanel.tsx",
  "src/restoration/panels/RestoredNodesPanel.tsx",
  "src/restoration/panels/RestoredPluginsPanel.tsx",
  "src/restoration/panels/RestoredRoutingPanel.tsx",
  "src/restoration/panels/RestoredSessionsPanel.tsx",
  "src/restoration/panels/RestoredSettingsPanel.tsx",
  "src/restoration/panels/RestoredSkillsPanel.tsx",
  "src/restoration/panels/RestoredSubagentsPanel.tsx",
  "src/restoration/panels/RestoredThreadsPanel.tsx",
  "src/restoration/panels/RestoredUsagePanel.tsx",
  "src/restoration/panels/RestoredWebhooksPanel.tsx",
  "src/restoration/use-restoration-shortcuts.ts",
  "src/restoration/use-restoration-viewport.ts",
  "src/shell-components.tsx",
  "src/shell-components.test.tsx",
]) {
  if (existsSync(new URL(forbiddenFile, frontendRoot))) {
    fail(`retired restoration preview shell still exists: ${forbiddenFile}`);
  }
}

const restorationSourceFiles = walkFiles("src/restoration").filter(
  (file) =>
    file.endsWith(".ts") || file.endsWith(".tsx") || file.endsWith(".js") || file.endsWith(".jsx"),
);
if (restorationSourceFiles.length > 0) {
  fail(
    `src/restoration must stay retired; found ${restorationSourceFiles
      .map((file) => path.relative(frontendRoot.pathname, file))
      .join(", ")}`,
  );
}

if (existsSync(new URL("src/restoration", frontendRoot))) {
  fail("src/restoration directory must stay retired");
}

if (!panelHost.includes('activePanel === "chat"') || !panelHost.includes("<ChatPanel />")) {
  fail("deck-ui PanelHost must route Chat to the active ChatPanel");
}

const panelIds = [...panelRegistry.matchAll(/\bid:\s*"([^"]+)"/g)].map((match) => match[1]);
const duplicatePanelIds = panelIds.filter((id, index) => panelIds.indexOf(id) !== index);
if (duplicatePanelIds.length > 0) {
  fail(`panel registry contains duplicate ids: ${[...new Set(duplicatePanelIds)].join(", ")}`);
}

if (!panelIds.includes("chat")) {
  fail("panel registry must include chat");
}

const missingComponentCases = panelIds
  .filter((id) => id !== "chat")
  .filter((id) => !panelComponentRegistry.includes(`case "${id}":`));
if (missingComponentCases.length > 0) {
  fail(`panel component registry missing cases: ${missingComponentCases.join(", ")}`);
}

const unexpectedComponentCases = [...panelComponentRegistry.matchAll(/\bcase\s+"([^"]+)":/g)]
  .map((match) => match[1])
  .filter((id) => !panelIds.includes(id));
if (unexpectedComponentCases.length > 0) {
  fail(`panel component registry has unknown cases: ${unexpectedComponentCases.join(", ")}`);
}

for (const forbidden of ["Stage 3 active host", "restored shell", "Deck Go operator shell"]) {
  if (app.includes(forbidden) || panelHost.includes(forbidden)) {
    fail(`final deck-ui surface still contains retired copy: ${forbidden}`);
  }
}

if (
  [app, panelHost, read("src/deck-ui/panel-readiness.ts")].some((source) =>
    source.includes("Provisional adapter"),
  )
) {
  fail("final deck-ui surface still contains provisional adapter copy");
}

for (const forbiddenImport of [
  "../restoration/ActivePanelHost",
  "../restoration/panel-registry",
  "../restoration/ui-store",
  "../restoration/use-restoration-shortcuts",
  "../restoration/use-restoration-viewport",
]) {
  if (
    [app, headerBar, navRail, shell, panelHost].some((source) => source.includes(forbiddenImport))
  ) {
    fail(`final deck-ui host still imports restoration runtime spine: ${forbiddenImport}`);
  }
}

const nonReadyStatuses = [...readiness.matchAll(/\bstatus:\s*"([^"]+)"/g)]
  .map((match) => match[1])
  .filter((status) => status !== "ready");
if (nonReadyStatuses.length > 0) {
  fail(`panel-readiness contains non-ready statuses: ${nonReadyStatuses.join(", ")}`);
}

const checkedFiles = walkFiles("src/deck-ui").filter(
  (file) => file.endsWith(".ts") || file.endsWith(".tsx"),
);
const activeCopyFiles = [
  ...walkFiles("src/components"),
  ...walkFiles("src/deck-ui"),
  ...walkFiles("src/i18n"),
  ...walkFiles("src/stores"),
  new URL("src/theme.css", frontendRoot).pathname,
].filter((file) => {
  const relativePath = path.relative(frontendRoot.pathname, file);
  return (
    [".ts", ".tsx", ".json", ".css"].includes(path.extname(file)) &&
    !relativePath.includes("/__tests__/") &&
    !relativePath.includes(".test.")
  );
});
const badHelperHits = [];
const illegalDeckUIRestorationImports = [];
const illegalLegacyRuntimePreferenceHits = [];
const retiredCopyPatterns = [
  ["deck-ui-provisional", "unused provisional UI class"],
  ["Restored logs", "migration-era Logs panel subtitle"],
  ["fallback diagnostics column", "migration-era fallback diagnostics copy"],
  ["placeholder path", "migration-era placeholder-path copy"],
  ["stable placeholder surface", "migration-era placeholder surface copy"],
  ["not wired into Deck yet", "stale disconnected-data copy"],
  ["Settings coming soon", "stale channel settings placeholder"],
  ["Vite-owned", "implementation-era Vite ownership copy"],
  ["This slice", "implementation-era slice copy"],
  ["First Vite-owned", "implementation-era first-slice copy"],
  ["Bounded Vite-owned", "implementation-era bounded-slice copy"],
  ["Stage 3 anchored", "implementation-era stage copy"],
  ["First Stage", "implementation-era stage copy"],
  ["This tranche", "implementation-era tranche copy"],
  ["capability slice", "implementation-era slice copy"],
  ["Migrated panel host", "migration-era fallback host copy"],
  ["Preview the migrated", "migration-era panel navigation copy"],
  ["old Next-style", "migration-era parity copy"],
  ["not the legacy", "migration-era contrast copy"],
  ["migrated field-level", "migration-era migrated-helper copy"],
  ["during the migration period", "migration-era compatibility comment"],
  ["migration compatibility", "migration-era compatibility comment"],
  ["Legacy session info", "migration-era session-type comment"],
  ["later adapter tranche", "implementation-era adapter copy"],
  ["remaining work", "implementation-era remaining-work copy"],
  ["ready-with-adapter", "implementation-era readiness status"],
  ["deckgo-restored-", "migration-era restored CSS class"],
  ["restored-shell", "migration-era surface query value"],
];
const retiredCopyHits = [];

for (const filePath of checkedFiles) {
  const source = readFileSync(filePath, "utf8");
  const relativePath = path.relative(frontendRoot.pathname, filePath);

  if (source.includes('"../restoration/') || source.includes('"../../restoration/')) {
    illegalDeckUIRestorationImports.push(relativePath);
  }

  if (source.includes(".toSorted(")) {
    badHelperHits.push(`${relativePath} uses toSorted`);
  }
  if (source.includes("reduce((sum, value)")) {
    badHelperHits.push(`${relativePath} uses an untyped reduce accumulator`);
  }
}

if (illegalDeckUIRestorationImports.length > 0) {
  fail(
    `deck-ui runtime files import retired restoration runtime: ${illegalDeckUIRestorationImports.join(", ")}`,
  );
}

if (badHelperHits.length > 0) {
  fail(badHelperHits.join("; "));
}

for (const filePath of activeCopyFiles) {
  const source = readFileSync(filePath, "utf8");
  const relativePath = path.relative(frontendRoot.pathname, filePath);

  if (source.includes("deckGoRestoration") && relativePath !== "src/deck-ui/ui-store.tsx") {
    illegalLegacyRuntimePreferenceHits.push(relativePath);
  }

  for (const [pattern, description] of retiredCopyPatterns) {
    if (source.includes(pattern)) {
      retiredCopyHits.push(`${relativePath} contains ${description}: ${pattern}`);
    }
  }
}

if (retiredCopyHits.length > 0) {
  fail(retiredCopyHits.join("; "));
}

if (illegalLegacyRuntimePreferenceHits.length > 0) {
  fail(
    `active sources use retired restoration runtime preference keys outside ui-store compatibility: ${illegalLegacyRuntimePreferenceHits.join(", ")}`,
  );
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log(
  `[deck-ui-host-check] verified final deck-ui host, ChatPanel routing, ${checkedFiles.length} UI files, ${activeCopyFiles.length} active copy files, and all panel readiness entries ready`,
);
