import type { GatewayMethodMetadataModule } from "../method-registry.js";
import { deckPreAgentsMethodDefs } from "./deck/index.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "deck",
  priority: 80,
  methodDefs: deckPreAgentsMethodDefs,
};
