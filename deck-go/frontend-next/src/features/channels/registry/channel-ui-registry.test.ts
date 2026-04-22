import { describe, expect, it } from "vitest";
import type { ChannelOnboardingDescriptor } from "@/components/panels/channels/onboarding-registry";
import type { ChannelSchemaInfo } from "@/stores/channels";
import type { InventoryPluginEntry } from "@/stores/plugins";
import { resolveChannelUiDefinition } from "./channel-ui-authority";
import { createManifestMetadataFallback } from "./manifest-metadata-fallback";

function makePlugin(overrides: Partial<InventoryPluginEntry> = {}): InventoryPluginEntry {
  return {
    id: overrides.id ?? "plugin",
    name: overrides.name ?? "Plugin",
    origin: overrides.origin ?? "bundled",
    status: overrides.status ?? "active",
    enabled: overrides.enabled ?? true,
    configPath: overrides.configPath ?? "channels.plugin",
    capabilityKinds: overrides.capabilityKinds ?? ["channel"],
    channelIds: overrides.channelIds ?? ["plugin"],
    providerIds: overrides.providerIds ?? [],
    toolNames: overrides.toolNames ?? [],
    diagnostics: overrides.diagnostics ?? [],
    ...overrides,
  };
}

function makeOnboardingDescriptor(channelId: string): ChannelOnboardingDescriptor {
  return {
    channelId,
    kind: "adapter",
    titleKey: "channels.settings.configureWizard",
    renderPanel: () => null,
    renderDialog: () => null,
  };
}

describe("manifest metadata fallback", () => {
  it("normalizes action capabilities, wizard spec, and locale sources", () => {
    const fallback = createManifestMetadataFallback(
      makePlugin({
        deckActionCapabilities: { login: true, probe: true },
        setupWizardSpec: {
          steps: [{ id: "credentials" }],
          onComplete: { action: "channels.patch" },
        },
        locales: { en: { title: "Hello" } },
      }),
    );

    expect(fallback.actionCapabilities).toEqual({
      login: true,
      probe: true,
      testMessage: undefined,
    });
    expect(fallback.hasWizardSpec).toBe(true);
    expect(fallback.hasLocales).toBe(true);
    expect(fallback.sources).toEqual(["deckActionCapabilities", "setupWizardSpec", "locales"]);
  });
});

