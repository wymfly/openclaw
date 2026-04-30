import type { GatewayMethodModule } from "../method-registry.js";
import { wizardMethodDefs } from "./wizard-method-defs.js";
import { wizardHandlers } from "./wizard.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "wizard",
  priority: 160,
  handlers: wizardHandlers,
  methodDefs: wizardMethodDefs,
};
