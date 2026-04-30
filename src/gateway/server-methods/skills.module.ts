import type { GatewayMethodModule } from "../method-registry.js";
import { skillsMethodDefs } from "./skills-method-defs.js";
import { skillsHandlers } from "./skills.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "skills",
  priority: 210,
  handlers: skillsHandlers,
  methodDefs: skillsMethodDefs,
};
