import { afterEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import type { UsageSummary } from "../infra/provider-usage.types.js";
import { buildAuthOverview } from "./auth-diagnostics.js";
import { DEFAULT_OAUTH_WARN_MS } from "./auth-health.js";
import type { AuthProfileStore } from "./auth-profiles/types.js";

// Stub out store loading so tests never touch the filesystem.
vi.mock("./auth-profiles/store.js", () => ({
  ensureAuthProfileStore: () => ({ version: 1, profiles: {} }),
  loadAuthProfileStoreForRuntime: () => ({ version: 1, profiles: {} }),
  loadAuthProfileStoreForSecretsRuntime: () => ({ version: 1, profiles: {} }),
  loadAuthProfileStore: () => ({ version: 1, profiles: {} }),
  saveAuthProfileStore: () => {},
  replaceRuntimeAuthProfileStoreSnapshots: () => {},
  clearRuntimeAuthProfileStoreSnapshots: () => {},
}));

const cfg = {} as OpenClawConfig;
const agentDir = "/tmp/test-agent";

function makeStore(
  partial: Partial<AuthProfileStore> & { profiles: AuthProfileStore["profiles"] },
): AuthProfileStore {
  return { version: 1, ...partial };
}

describe("buildAuthOverview", () => {
  const now = 1_700_000_000_000;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ready for provider with valid api_key profile", async () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const store = makeStore({
      profiles: {
        "anthropic:key1": {
          type: "api_key",
          provider: "anthropic",
          key: "sk-ant-test-key",
        },
      },
    });

    const result = await buildAuthOverview({
      providers: ["anthropic"],
      cfg,
      agentDir,
      store,
    });

    expect(result.providers).toHaveLength(1);
    const entry = result.providers[0];
    expect(entry.provider).toBe("anthropic");
    expect(entry.status).toBe("ready");
    expect(entry.auth).toEqual({
      type: "api_key",
      source: "store",
      profileId: "anthropic:key1",
    });
    expect(entry.oauth).toBeUndefined();
    expect(entry.cooldown).toBeUndefined();
  });

  it("returns warning for provider with expiring OAuth", async () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const store = makeStore({
      profiles: {
        "openai:oauth": {
          type: "oauth",
          provider: "openai",
          access: "access-token",
          refresh: "", // no refresh → won't auto-renew
          expires: now + 3_600_000, // 1 hour left, under 24h warn threshold
        },
      },
    });

    const result = await buildAuthOverview({
      providers: ["openai"],
      cfg,
      agentDir,
      store,
    });

    expect(result.providers).toHaveLength(1);
    const entry = result.providers[0];
    expect(entry.provider).toBe("openai");
    expect(entry.status).toBe("warning");
    expect(entry.oauth).toBeDefined();
    expect(entry.oauth!.status).toBe("expiring");
    expect(entry.oauth!.expiresAt).toBe(now + 3_600_000);
  });

  it("returns ready for expired OAuth with valid api_key fallback", async () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const store = makeStore({
      profiles: {
        "anthropic:oauth-expired": {
          type: "oauth",
          provider: "anthropic",
          access: "access-token",
          refresh: "", // no refresh → truly expired
          expires: now - 10_000,
        },
        "anthropic:api": {
          type: "api_key",
          provider: "anthropic",
          key: "sk-ant-fallback",
        },
      },
    });

    const result = await buildAuthOverview({
      providers: ["anthropic"],
      cfg,
      agentDir,
      store,
    });

    expect(result.providers).toHaveLength(1);
    const entry = result.providers[0];
    expect(entry.provider).toBe("anthropic");
    // The best available profile is api_key which is not in cooldown → ready
    expect(entry.status).toBe("ready");
    expect(entry.auth?.type).toBe("api_key");
    expect(entry.auth?.profileId).toBe("anthropic:api");
  });

  it("includes cooldown field when provider has active cooldown", async () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const cooldownUntil = now + 300_000; // 5 minutes from now
    const store = makeStore({
      profiles: {
        "openai:key": {
          type: "api_key",
          provider: "openai",
          key: "sk-test",
        },
      },
      usageStats: {
        "openai:key": {
          cooldownUntil,
          errorCount: 2,
          failureCounts: { rate_limit: 2 },
        },
      },
    });

    const result = await buildAuthOverview({
      providers: ["openai"],
      cfg,
      agentDir,
      store,
    });

    expect(result.providers).toHaveLength(1);
    const entry = result.providers[0];
    expect(entry.cooldown).toBeDefined();
    expect(entry.cooldown!.reason).toBe("rate_limit");
    expect(entry.cooldown!.until).toBe(cooldownUntil);
    expect(entry.cooldown!.remainingMs).toBe(300_000);
  });

  it("includes usage windows when usage summary is provided", async () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const store = makeStore({
      profiles: {
        "anthropic:key": {
          type: "api_key",
          provider: "anthropic",
          key: "sk-ant-test",
        },
      },
    });

    const usageSummary: UsageSummary = {
      updatedAt: now,
      providers: [
        {
          provider: "anthropic",
          displayName: "Anthropic",
          windows: [
            {
              label: "daily",
              usedPercent: 42,
              resetAt: now + 7_200_000, // 2 hours
            },
            {
              label: "monthly",
              usedPercent: 15,
              resetAt: now + 86_400_000, // 24 hours
            },
          ],
          plan: "pro",
        },
      ],
    };

    const result = await buildAuthOverview({
      providers: ["anthropic"],
      cfg,
      agentDir,
      store,
      usageSummary,
    });

    expect(result.providers).toHaveLength(1);
    const entry = result.providers[0];
    expect(entry.usage).toBeDefined();
    expect(entry.usage!.plan).toBe("pro");
    expect(entry.usage!.windows).toHaveLength(2);
    expect(entry.usage!.windows[0]).toEqual({
      label: "daily",
      usedPercent: 42,
      resetsInMs: 7_200_000,
    });
    expect(entry.usage!.windows[1]).toEqual({
      label: "monthly",
      usedPercent: 15,
      resetsInMs: 86_400_000,
    });
  });

  it("returns unknown for provider with no profiles", async () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const store = makeStore({ profiles: {} });

    const result = await buildAuthOverview({
      providers: ["unknown-provider"],
      cfg,
      agentDir,
      store,
    });

    expect(result.providers).toHaveLength(1);
    const entry = result.providers[0];
    expect(entry.provider).toBe("unknown-provider");
    expect(entry.status).toBe("unknown");
    expect(entry.auth).toBeNull();
    expect(entry.oauth).toBeUndefined();
    expect(entry.cooldown).toBeUndefined();
  });

  it("handles multiple providers in one call", async () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const store = makeStore({
      profiles: {
        "anthropic:key": {
          type: "api_key",
          provider: "anthropic",
          key: "sk-ant-key",
        },
        "openai:oauth": {
          type: "oauth",
          provider: "openai",
          access: "access",
          refresh: "refresh",
          expires: now + DEFAULT_OAUTH_WARN_MS + 60_000,
        },
      },
    });

    const result = await buildAuthOverview({
      providers: ["anthropic", "openai", "google"],
      cfg,
      agentDir,
      store,
    });

    expect(result.providers).toHaveLength(3);

    const anthropic = result.providers.find((e) => e.provider === "anthropic");
    expect(anthropic?.status).toBe("ready");

    const openai = result.providers.find((e) => e.provider === "openai");
    expect(openai?.status).toBe("ready");

    const google = result.providers.find((e) => e.provider === "google");
    expect(google?.status).toBe("unknown");
  });

  it("includes cooldown with billing reason for disabled profile", async () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const disabledUntil = now + 3_600_000; // 1 hour
    const store = makeStore({
      profiles: {
        "anthropic:key": {
          type: "api_key",
          provider: "anthropic",
          key: "sk-ant-key",
        },
      },
      usageStats: {
        "anthropic:key": {
          disabledUntil,
          disabledReason: "billing",
          errorCount: 3,
          failureCounts: { billing: 3 },
        },
      },
    });

    const result = await buildAuthOverview({
      providers: ["anthropic"],
      cfg,
      agentDir,
      store,
    });

    const entry = result.providers[0];
    expect(entry.cooldown).toBeDefined();
    expect(entry.cooldown!.reason).toBe("billing");
    expect(entry.cooldown!.until).toBe(disabledUntil);
  });
});
