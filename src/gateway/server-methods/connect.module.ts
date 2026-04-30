import type { GatewayMethodModule } from "../method-registry.js";
import { connectHandlers } from "./connect.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "connect",
  priority: 10,
  handlers: connectHandlers,
};
