import type { ChannelUiRegistryEntry } from "./channel-ui-types";
import { createCurrentGenericEntry } from "./registry-base";

export const openClawWeixinUiDefinition: ChannelUiRegistryEntry = createCurrentGenericEntry(
  "openclaw-weixin",
  {
    pluginId: "openclaw-weixin",
    mode: "hybrid",
    ownership: {
      onboarding: "descriptor",
      settings: "custom",
      access: "none",
    },
    actionBehaviors: {
      login: "custom",
      probe: "generic",
    },
  },
);
