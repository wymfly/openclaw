const accountIdProperty = {
  type: "string",
  minLength: 1,
  description: "可选：指定企业微信账号 ID；不填时按 agent 账号/默认账号自动选择",
};

const spNoProperty = {
  type: "string",
  minLength: 1,
  description: "待办工单编号 (sp_no)",
};

export const wecomTodoToolSchema = {
  type: "object",
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "title", "creator"],
      properties: {
        action: { const: "create" },
        accountId: accountIdProperty,
        title: {
          type: "string",
          minLength: 1,
          description: "待办标题",
        },
        creator: {
          type: "string",
          minLength: 1,
          description: "创建者 userid",
        },
        url: {
          type: "string",
          minLength: 1,
          description: "待办跳转链接",
        },
        appname: {
          type: "string",
          minLength: 1,
          description: "来源应用名称",
        },
        userids: {
          type: "array",
          items: { type: "string", minLength: 1 },
          description: "待办接收人 userid 列表",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "sp_no", "status"],
      properties: {
        action: { const: "update_status" },
        accountId: accountIdProperty,
        sp_no: spNoProperty,
        status: {
          type: "integer",
          enum: [0, 1],
          description: "待办状态：0=未开始，1=已完成",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "sp_no"],
      properties: {
        action: { const: "get" },
        accountId: accountIdProperty,
        sp_no: spNoProperty,
      },
    },
  ],
} as const;
