// Contract-shaped mock data for skills prototype.
// Shapes match DeckGo* DTOs in deck-go/contracts/source/deck-api.contract.ts:
//   DeckGoSkillStatus ("ready" | "needs-setup" | "disabled"),
//   DeckGoSkillEntry, DeckGoSkillsResponse, DeckGoSkillInstallOption,
//   DeckGoSkillUpdateResponse,
//   DeckGoSkillHubSearchResult, DeckGoSkillHubSearchResponse,
//   DeckGoSkillHubDetailResponse, DeckGoSkillHubBinsResponse,
//   DeckGoSkillHubMutationResponse.
//
// Skills domain (vs plugins): the contract DOES support a hub (marketplace)
// + install/configure mutations. So this panel has both an "installed"
// inventory mode and a "hub" search/install mode.

window.MOCK = {
  // ── DeckGoSkillsResponse — installed inventory ────────────────────────
  installed: {
    skills: [
      {
        key: "writing-plans",
        name: "Writing Plans",
        status: "ready",
        source: "bundled",
        enabled: true,
        emoji: "📝",
        description:
          "Multi-step task planner. Decomposes a goal into ordered steps with verification gates.",
        homepage: "https://docs.openclaw.io/skills/writing-plans",
        primaryEnv: null,
        installOptions: [],
        config: {
          maxDepth: 4,
          autoVerify: true,
        },
        missingRequirements: [],
      },
      {
        key: "test-driven-development",
        name: "Test-Driven Development",
        status: "ready",
        source: "bundled",
        enabled: true,
        emoji: "🧪",
        description: "Red→Green→Refactor TDD discipline for new features and bug fixes.",
        homepage: "https://docs.openclaw.io/skills/tdd",
        primaryEnv: null,
        config: { strictRedGreen: true },
        missingRequirements: [],
      },
      {
        key: "systematic-debugging",
        name: "Systematic Debugging",
        status: "ready",
        source: "bundled",
        enabled: true,
        emoji: "🪲",
        description: "Hypothesis-driven debugging with stop conditions and evidence tracking.",
        homepage: null,
        primaryEnv: null,
        config: {},
        missingRequirements: [],
      },
      {
        key: "ralph-loop",
        name: "Ralph",
        status: "ready",
        source: "bundled",
        enabled: true,
        emoji: "🪨",
        description: "PRD-driven persistence loop until reviewer-verified completion.",
        homepage: "https://oh-my-claudecode.dev/skills/ralph",
        primaryEnv: null,
        config: { maxIterations: 100, criticDefault: "architect" },
        missingRequirements: [],
      },
      {
        key: "ai-slop-cleaner",
        name: "AI Slop Cleaner",
        status: "ready",
        source: "bundled",
        enabled: true,
        emoji: "🧹",
        description: "Deletion-first cleanup of AI-generated cruft, with regression safety net.",
        homepage: null,
        primaryEnv: null,
        config: { reviewOnly: false },
        missingRequirements: [],
      },
      {
        key: "openspec-propose",
        name: "OpenSpec Propose",
        status: "ready",
        source: "managed",
        enabled: true,
        emoji: "📜",
        description: "Generate proposal/design/tasks artifacts for an OpenSpec change.",
        homepage: "https://hub.openclaw.io/skills/openspec-propose",
        primaryEnv: null,
        installOptions: [
          { id: "managed", label: "Hub (managed)", bins: ["openspec"] },
          { id: "bundled", label: "Bundled (no install)", bins: [] },
        ],
        config: { defaultSchema: "spec-driven" },
        missingRequirements: [],
      },
      {
        key: "ppp-generation",
        name: "PPP Generation",
        status: "needs-setup",
        source: "managed",
        enabled: true,
        emoji: "🛠️",
        description:
          "Industrial-grade Part Production Plans for 3D printing. Generates PrintSpec + Build Package.",
        homepage: "https://hub.openclaw.io/skills/ppp-generation",
        primaryEnv: "PPP_KNOWLEDGE_BASE",
        installOptions: [{ id: "managed", label: "Hub (managed)", bins: ["ppp", "buildpkg"] }],
        config: {},
        missingRequirements: [
          "Set environment variable PPP_KNOWLEDGE_BASE to a writable directory",
          "Install GPT Researcher dependency (pip install gpt-researcher)",
        ],
      },
      {
        key: "qa-testing-playwright",
        name: "QA Testing (Playwright)",
        status: "ready",
        source: "managed",
        enabled: true,
        emoji: "🎭",
        description: "E2E web testing with Playwright — selectors, sharding, network mocking.",
        homepage: "https://hub.openclaw.io/skills/qa-testing-playwright",
        primaryEnv: "PLAYWRIGHT_BROWSERS_PATH",
        installOptions: [{ id: "managed", label: "Hub (managed)", bins: ["playwright"] }],
        config: { headless: true, retries: 2 },
        missingRequirements: [],
      },
      {
        key: "domain-research",
        name: "Domain Research",
        status: "needs-setup",
        source: "managed",
        enabled: true,
        emoji: "🔬",
        description: "AI-driven deep research using GPT Researcher. Auto-saves to Obsidian vault.",
        homepage: "https://hub.openclaw.io/skills/domain-research",
        primaryEnv: "OBSIDIAN_VAULT_PATH",
        installOptions: [{ id: "managed", label: "Hub (managed)", bins: ["gpt-researcher"] }],
        config: {},
        missingRequirements: [
          "Set OBSIDIAN_VAULT_PATH",
          "Provide OPENAI_API_KEY (or compatible LLM key)",
        ],
      },
      {
        key: "obsidian-markdown",
        name: "Obsidian Markdown",
        status: "ready",
        source: "plugin",
        enabled: true,
        emoji: "🪶",
        description: "Wikilinks, callouts, frontmatter, tags, embeds for Obsidian notes.",
        homepage: "https://hub.openclaw.io/plugins/obsidian",
        primaryEnv: null,
        installOptions: [],
        config: {},
        missingRequirements: [],
      },
      {
        key: "gpu-server-ops",
        name: "GPU Server Ops",
        status: "disabled",
        source: "managed",
        enabled: false,
        emoji: "🖥️",
        description:
          "Remote GPU server operations for model deployment and service management (RTX 5090).",
        homepage: null,
        primaryEnv: "GPU_SERVER_HOST",
        installOptions: [{ id: "managed", label: "Hub (managed)", bins: [] }],
        config: { server: "100.84.132.54" },
        missingRequirements: [],
      },
      {
        key: "self-improve",
        name: "Self Improve",
        status: "ready",
        source: "bundled",
        enabled: true,
        emoji: "♻️",
        description: "Autonomous evolutionary code improvement engine with tournament selection.",
        homepage: null,
        primaryEnv: null,
        config: { populationSize: 8 },
        missingRequirements: [],
      },
    ],
  },

  // ── DeckGoSkillHubSearchResponse — marketplace search ─────────────────
  hubSearch: {
    results: [
      {
        score: 0.94,
        slug: "release-orchestrator",
        displayName: "Release Orchestrator",
        summary: "Drive multi-package version bumps, changelogs, and tag flows.",
        version: "1.4.0",
        updatedAt: 1714680000000 - 2 * 86400000,
      },
      {
        score: 0.88,
        slug: "git-worktree-master",
        displayName: "Git Worktree Master",
        summary: "Isolated worktree management for parallel feature work.",
        version: "0.9.0",
        updatedAt: 1714680000000 - 5 * 86400000,
      },
      {
        score: 0.82,
        slug: "claude-md-improver",
        displayName: "CLAUDE.md Improver",
        summary: "Audit and improve CLAUDE.md memory files in repositories.",
        version: "0.6.1",
        updatedAt: 1714680000000 - 9 * 86400000,
      },
      {
        score: 0.79,
        slug: "knowledge-vault",
        displayName: "Knowledge Vault",
        summary: "Search, organize, and maintain Obsidian vault knowledge.",
        version: "0.3.0",
        updatedAt: 1714680000000 - 14 * 86400000,
      },
      {
        score: 0.74,
        slug: "schedule-cron",
        displayName: "Schedule (Cron)",
        summary: "Schedule recurring remote agents with cron expressions.",
        version: "0.4.2",
        updatedAt: 1714680000000 - 21 * 86400000,
      },
      {
        score: 0.69,
        slug: "wiki-knowledge-base",
        displayName: "Wiki",
        summary: "LLM Wiki — persistent markdown knowledge base across sessions.",
        version: "1.0.0",
        updatedAt: 1714680000000 - 28 * 86400000,
      },
      {
        score: 0.61,
        slug: "deep-interview",
        displayName: "Deep Interview",
        summary: "Socratic deep interview with mathematical ambiguity gating.",
        version: "0.7.0",
        updatedAt: 1714680000000 - 30 * 86400000,
      },
      {
        score: 0.55,
        slug: "trace-causal",
        displayName: "Trace (Causal)",
        summary: "Evidence-driven causal investigation with competing hypotheses.",
        version: "0.5.0",
        updatedAt: 1714680000000 - 41 * 86400000,
      },
    ],
  },

  // ── DeckGoSkillHubDetailResponse — keyed by slug ──────────────────────
  hubDetail: {
    "release-orchestrator": {
      skill: {
        slug: "release-orchestrator",
        displayName: "Release Orchestrator",
        summary: "Drive multi-package version bumps, changelogs, and tag flows.",
        tags: { category: "release", language: "any", maturity: "stable" },
        createdAt: 1700000000000,
        updatedAt: 1714680000000 - 2 * 86400000,
      },
      latestVersion: {
        version: "1.4.0",
        createdAt: 1714680000000 - 2 * 86400000,
        changelog:
          "## 1.4.0\n- support workspace npm packages with explicit version pin\n- changelog excerpt template with PR link normalization\n- npm publish dry-run gate before tagging",
      },
      metadata: { os: ["darwin", "linux"], systems: ["node>=20", "git>=2.40"] },
      owner: { handle: "openclaw", displayName: "OpenClaw Maintainers" },
    },
    "git-worktree-master": {
      skill: {
        slug: "git-worktree-master",
        displayName: "Git Worktree Master",
        summary: "Isolated worktree management for parallel feature work.",
        tags: { category: "git", language: "shell", maturity: "stable" },
        createdAt: 1690000000000,
        updatedAt: 1714680000000 - 5 * 86400000,
      },
      latestVersion: {
        version: "0.9.0",
        createdAt: 1714680000000 - 5 * 86400000,
        changelog:
          "## 0.9.0\n- detect lock files before worktree create\n- pre-flight directory write-permission check\n- cleanup helper rolls back on partial failure",
      },
      metadata: { os: ["darwin", "linux", "wsl2"], systems: ["git>=2.30"] },
      owner: { handle: "wymfly", displayName: "wymfly" },
    },
    "claude-md-improver": {
      skill: {
        slug: "claude-md-improver",
        displayName: "CLAUDE.md Improver",
        summary: "Audit and improve CLAUDE.md memory files in repositories.",
        tags: { category: "memory", maturity: "beta" },
        createdAt: 1700000000000,
        updatedAt: 1714680000000 - 9 * 86400000,
      },
      latestVersion: {
        version: "0.6.1",
        createdAt: 1714680000000 - 9 * 86400000,
        changelog: "## 0.6.1\n- safer auto-update; dry-run flag added",
      },
      metadata: { os: null, systems: null },
      owner: { handle: "openclaw", displayName: "OpenClaw Maintainers" },
    },
  },

  // ── DeckGoSkillHubBinsResponse — preview of bins a hub skill exposes ──
  hubBins: {
    "release-orchestrator": { bins: ["release", "tag", "publish"] },
    "git-worktree-master": { bins: ["wtm"] },
    "claude-md-improver": { bins: ["claude-md"] },
    "knowledge-vault": { bins: ["kv", "kv-search"] },
    "schedule-cron": { bins: ["cron"] },
    "wiki-knowledge-base": { bins: ["wiki"] },
    "deep-interview": { bins: ["interview"] },
    "trace-causal": { bins: ["trace"] },
  },

  // ── BFF projection: trigger keyword preview ───────────────────────────
  // Skill SKILL.md frontmatter typically has trigger keywords. The BFF
  // can extract these for UI preview without parsing the file client-side.
  triggers: {
    "writing-plans": ["plan", "implement", "tasks"],
    "test-driven-development": ["tdd", "red green", "test first"],
    "systematic-debugging": ["debug", "reproduce", "hypothesis"],
    "ralph-loop": ["ralph", "ralph mode", "ralph continue"],
    "ai-slop-cleaner": ["deslop", "anti-slop", "cleanup ai"],
    "openspec-propose": ["openspec", "propose", "opsx"],
    "ppp-generation": ["调研打印件", "ppp", "打印方案"],
    "qa-testing-playwright": ["playwright", "e2e test", "qa testing"],
    "domain-research": ["research", "调研", "deep research"],
    "obsidian-markdown": ["obsidian", "wikilink", "callout"],
    "gpu-server-ops": ["部署到服务器", "gpu server", "gpu服务器"],
    "self-improve": ["self-improve", "evolutionary", "tournament"],
  },

  // ── BFF projection: file inventory per skill ──────────────────────────
  // SKILL.md + supporting reference files. BFF can list the manifest dir.
  files: {
    "writing-plans": [
      { path: "SKILL.md", bytes: 2138 },
      { path: "references/example-plan.md", bytes: 4512 },
    ],
    "ralph-loop": [
      { path: "SKILL.md", bytes: 5621 },
      { path: "references/prd-schema.json", bytes: 884 },
      { path: "references/architect-prompt.md", bytes: 1620 },
    ],
    "ppp-generation": [
      { path: "SKILL.md", bytes: 7450 },
      { path: "references/print-spec-template.md", bytes: 3120 },
      { path: "references/build-package-template.md", bytes: 2480 },
      { path: "references/material-properties.json", bytes: 9216 },
    ],
    "qa-testing-playwright": [
      { path: "SKILL.md", bytes: 4090 },
      { path: "references/playwright-config-template.ts", bytes: 1240 },
    ],
  },

  // ── BFF projection: per-skill audit (install / update / disable) ──────
  audit: {
    "ppp-generation": [
      {
        ts: 1714680000000 - 14 * 86400000,
        actor: "wangym",
        action: "installed",
        note: "from hub v0.3.0",
      },
      {
        ts: 1714680000000 - 7 * 86400000,
        actor: "wangym",
        action: "updated",
        note: "0.3.0 → 0.5.2",
      },
      {
        ts: 1714680000000 - 1 * 86400000,
        actor: "system",
        action: "needs-setup",
        note: "PPP_KNOWLEDGE_BASE missing; status flipped to needs-setup",
      },
    ],
    "gpu-server-ops": [
      {
        ts: 1714680000000 - 30 * 86400000,
        actor: "wangym",
        action: "installed",
        note: "from hub v0.4.0",
      },
      {
        ts: 1714680000000 - 3 * 86400000,
        actor: "wangym",
        action: "disabled",
        note: "RTX 5090 maintenance window",
      },
    ],
    "release-orchestrator": [],
  },

  kpis: {
    asOfMs: 1714680000000,
    runtimeId: "deck-runtime-prod-01",
  },
};
