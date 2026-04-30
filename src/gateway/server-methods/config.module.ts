import type { GatewayMethodModule } from "../method-registry.js";
import { configMethodDefs } from "./config-method-defs.js";
import { configHandlers } from "./config.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "config",
  priority: 150,
  handlers: configHandlers,
  methodDefs: configMethodDefs,
};
