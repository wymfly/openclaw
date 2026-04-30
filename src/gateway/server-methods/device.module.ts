import type { GatewayMethodModule } from "../method-registry.js";
import { deviceMethodDefs } from "./device-method-defs.js";
import { deviceHandlers } from "./devices.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "device",
  priority: 90,
  handlers: deviceHandlers,
  methodDefs: deviceMethodDefs,
};
