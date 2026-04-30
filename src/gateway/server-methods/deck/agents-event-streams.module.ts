import type { GatewayMethodModule } from "../../method-registry.js";
import {
  deckAgentsEventStreamsHandlers,
  deckAgentsEventStreamsMethodDefs,
} from "./agents-event-streams.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "deck-agents-event-streams",
  priority: 334,
  handlers: deckAgentsEventStreamsHandlers,
  methodDefs: deckAgentsEventStreamsMethodDefs,
};
