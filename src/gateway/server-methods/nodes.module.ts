import type { GatewayMethodModule } from "../method-registry.js";
import { nodeHandlers } from "./nodes.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "nodes",
  priority: 250,
  handlers: nodeHandlers,
};
