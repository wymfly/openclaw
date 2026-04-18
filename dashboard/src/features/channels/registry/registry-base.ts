import type { ChannelUiPageAlias, ChannelUiRegistryEntry } from "./channel-ui-types";

export const CURRENT_TAB_ALIASES: ChannelUiPageAlias[] = [
  { from: "status", to: "overview" },
  { from: "access", to: "access" },
  { from: "bindings", to: "bindings" },
  { from: "settings", to: "settings" },
  { from: "analytics", to: "analytics" },
];

export function createCurrentGenericEntry(
  channelId: string,
  overrides: Partial<ChannelUiRegistryEntry> = {},
): ChannelUiRegistryEntry {
  return {
    channelId,
    mode: "generic",
    shellVariant: "none",
    pages: [
      {
        key: "overview",
        enabled: true,
        entryVisible: true,
        hostTab: "status",
        behavior: "generic",
      },
      {
        key: "onboarding",
        enabled: false,
        entryVisible: false,
        hostTab: "status",
        behavior: "generic",
      },
      { key: "access", enabled: true, entryVisible: true, hostTab: "access", behavior: "generic" },
      {
        key: "settings",
        enabled: true,
        entryVisible: false,
        hostTab: "settings",
        behavior: "generic",
      },
      {
        key: "diagnostics",
        enabled: false,
        entryVisible: false,
        hostTab: "status",
        behavior: "generic",
      },
      {
        key: "capabilities",
        enabled: false,
        entryVisible: false,
        hostTab: "status",
        behavior: "generic",
      },
      {
        key: "bindings",
        enabled: true,
        entryVisible: false,
        hostTab: "bindings",
        behavior: "generic",
      },
      {
        key: "analytics",
        enabled: true,
        entryVisible: false,
        hostTab: "analytics",
        behavior: "generic",
      },
    ],
    pageAliases: CURRENT_TAB_ALIASES,
    ownership: {
      onboarding: "none",
      settings: "generic",
      access: "none",
    },
    actionBehaviors: {
      probe: "generic",
      testMessage: "generic",
    },
    ...overrides,
  };
}
