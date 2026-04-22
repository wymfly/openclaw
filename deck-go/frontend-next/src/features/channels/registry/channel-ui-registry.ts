import type { ChannelUiRegistryEntry } from "./channel-ui-types";
import { feishuUiDefinition } from "./feishu-ui-definition";
import { openClawWeixinUiDefinition } from "./openclaw-weixin-ui-definition";
import { createCurrentGenericEntry } from "./registry-base";
import { wecomUiDefinition } from "./wecom-ui-definition";

const CHANNEL_UI_REGISTRY = new Map<string, ChannelUiRegistryEntry>([
  ["wecom", wecomUiDefinition],
  ["feishu", feishuUiDefinition],
  ["openclaw-weixin", openClawWeixinUiDefinition],
]);

export function getChannelUiRegistryEntry(channelId: string): ChannelUiRegistryEntry | null {
  return CHANNEL_UI_REGISTRY.get(channelId) ?? null;
}

export function createGenericChannelUiEntry(channelId: string): ChannelUiRegistryEntry {
  return createCurrentGenericEntry(channelId);
}

export function createSchemaOnlyChannelUiEntry(channelId: string): ChannelUiRegistryEntry {
  return {
    ...createCurrentGenericEntry(channelId),
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
      {
        key: "access",
        enabled: false,
        entryVisible: false,
        hostTab: "access",
        behavior: "generic",
      },
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
        enabled: false,
        entryVisible: false,
        hostTab: "analytics",
        behavior: "generic",
      },
    ],
    ownership: {
      onboarding: "none",
      settings: "generic",
      access: "none",
    },
    actionBehaviors: {},
  };
}
