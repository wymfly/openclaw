import type { GatewayMethodMetadataModule } from "../../method-registry.js";
import { deckAgentsSubagentsConfigMethodDefs } from "./agents-subagents-config.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "deck-agents-subagents-config",
  priority: 83,
  methodDefs: deckAgentsSubagentsConfigMethodDefs,
};
