import type { ChannelUiRegistryEntry } from "./channel-ui-types";
import { createCurrentGenericEntry } from "./registry-base";

export const wecomUiDefinition: ChannelUiRegistryEntry = createCurrentGenericEntry("wecom", {
  pluginId: "wecom",
  mode: "hybrid",
  shellVariant: "secondary-page-shell",
  pages: [
    { key: "overview", enabled: true, entryVisible: true, hostTab: "status", behavior: "custom" },
    {
      key: "onboarding",
      enabled: true,
      entryVisible: true,
      hostTab: "status",
      behavior: "custom",
    },
    { key: "access", enabled: true, entryVisible: true, hostTab: "access", behavior: "custom" },
    {
      key: "settings",
      enabled: true,
      entryVisible: false,
      hostTab: "settings",
      behavior: "custom",
    },
    {
      key: "diagnostics",
      enabled: true,
      entryVisible: false,
      hostTab: "status",
      behavior: "custom",
    },
    {
      key: "capabilities",
      enabled: true,
      entryVisible: false,
      hostTab: "status",
      behavior: "custom",
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
  ownership: {
    onboarding: "descriptor",
    settings: "hybrid",
    access: "descriptor",
  },
  actionBehaviors: {
    login: "custom",
    probe: "generic",
    testMessage: "generic",
  },
});
