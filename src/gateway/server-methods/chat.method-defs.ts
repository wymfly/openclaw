import type { GatewayMethodMetadataModule } from "../method-registry.js";
import { chatMethodDefs } from "./chat-method-defs.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "chat",
  priority: 10,
  methodDefs: chatMethodDefs,
};
