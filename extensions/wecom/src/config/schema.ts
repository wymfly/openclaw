import { z } from "zod";

function bindToJsonSchema<T extends z.ZodTypeAny>(schema: T): T {
  const schemaWithJson = schema as T & { toJSONSchema?: (...args: unknown[]) => unknown };
  if (typeof schemaWithJson.toJSONSchema === "function") {
    schemaWithJson.toJSONSchema = schemaWithJson.toJSONSchema.bind(schema);
  }
  return schema;
}

const dmSchema = z
  .object({
    policy: z.enum(["pairing", "allowlist", "open", "disabled"]).optional(),
    allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
  })
  .optional();

const mediaSchema = z
  .object({
    tempDir: z.string().optional(),
    retentionHours: z.number().optional(),
    cleanupOnStart: z.boolean().optional(),
    maxBytes: z.number().optional(),
  })
  .optional();

const networkSchema = z
  .object({
    egressProxyUrl: z.string().optional(),
  })
  .optional();

const routingSchema = z
  .object({
    failClosedOnDefaultRoute: z.boolean().optional(),
  })
  .optional();

const botWsSchema = z
  .object({
    botId: z.string(),
    secret: z.string(),
  })
  .optional();

const botWebhookSchema = z
  .object({
    token: z.string(),
    encodingAESKey: z.string(),
    receiveId: z.string().optional(),
  })
  .optional();

const botSchema = z
  .object({
    primaryTransport: z.enum(["ws", "webhook"]).optional(),
    streamPlaceholderContent: z.string().optional(),
    welcomeText: z.string().optional(),
    dm: dmSchema,
    aibotid: z.string().optional(),
    botIds: z.array(z.string()).optional(),
    ws: botWsSchema,
    webhook: botWebhookSchema,
  })
  .optional();

const agentSchema = z
  .object({
    corpId: z.string(),
    agentSecret: z.string().optional(),
    corpSecret: z.string().optional(),
    agentId: z.union([z.number(), z.string()]).optional(),
    token: z.string(),
    encodingAESKey: z.string(),
    welcomeText: z.string().optional(),
    dm: dmSchema,
  })
  .refine((value) => Boolean(value.agentSecret?.trim() || value.corpSecret?.trim()), {
    path: ["agentSecret"],
    message: "agentSecret 不能为空",
  })
  .optional();

const dynamicAgentsSchema = z
  .object({
    enabled: z.boolean().optional(),
    dmCreateAgent: z.boolean().optional(),
    groupEnabled: z.boolean().optional(),
    adminUsers: z.array(z.string()).optional(),
  })
  .optional();

const accountSchema = z.object({
  enabled: z.boolean().optional(),
  name: z.string().optional(),
  bot: botSchema,
  agent: agentSchema,
});

export const WecomConfigSchema = bindToJsonSchema(
  z.object({
    enabled: z.boolean().optional(),
    bot: botSchema,
    agent: agentSchema,
    accounts: z.record(z.string(), accountSchema).optional(),
    defaultAccount: z.string().optional(),
    media: mediaSchema,
    network: networkSchema,
    routing: routingSchema,
    dynamicAgents: dynamicAgentsSchema,
  }),
);

export type WecomConfigInput = z.infer<typeof WecomConfigSchema>;
