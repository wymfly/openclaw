import type { GatewayMethodMetadataModule } from "../../method-registry.js";
import { deckAgentsEventStreamsMethodDefs } from "./agents-event-streams.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "deck-agents-event-streams",
  priority: 84,
  methodDefs: deckAgentsEventStreamsMethodDefs,
};
