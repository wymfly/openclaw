import type { GatewayMethodMetadataModule, MethodMetadata } from "../method-registry.js";
import { READ_SCOPE } from "../method-scopes.js";
import { CommandsListParamsSchema, CommandsListResultSchema } from "../protocol/schema/commands.js";

export const commandsMethodDefs: Record<string, MethodMetadata> = {
  "commands.list": {
    params: CommandsListParamsSchema,
    result: CommandsListResultSchema,
    scope: READ_SCOPE,
  },
};

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "commands",
  priority: 70,
  methodDefs: commandsMethodDefs,
};
