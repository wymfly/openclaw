import type { GatewayMethodMetadataModule } from "../method-registry.js";
import { deckPostAgentsMethodDefs } from "./deck/index.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "deck-post-agents",
  priority: 87,
  methodDefs: deckPostAgentsMethodDefs,
};
