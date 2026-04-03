// extensions/wecom/src/capability/approval/schema.ts

const accountIdProperty = {
  type: "string",
  minLength: 1,
  description: "可选：指定企业微信账号 ID；不填时按 agent 账号/默认账号自动选择",
};

export const wecomApprovalToolSchema = {
  type: "object",
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "creator_userid", "template_id"],
      properties: {
        action: { const: "submit" },
        accountId: accountIdProperty,
        creator_userid: {
          type: "string",
          minLength: 1,
          description: "申请人 userid",
        },
        template_id: {
          type: "string",
          minLength: 1,
          description: "审批模板 ID",
        },
        use_template_approver: {
          type: "integer",
          enum: [0, 1],
          description: "是否使用模板配置的审批人：0=自定义，1=使用模板",
        },
        approver: {
          type: "array",
          items: {
            type: "object",
            required: ["attr", "userid"],
            properties: {
              attr: {
                type: "integer",
                enum: [1, 2],
                description: "节点审批方式：1=或签，2=会签",
              },
              userid: {
                type: "array",
                items: { type: "string", minLength: 1 },
                description: "审批人 userid 列表",
              },
            },
          },
          description: "审批流程节点列表",
        },
        apply_data: {
          type: "object",
          description: "审批申请数据，格式参见企微 OA API 文档",
        },
        summary_list: {
          type: "array",
          items: {
            type: "object",
            required: ["summary_info"],
            properties: {
              summary_info: {
                type: "array",
                items: {
                  type: "object",
                  required: ["text", "lang"],
                  properties: {
                    text: { type: "string" },
                    lang: { type: "string" },
                  },
                },
              },
            },
          },
          description: "审批摘要信息，显示在审批通知中",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "start_time", "end_time"],
      properties: {
        action: { const: "list" },
        accountId: accountIdProperty,
        start_time: {
          type: "string",
          minLength: 1,
          description: "查询起始时间（Unix 时间戳，秒）",
        },
        end_time: {
          type: "string",
          minLength: 1,
          description: "查询结束时间（Unix 时间戳，秒）",
        },
        template_id: {
          type: "string",
          minLength: 1,
          description: "可选：按模板 ID 过滤",
        },
        cursor: {
          type: "integer",
          description: "分页游标（首次不传，后续传上次返回值）",
        },
        size: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          description: "每页数量，默认 100",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "sp_no"],
      properties: {
        action: { const: "get_detail" },
        accountId: accountIdProperty,
        sp_no: {
          type: "string",
          minLength: 1,
          description: "审批单号",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "template_id"],
      properties: {
        action: { const: "get_template" },
        accountId: accountIdProperty,
        template_id: {
          type: "string",
          minLength: 1,
          description: "审批模板 ID",
        },
      },
    },
  ],
} as const;