describe("resolveChannelUiDefinition", () => {
  it("builds a hybrid WeCom definition with local login authority", () => {
    const result = resolveChannelUiDefinition({
      channelId: "wecom",
      plugin: makePlugin({
        id: "wecom",
        channelIds: ["wecom"],
        deckActionCapabilities: { probe: true, testMessage: true },
      }),
      onboardingDescriptor: makeOnboardingDescriptor("wecom"),
      accessDescriptor: { channelId: "wecom", load: async () => null, render: () => null },
    });

    expect(result.mode).toBe("hybrid");
    expect(result.shellVariant).toBe("secondary-page-shell");
    expect(result.ownership.onboarding).toBe("descriptor");
    expect(result.ownership.access).toBe("descriptor");
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "login", enabled: true, source: "local" }),
        expect.objectContaining({ key: "probe", enabled: true, source: "fallback" }),
        expect.objectContaining({ key: "testMessage", enabled: true, source: "fallback" }),
      ]),
    );
    expect(result.pageAliases).toEqual(
      expect.arrayContaining([expect.objectContaining({ from: "status", to: "overview" })]),
    );
    expect(result.pages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "overview", enabled: true, entryVisible: true }),
        expect.objectContaining({ key: "onboarding", enabled: true, entryVisible: true }),
        expect.objectContaining({ key: "access", enabled: true, entryVisible: true }),
        expect.objectContaining({
          key: "settings",
          enabled: true,
          entryVisible: false,
          hostTab: "settings",
        }),
        expect.objectContaining({
          key: "diagnostics",
          enabled: true,
          entryVisible: false,
          hostTab: "status",
        }),
        expect.objectContaining({
          key: "capabilities",
          enabled: true,
          entryVisible: false,
          hostTab: "status",
        }),
        expect.objectContaining({
          key: "bindings",
          enabled: true,
          entryVisible: false,
          hostTab: "bindings",
        }),
        expect.objectContaining({
          key: "analytics",
          enabled: true,
          entryVisible: false,
          hostTab: "analytics",
        }),
      ]),
    );
  });

  it("builds a generic Feishu definition using fallback wizard spec", () => {
    const result = resolveChannelUiDefinition({
      channelId: "feishu",
      plugin: makePlugin({
        id: "feishu",
        channelIds: ["feishu"],
        deckActionCapabilities: { probe: true },
        setupWizardSpec: {
          steps: [{ id: "credentials" }],
          onComplete: { action: "channels.patch" },
        },
        locales: { zh: { title: "飞书" } },
      }),
      onboardingDescriptor: makeOnboardingDescriptor("feishu"),
    });

    expect(result.mode).toBe("generic");
    expect(result.onboarding).toEqual({
      kind: "wizard-spec",
      source: "fallback",
      hasDescriptor: true,
      hasWizardSpec: true,
    });
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "login", enabled: true, source: "fallback" }),
        expect.objectContaining({ key: "probe", enabled: true, source: "fallback" }),
      ]),
    );
    expect(result.fallback.hasLocales).toBe(true);
  });

  it("does not claim fallback onboarding when a wizard-spec owner has no spec payload", () => {
    const result = resolveChannelUiDefinition({
      channelId: "feishu",
      plugin: makePlugin({
        id: "feishu",
        channelIds: ["feishu"],
      }),
    });

    expect(result.onboarding).toEqual({
      kind: "wizard-spec",
      source: "none",
      hasDescriptor: false,
      hasWizardSpec: false,
    });
  });

  it("builds an openclaw-weixin definition on the descriptor path", () => {
    const result = resolveChannelUiDefinition({
      channelId: "openclaw-weixin",
      onboardingDescriptor: makeOnboardingDescriptor("openclaw-weixin"),
    });

    expect(result.mode).toBe("hybrid");
    expect(result.onboarding.source).toBe("local");
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "login", enabled: true, source: "local" }),
      ]),
    );
  });

  it("enables WeCom login from the real local descriptor path without override injection", () => {
    const result = resolveChannelUiDefinition({
      channelId: "wecom",
    });

    expect(result.onboardingDescriptor).not.toBeNull();
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "login", enabled: true, source: "local" }),
      ]),
    );
  });

  it("enables openclaw-weixin login from the real local descriptor path without override injection", () => {
    const result = resolveChannelUiDefinition({
      channelId: "openclaw-weixin",
    });

    expect(result.onboardingDescriptor).not.toBeNull();
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "login", enabled: true, source: "local" }),
      ]),
    );
  });

  it("returns a schema-only generic definition when no live channel exists", () => {
    const schema: ChannelSchemaInfo = {
      configPath: "channels.telegram",
      schema: { type: "object", properties: { token: { type: "string" } } },
    };
    const result = resolveChannelUiDefinition({
      channelId: "telegram",
      channel: null,
      channelSchema: schema,
    });

    expect(result.mode).toBe("generic");
    expect(result.channelSchemaPresent).toBe(true);
    expect(result.pages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "overview",
          enabled: true,
          entryVisible: true,
          hostTab: "status",
        }),
        expect.objectContaining({
          key: "settings",
          enabled: true,
          entryVisible: false,
          hostTab: "settings",
        }),
        expect.objectContaining({
          key: "bindings",
          enabled: true,
          entryVisible: false,
          hostTab: "bindings",
        }),
        expect.objectContaining({
          key: "access",
          enabled: false,
          entryVisible: false,
          hostTab: "access",
        }),
        expect.objectContaining({
          key: "analytics",
          enabled: false,
          entryVisible: false,
          hostTab: "analytics",
        }),
      ]),
    );
    expect(result.actions).toEqual([]);
  });
});
