import type { ChannelUiRegistryEntry } from "./channel-ui-types";
import { createCurrentGenericEntry } from "./registry-base";

export const feishuUiDefinition: ChannelUiRegistryEntry = createCurrentGenericEntry("feishu", {
  pluginId: "feishu",
  mode: "generic",
  ownership: {
    onboarding: "wizard-spec",
    settings: "hybrid",
    access: "none",
  },
  actionBehaviors: {
    login: "generic",
    probe: "generic",
    testMessage: "generic",
  },
});
