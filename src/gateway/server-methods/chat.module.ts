import type { GatewayMethodModule } from "../method-registry.js";
import { chatMethodDefs } from "./chat-method-defs.js";
import { chatHandlers } from "./chat.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "chat",
  priority: 60,
  handlers: chatHandlers,
  methodDefs: chatMethodDefs,
};
