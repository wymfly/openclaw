import type { GatewayMethodMetadataModule } from "../method-registry.js";
import { wizardMethodDefs } from "./wizard-method-defs.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "wizard",
  priority: 120,
  methodDefs: wizardMethodDefs,
};
