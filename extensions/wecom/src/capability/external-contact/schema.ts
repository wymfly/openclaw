// extensions/wecom/src/capability/external-contact/schema.ts

const accountIdProperty = {
  type: "string",
  minLength: 1,
  description: "可选：指定企业微信账号 ID；不填时按 agent 账号/默认账号自动选择",
};

export const wecomExternalContactToolSchema = {
  type: "object",
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "external_userid"],
      properties: {
        action: { const: "get" },
        accountId: accountIdProperty,
        external_userid: {
          type: "string",
          minLength: 1,
          description: "外部联系人的 external_userid",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "userid"],
      properties: {
        action: { const: "list" },
        accountId: accountIdProperty,
        userid: {
          type: "string",
          minLength: 1,
          description: "内部成员 userid，获取该成员的所有外部联系人列表",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action"],
      properties: {
        action: { const: "list_groups" },
        accountId: accountIdProperty,
        status_filter: {
          type: "integer",
          enum: [0, 1, 2, 3],
          description: "群状态过滤：0=正常，1=跟进人离职，2=离职继承中，3=离职继承完成",
        },
        owner_filter: {
          type: "object",
          properties: {
            userid_list: {
              type: "array",
              items: { type: "string", minLength: 1 },
              description: "按群主 userid 过滤",
            },
          },
          description: "群主过滤条件",
        },
        cursor: {
          type: "string",
          description: "分页游标（传上一页返回的 next_cursor）",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 1000,
          description: "每页数量，默认 100，最大 1000",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "chat_id"],
      properties: {
        action: { const: "get_group_detail" },
        accountId: accountIdProperty,
        chat_id: {
          type: "string",
          minLength: 1,
          description: "客户群 chat_id（从 list_groups 获取）",
        },
      },
    },
  ],
} as const;
