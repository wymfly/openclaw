const accountIdProperty = {
  type: "string",
  minLength: 1,
  description: "可选：指定企业微信账号 ID；不填时按 agent 账号/默认账号自动选择",
};

const departmentIdProperty = {
  type: "integer",
  description: "部门 ID",
};

const tagIdProperty = {
  type: "integer",
  description: "标签 ID",
};

const useridProperty = {
  type: "string",
  minLength: 1,
  description: "成员 userid",
};

export const wecomContactToolSchema = {
  type: "object",
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "userid"],
      properties: {
        action: { const: "get_member" },
        accountId: accountIdProperty,
        userid: useridProperty,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "departmentId"],
      properties: {
        action: { const: "list_members" },
        accountId: accountIdProperty,
        departmentId: departmentIdProperty,
        simple: {
          type: "boolean",
          description: "是否返回简要成员信息（true=调用 /user/simplelist）",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action"],
      properties: {
        action: { const: "list_departments" },
        accountId: accountIdProperty,
        parentId: {
          type: "integer",
          description: "可选：父部门 ID；不填时返回全部部门",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "departmentId"],
      properties: {
        action: { const: "get_department" },
        accountId: accountIdProperty,
        departmentId: departmentIdProperty,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "tagId"],
      properties: {
        action: { const: "list_tag_members" },
        accountId: accountIdProperty,
        tagId: tagIdProperty,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "departmentId", "query"],
      properties: {
        action: { const: "search" },
        accountId: accountIdProperty,
        departmentId: departmentIdProperty,
        query: {
          type: "string",
          minLength: 1,
          description: "搜索关键字（在 name / userid / english_name / position / email 中匹配）",
        },
      },
    },
  ],
} as const;
