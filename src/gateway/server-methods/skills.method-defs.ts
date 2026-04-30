import type { GatewayMethodMetadataModule } from "../method-registry.js";
import { skillsMethodDefs } from "./skills-method-defs.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "skills",
  priority: 35,
  methodDefs: skillsMethodDefs,
};
