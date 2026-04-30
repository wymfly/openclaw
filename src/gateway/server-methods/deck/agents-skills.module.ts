import type { GatewayMethodModule } from "../../method-registry.js";
import { deckAgentsSkillsHandlers, deckAgentsSkillsMethodDefs } from "./agents-skills.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "deck-agents-skills",
  priority: 332,
  handlers: deckAgentsSkillsHandlers,
  methodDefs: deckAgentsSkillsMethodDefs,
};
