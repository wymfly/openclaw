import type { GatewayMethodMetadataModule } from "../../method-registry.js";
import { deckAgentsSkillsMethodDefs } from "./agents-skills.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "deck-agents-skills",
  priority: 82,
  methodDefs: deckAgentsSkillsMethodDefs,
};
