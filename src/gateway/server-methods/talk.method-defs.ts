import type { GatewayMethodMetadataModule } from "../method-registry.js";
import { talkMethodDefs } from "./talk-method-defs.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "talk",
  priority: 110,
  methodDefs: talkMethodDefs,
};
