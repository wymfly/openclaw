import type { GatewayMethodModule } from "../../method-registry.js";
import {
  deckAgentsSubagentsConfigHandlers,
  deckAgentsSubagentsConfigMethodDefs,
} from "./agents-subagents-config.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "deck-agents-subagents-config",
  priority: 333,
  handlers: deckAgentsSubagentsConfigHandlers,
  methodDefs: deckAgentsSubagentsConfigMethodDefs,
};
