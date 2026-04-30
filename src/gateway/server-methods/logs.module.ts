import type { GatewayMethodModule } from "../method-registry.js";
import { logsHandlers } from "./logs.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "logs",
  priority: 20,
  handlers: logsHandlers,
};
