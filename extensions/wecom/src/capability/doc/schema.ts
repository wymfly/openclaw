const accountIdProperty = {
  type: "string",
  minLength: 1,
  description: "可选：指定企业微信账号 ID；不填时按 agent 账号/默认账号自动选择",
};

const docTypeProperty = {
  oneOf: [
    {
      type: "string",
      enum: ["doc", "spreadsheet", "smart_table"],
    },
    {
      type: "integer",
      enum: [3, 4, 10],
    },
  ],
  default: "doc",
  description: "文档类型：doc=文档，spreadsheet=表格，smart_table=智能表格",
};

const sheetIdProperty = {
  type: "string",
  minLength: 1,
  description: "子表 ID (sheet_id)",
};

const cellValueKeyTypeProperty = {
  type: "string",
  enum: ["CELL_VALUE_KEY_TYPE_FIELD_TITLE", "CELL_VALUE_KEY_TYPE_FIELD_ID"],
  description:
    "values key 类型：FIELD_TITLE 表示字段标题，FIELD_ID 表示字段 ID；不传时按字段标题处理。不要把此参数套用到 wecom_mcp，按当前工具 schema 调用。",
};

const smartsheetSheetPropertiesSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    sheet_id: { type: "string", minLength: 1, description: "子表 ID；更新子表时必填" },
    title: { type: "string", minLength: 1, description: "子表标题" },
  },
  description: "官方 MCP/企业微信智能表子表 properties 对象",
};

const docIdProperty = {
  type: "string",
  minLength: 1,
  description: "文档 docid",
};

const formIdProperty = {
  type: "string",
  minLength: 1,
  description: "收集表 formid",
};

const shareUrlProperty = {
  type: "string",
  minLength: 1,
  description: "企业微信文档分享链接",
};

const genericObjectProperty = {
  type: "object",
  additionalProperties: true,
};

const nonEmptyObjectProperty = {
  ...genericObjectProperty,
  minProperties: 1,
};

const collectQuestionSchema = {
  type: "object",
  additionalProperties: true,
  required: ["question_id", "title", "pos", "reply_type", "must_reply"],
  properties: {
    question_id: { type: "integer", minimum: 1, description: "问题 ID，从 1 开始" },
    title: { type: "string", minLength: 1, description: "问题标题" },
    pos: { type: "integer", minimum: 1, description: "问题排序位置，从 1 开始" },
    status: { type: "integer", description: "可选：问题状态" },
    reply_type: {
      type: "integer",
      description:
        "问题类型：1 文本，2 单选，3 多选，5 位置，9 图片，10 文件，11 日期，14 时间，15 下拉列表等",
    },
    must_reply: { type: "boolean", description: "是否必填" },
    option_item: {
      type: "array",
      items: genericObjectProperty,
      description: "单选/多选/下拉列表的问题选项",
    },
  },
};

const collectQuestionItemsSchema = {
  type: "array",
  minItems: 1,
  maxItems: 200,
  items: collectQuestionSchema,
  description: "收集表问题数组；企业微信当前后端不接受空数组",
};

const collectFormQuestionSchema = {
  type: "object",
  additionalProperties: true,
  required: ["items"],
  properties: {
    items: collectQuestionItemsSchema,
  },
};

const collectFormInfoSchema = {
  type: "object",
  additionalProperties: true,
  required: ["form_title", "form_question"],
  properties: {
    form_title: { type: "string", minLength: 1, description: "收集表标题" },
    form_desc: { type: "string", description: "可选：收集表描述" },
    form_header: { type: "string", description: "可选：收集表头图" },
    form_question: collectFormQuestionSchema,
    form_setting: { ...genericObjectProperty, description: "可选：收集表设置" },
  },
};

const collectRequestSchema = {
  type: "object",
  additionalProperties: true,
  anyOf: [
    { required: ["form_info"] },
    { required: ["formInfo"] },
    { required: ["form_title", "items"] },
    { required: ["form_title", "questions"] },
  ],
  properties: {
    form_info: collectFormInfoSchema,
    formInfo: collectFormInfoSchema,
    form_title: { type: "string", minLength: 1, description: "收集表标题" },
    items: collectQuestionItemsSchema,
    questions: collectQuestionItemsSchema,
    form_setting: { ...genericObjectProperty, description: "可选：收集表设置" },
  },
};

// --- Doc Permission Schemas ---

const coAuthListProperty = {
  type: "array",
  items: {
    type: "object",
    required: ["departmentid", "auth", "type"],
    properties: {
      departmentid: { type: "integer", description: "特定部门id" },
      auth: { type: "integer", enum: [1], description: "1:只读；企业微信当前仅支持只读" },
      type: { type: "integer", const: 2, description: "2:部门" },
    },
  },
};

const collectFormStatisticRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["repeated_id", "req_type"],
  properties: {
    repeated_id: {
      type: "string",
      minLength: 1,
      description:
        "收集表周期 ID，来自 get_form_info 返回的 repeated_id；若误填为同一请求的 formId，插件会用 formId 解析真实 repeated_id",
    },
    req_type: {
      type: "integer",
      enum: [1, 2, 3],
      description: "1-统计结果；2-已提交列表；3-未提交列表",
    },
    start_time: {
      type: "integer",
      description: "req_type=2 已提交列表的开始时间戳；省略时默认当天 00:00:00",
    },
    end_time: {
      type: "integer",
      description: "req_type=2 已提交列表的结束时间戳；省略时默认当天 23:59:59",
    },
    limit: {
      type: "integer",
      minimum: 1,
      description: "req_type=2/3 列表查询每页数量；省略时默认 100",
    },
    cursor: { type: "integer", minimum: 0, description: "可选：分页游标" },
  },
};

const docMemberListProperty = {
  type: "array",
  items: {
    type: "object",
    required: ["type", "auth"],
    properties: {
      type: { type: "integer", const: 1, description: "1:用户" },
      userid: { type: "string", description: "企业成员userid" },
      tmp_external_userid: { type: "string", description: "外部用户临时id" },
      auth: { type: "integer", enum: [1, 2, 7], description: "1:只读 2:读写 7:管理员" },
    },
  },
};

const delDocMemberListProperty = {
  type: "array",
  items: {
    type: "object",
    required: ["type"],
    properties: {
      type: { type: "integer", const: 1 },
      userid: { type: "string" },
      tmp_external_userid: { type: "string" },
    },
  },
};

const watermarkProperty = {
  type: "object",
  properties: {
    margin_type: { type: "integer", enum: [1, 2], description: "1:稀疏, 2:紧密" },
    show_visitor_name: { type: "boolean" },
    show_text: { type: "boolean" },
    text: { type: "string" },
  },
};

// --- Smartsheet Permission Schemas ---

const fieldRuleListSchema = {
  type: "array",
  items: {
    type: "object",
    required: ["field_id", "can_edit", "can_insert", "can_view"],
    properties: {
      field_id: { type: "string" },
      field_type: { type: "string" },
      can_edit: { type: "boolean" },
      can_insert: { type: "boolean" },
      can_view: { type: "boolean" },
    },
  },
};

const fieldPrivSchema = {
  type: "object",
  required: ["field_range_type", "field_rule_list"],
  properties: {
    field_range_type: { type: "integer", enum: [1, 2], description: "1-所有字段；2-部分字段" },
    field_rule_list: fieldRuleListSchema,
    field_default_rule: {
      type: "object",
      properties: {
        can_edit: { type: "boolean" },
        can_insert: { type: "boolean" },
        can_view: { type: "boolean" },
      },
    },
  },
};

const recordRuleListSchema = {
  type: "array",
  items: {
    type: "object",
    required: ["field_id", "oper_type"],
    properties: {
      field_id: { type: "string" },
      field_type: { type: "string" },
      oper_type: {
        type: "integer",
        description: "1-包含自己; 2-包含value; 3-不包含; 4-等于; 5-不等于; 6-为空; 7-非空",
      },
      value: { type: "array", items: { type: "string" } },
    },
  },
};

const recordPrivSchema = {
  type: "object",
  required: ["record_range_type"],
  properties: {
    record_range_type: {
      type: "integer",
      enum: [1, 2, 3],
      description: "1-全部; 2-任意条件; 3-全部条件",
    },
    record_rule_list: recordRuleListSchema,
    other_priv: { type: "integer", enum: [1, 2], description: "1-不可编辑; 2-不可查看" },
  },
};

const sheetPrivValueSchema = {
  type: "integer",
  enum: [1, 2, 3, 4],
  description: "1-全部权限；2-可编辑；3-仅浏览；4-无权限。正式工具契约只暴露整数枚举。",
};

const privListSchema = {
  type: "array",
  items: {
    type: "object",
    required: ["sheet_id", "priv"],
    properties: {
      sheet_id: { type: "string" },
      priv: sheetPrivValueSchema,
      can_insert_record: { type: "boolean" },
      can_delete_record: { type: "boolean" },
      can_create_modify_delete_view: { type: "boolean" },
      field_priv: fieldPrivSchema,
      record_priv: recordPrivSchema,
      clear: { type: "boolean" },
    },
  },
};

const memberRangeSchema = {
  type: "object",
  properties: {
    userid_list: { type: "array", items: { type: "string" } },
  },
};

const fieldGroupChildProperty = {
  oneOf: [
    { type: "string" },
    {
      type: "object",
      required: ["field_id"],
      properties: {
        field_id: { type: "string" },
      },
    },
  ],
};

// --- Doc Content Update Schemas ---

const locationProperty = {
  type: "object",
  required: ["index"],
  properties: {
    index: { type: "integer", minimum: 0, description: "位置索引" },
  },
};

const rangeProperty = {
  type: "object",
  required: ["start_index", "length"],
  properties: {
    start_index: { type: "integer", minimum: 0, description: "起始位置" },
    length: { type: "integer", minimum: 1, description: "长度" },
  },
};

const textPropertySchema = {
  type: "object",
  description: "文本属性",
  properties: {
    bold: { type: "boolean" },
    italics: { type: "boolean" },
    underline: { type: "boolean" },
    strike: { type: "boolean" },
    color: { type: "string", pattern: "^[0-9A-Fa-f]{6}$", description: "RRGGBB 格式颜色" },
    background_color: {
      type: "string",
      pattern: "^[0-9A-Fa-f]{6}$",
      description: "RRGGBB 格式背景色",
    },
    size: { type: "integer", description: "字体大小（half-points）" },
  },
};

const insertTextRequest = {
  type: "object",
  required: ["text", "location"],
  properties: {
    text: { type: "string", minLength: 1 },
    location: locationProperty,
  },
};

const replaceTextRequest = {
  type: "object",
  required: ["text", "ranges"],
  properties: {
    text: { type: "string" },
    ranges: { type: "array", items: rangeProperty, minItems: 1 },
  },
};

const deleteContentRequest = {
  type: "object",
  required: ["range"],
  properties: {
    range: rangeProperty,
  },
};

const updateTextPropertyRequest = {
  type: "object",
  required: ["text_property", "ranges"],
  properties: {
    text_property: textPropertySchema,
    ranges: { type: "array", items: rangeProperty, minItems: 1 },
  },
};

const insertImageRequest = {
  type: "object",
  required: ["image_id", "location"],
  properties: {
    image_id: { type: "string", description: "上传图片获得的 image_id/url" },
    location: locationProperty,
    width: { type: "integer", description: "宽(px)" },
    height: { type: "integer", description: "高(px)" },
  },
};

const insertPageBreakRequest = {
  type: "object",
  required: ["location"],
  properties: {
    location: locationProperty,
  },
};

const insertTableRequest = {
  type: "object",
  required: ["rows", "cols", "location"],
  properties: {
    rows: { type: "integer", minimum: 1, maximum: 100 },
    cols: { type: "integer", minimum: 1, maximum: 60 },
    location: locationProperty,
  },
};

const insertParagraphRequest = {
  type: "object",
  description: "在指定位置插入段落。注意：请使用此操作来分段，而不是在 insert_text 中使用换行符。",
  required: ["location"],
  properties: {
    location: locationProperty,
  },
};

const docMemberEntryProperty = {
  oneOf: [
    { type: "string", minLength: 1 },
    { type: "object", additionalProperties: true, minProperties: 1 },
  ],
};

const docMemberEntryArrayProperty = {
  type: "array",
  minItems: 1,
  items: docMemberEntryProperty,
};

export const wecomDocToolSchema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId"],
      properties: {
        action: { const: "get_doc_security_setting" },
        accountId: accountIdProperty,
        docId: docIdProperty,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "setting"],
      properties: {
        action: { const: "mod_doc_security_setting" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        setting: nonEmptyObjectProperty,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docName"],
      properties: {
        action: { const: "create" },
        accountId: accountIdProperty,
        docName: {
          type: "string",
          minLength: 1,
          description: "文档名称",
        },
        docType: docTypeProperty,
        spaceId: {
          type: "string",
          minLength: 1,
          description: "可选：文档空间 ID",
        },
        fatherId: {
          type: "string",
          minLength: 1,
          description: "可选：父目录 fileid；传 spaceId 时通常也应传 fatherId",
        },
        adminUsers: {
          type: "array",
          description: "可选：文档管理员 userid 列表",
          items: {
            type: "string",
            minLength: 1,
          },
        },
        viewers: {
          ...docMemberEntryArrayProperty,
          description: "可选：创建后立即授予查看权限的成员列表",
        },
        collaborators: {
          ...docMemberEntryArrayProperty,
          description: "可选：创建后立即授予协作者权限的成员列表",
        },
        init_content: {
          type: "array",
          description:
            "可选：初始文档内容（段落列表）。支持纯文本字符串或图片对象。插件会自动处理段落分隔，确保标题和正文分离。",
          items: {
            oneOf: [
              {
                type: "string",
                description: "段落文本内容",
              },
              {
                type: "object",
                additionalProperties: false,
                required: ["type", "url"],
                properties: {
                  type: {
                    type: "string",
                    const: "image",
                    description: "内容类型：image 表示图片",
                  },
                  url: {
                    type: "string",
                    description: "图片 URL（支持 http/https 链接）",
                  },
                },
              },
            ],
          },
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "newName"],
      properties: {
        action: { const: "rename" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        newName: {
          type: "string",
          minLength: 1,
          description: "新文档名",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId"],
      properties: {
        action: { const: "get_info" },
        accountId: accountIdProperty,
        docId: docIdProperty,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId"],
      properties: {
        action: { const: "share" },
        accountId: accountIdProperty,
        docId: docIdProperty,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId"],
      properties: {
        action: { const: "get_auth" },
        accountId: accountIdProperty,
        docId: docIdProperty,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId"],
      properties: {
        action: { const: "diagnose_auth" },
        accountId: accountIdProperty,
        docId: docIdProperty,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "shareUrl"],
      properties: {
        action: { const: "validate_share_link" },
        accountId: accountIdProperty,
        shareUrl: shareUrlProperty,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action"],
      anyOf: [{ required: ["docId"] }, { required: ["formId"] }],
      properties: {
        action: { const: "delete" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        formId: formIdProperty,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "request"],
      properties: {
        action: { const: "set_join_rule" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        request: {
          type: "object",
          description: "mod_doc_join_rule 请求体。插件会自动补 docid。",
          additionalProperties: false,
          properties: {
            enable_corp_internal: { type: "boolean" },
            corp_internal_auth: {
              type: "integer",
              enum: [1],
              description: "1:只读；企业微信当前不支持 2:读写",
            },
            enable_corp_external: { type: "boolean" },
            corp_external_auth: {
              type: "integer",
              enum: [1],
              description: "1:只读；企业微信当前不支持 2:读写",
            },
            corp_internal_approve_only_by_admin: { type: "boolean" },
            corp_external_approve_only_by_admin: { type: "boolean" },
            ban_share_external: { type: "boolean" },
            update_co_auth_list: { type: "boolean" },
            co_auth_list: coAuthListProperty,
          },
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId"],
      anyOf: [
        { required: ["viewers"] },
        { required: ["collaborators"] },
        { required: ["removeViewers"] },
        { required: ["removeCollaborators"] },
      ],
      properties: {
        action: { const: "grant_access" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        auth: {
          type: "integer",
          enum: [1, 2, 7],
          description: "权限位：1-查看，2-编辑，7-管理；协作者默认使用官方示例中的 7",
        },
        viewers: {
          ...docMemberEntryArrayProperty,
          description: "新增查看成员列表",
        },
        collaborators: {
          ...docMemberEntryArrayProperty,
          description: "新增协作者列表；插件通过官方 update_file_member_list 写入，默认 auth=7",
        },
        removeViewers: {
          ...docMemberEntryArrayProperty,
          description: "移除查看成员列表",
        },
        removeCollaborators: {
          ...docMemberEntryArrayProperty,
          description: "移除协作者列表",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "collaborators"],
      properties: {
        action: { const: "add_collaborators" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        auth: {
          type: "integer",
          enum: [1, 2, 7],
          description: "权限位：1-查看，2-编辑，7-管理；默认为 2 (编辑)",
        },
        collaborators: {
          ...docMemberEntryArrayProperty,
          description: "要添加的协作者列表；字符串会自动按 userid 处理",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId"],
      properties: {
        action: { const: "get_content" },
        accountId: accountIdProperty,
        docId: docIdProperty,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "requests"],
      properties: {
        action: { const: "update_content" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        version: {
          type: "integer",
          description: "可选：文档版本号，用于乐观锁",
        },
        requests: {
          type: "array",
          minItems: 1,
          description: "操作列表，必须遵循企业微信 batch_update 格式",
          items: {
            type: "object",
            // additionalProperties: false, // 移除此行，因为 oneOf 验证在空 properties 下会导致验证失败
            oneOf: [
              { required: ["replace_text"], properties: { replace_text: replaceTextRequest } },
              { required: ["insert_text"], properties: { insert_text: insertTextRequest } },
              {
                required: ["delete_content"],
                properties: { delete_content: deleteContentRequest },
              },
              {
                required: ["update_text_property"],
                properties: { update_text_property: updateTextPropertyRequest },
              },
              { required: ["insert_image"], properties: { insert_image: insertImageRequest } },
              {
                required: ["insert_page_break"],
                properties: { insert_page_break: insertPageBreakRequest },
              },
              { required: ["insert_table"], properties: { insert_table: insertTableRequest } },
              {
                required: ["insert_paragraph"],
                properties: { insert_paragraph: insertParagraphRequest },
              },
            ],
          },
        },
      },
    },
    {
      type: "object",
      additionalProperties: true,
      required: ["action", "docId", "request"],
      properties: {
        action: { const: "set_member_auth" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        request: {
          type: "object",
          description: "mod_doc_member 请求体。插件会自动补 docid。",
          additionalProperties: true,
          properties: {
            update_file_member_list: docMemberListProperty,
            del_file_member_list: delDocMemberListProperty,
          },
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "request"],
      properties: {
        action: { const: "set_safety_setting" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        request: {
          type: "object",
          description: "mod_doc_safty_setting 请求体",
          additionalProperties: false,
          properties: {
            enable_readonly_copy: { type: "boolean", description: "是否允许只读成员复制、下载" },
            watermark: watermarkProperty,
          },
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action"],
      anyOf: [{ required: ["formInfo"] }, { required: ["form_info"] }, { required: ["request"] }],
      properties: {
        action: { const: "create_collect" },
        accountId: accountIdProperty,
        formInfo: {
          ...collectFormInfoSchema,
          description: "收集表 form_info 对象；必须包含非空 form_question.items",
        },
        form_info: {
          ...collectFormInfoSchema,
          description: "收集表 form_info 对象；字段名按企业微信接口填写",
        },
        request: {
          ...collectRequestSchema,
          description:
            "create_collect 请求对象；可直接包含 form_info，或用 form_title + items/questions 扁平输入",
        },
        spaceId: {
          type: "string",
          minLength: 1,
          description: "可选：文档空间 ID",
        },
        fatherId: {
          type: "string",
          minLength: 1,
          description: "可选：父目录 fileid",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "oper", "formId", "formInfo"],
      properties: {
        action: { const: "modify_collect" },
        accountId: accountIdProperty,
        oper: {
          type: "string",
          minLength: 1,
          description: "修改操作类型，按企业微信 modify_collect 接口定义填写",
        },
        formId: formIdProperty,
        formInfo: {
          ...nonEmptyObjectProperty,
          description: "收集表 form_info 对象",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "formId"],
      properties: {
        action: { const: "get_form_info" },
        accountId: accountIdProperty,
        formId: formIdProperty,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "repeatedId", "answerIds"],
      properties: {
        action: { const: "get_form_answer" },
        accountId: accountIdProperty,
        formId: {
          ...formIdProperty,
          description:
            "可选上下文；企业微信 get_form_answer 实际使用 repeatedId 和 answerIds，不会提交 formId",
        },
        repeatedId: {
          type: "string",
          minLength: 1,
          description:
            "收集表周期 repeated_id；来自 get_form_info 返回的 form_info.repeated_id，不是 formId",
        },
        answerIds: {
          type: "array",
          minItems: 1,
          description:
            "答案 ID 列表；可从 get_form_statistic(req_type=2) 的 submit_users[].answer_id 获取",
          items: {
            type: "integer",
          },
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "requests"],
      properties: {
        action: { const: "get_form_statistic" },
        accountId: accountIdProperty,
        formId: {
          ...formIdProperty,
          description:
            "可选上下文；用于把误填为 formId 的 repeated_id 解析成 get_form_info 返回的真实 repeated_id",
        },
        requests: {
          type: "array",
          minItems: 1,
          description:
            "统计请求数组；每项必须传 repeated_id 和 req_type。插件会按企业微信当前接口逐项提交单个请求对象。req_type=2 省略时间窗口时默认查询当天。",
          items: collectFormStatisticRequestSchema,
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId"],
      properties: {
        action: { const: "get_sheet_properties" },
        accountId: accountIdProperty,
        docId: {
          ...docIdProperty,
          description: "在线表格 docid",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "sheetId", "gridData"],
      properties: {
        action: { const: "edit_sheet_data" },
        accountId: accountIdProperty,
        docId: {
          ...docIdProperty,
          description: "在线表格 docid",
        },
        sheetId: {
          type: "string",
          minLength: 1,
          description: "工作表 sheet_id",
        },
        startRow: {
          type: "integer",
          minimum: 0,
          description: "起始行号（从 0 开始）",
        },
        startColumn: {
          type: "integer",
          minimum: 0,
          description: "起始列号（从 0 开始）",
        },
        gridData: {
          type: "object",
          description: "表格数据，按企业微信官方 GridData 定义填写",
          additionalProperties: false,
          required: ["rows"],
          properties: {
            startRow: { type: "integer", minimum: 0, description: "起始行号（从 0 开始）" },
            startColumn: { type: "integer", minimum: 0, description: "起始列号（从 0 开始）" },
            rows: {
              type: "array",
              minItems: 1,
              description: "行数据列表",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["values"],
                properties: {
                  values: {
                    type: "array",
                    minItems: 1,
                    description: "单元格数据列表（CellData 格式）",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["cell_value"],
                      properties: {
                        cell_value: {
                          type: "object",
                          description: "单元格值（text 或 link 二选一）",
                          additionalProperties: false,
                          oneOf: [
                            { required: ["text"], not: { required: ["link"] } },
                            { required: ["link"], not: { required: ["text"] } },
                          ],
                          properties: {
                            text: { type: "string", description: "文本内容" },
                            link: {
                              type: "object",
                              description: "超链接内容",
                              additionalProperties: false,
                              required: ["text", "url"],
                              properties: {
                                text: { type: "string", description: "链接显示文本" },
                                url: { type: "string", description: "链接地址" },
                              },
                            },
                          },
                        },
                        cell_format: {
                          type: "object",
                          description: "单元格格式（可选）",
                          additionalProperties: false,
                          properties: {
                            text_format: {
                              type: "object",
                              description: "文本格式",
                              additionalProperties: false,
                              properties: {
                                font: {
                                  type: "string",
                                  description: "字体名称（Microsoft YaHei, SimSun, Arial 等）",
                                },
                                font_size: {
                                  type: "integer",
                                  minimum: 1,
                                  maximum: 72,
                                  description: "字体大小（最大 72）",
                                },
                                bold: {
                                  type: "boolean",
                                  description: "加粗",
                                },
                                italic: {
                                  type: "boolean",
                                  description: "斜体",
                                },
                                strikethrough: {
                                  type: "boolean",
                                  description: "删除线",
                                },
                                underline: {
                                  type: "boolean",
                                  description: "下划线",
                                },
                                color: {
                                  type: "object",
                                  description: "字体颜色（RGBA）",
                                  additionalProperties: false,
                                  properties: {
                                    red: {
                                      type: "integer",
                                      minimum: 0,
                                      maximum: 255,
                                      description: "红色通道",
                                    },
                                    green: {
                                      type: "integer",
                                      minimum: 0,
                                      maximum: 255,
                                      description: "绿色通道",
                                    },
                                    blue: {
                                      type: "integer",
                                      minimum: 0,
                                      maximum: 255,
                                      description: "蓝色通道",
                                    },
                                    alpha: {
                                      type: "integer",
                                      minimum: 0,
                                      maximum: 255,
                                      description: "透明度（255 完全不透明）",
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "sheetId", "range"],
      properties: {
        action: { const: "get_sheet_data" },
        accountId: accountIdProperty,
        docId: {
          ...docIdProperty,
          description: "在线表格 docid",
        },
        sheetId: {
          type: "string",
          minLength: 1,
          description: "工作表 sheet_id",
        },
        range: {
          type: "string",
          minLength: 1,
          description: "读取范围，如 A1:E10",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "sheetId"],
      properties: {
        action: { const: "smartsheet_get_fields" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        sheetId: { type: "string", description: "子表 ID" },
        view_id: { type: "string", description: "可选：视图 ID" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "sheetId"],
      properties: {
        action: { const: "smartsheet_get_views" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        sheetId: { type: "string", description: "子表 ID" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId"],
      properties: {
        action: { const: "smartsheet_get_sheets" },
        accountId: accountIdProperty,
        docId: docIdProperty,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId"],
      properties: {
        action: { const: "smartsheet_add_sheet" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        properties: {
          ...smartsheetSheetPropertiesSchema,
          description:
            "可选：官方 MCP 形状的子表属性对象；创建时通常只需 title，不传则由企业微信使用默认标题",
        },
        title: { type: "string", description: "兼容扁平参数：子表标题；等价于 properties.title" },
        index: { type: "integer", description: "可选：子表位置索引" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "sheetId"],
      properties: {
        action: { const: "smartsheet_del_sheet" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        sheetId: sheetIdProperty,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId"],
      anyOf: [{ required: ["properties"] }, { required: ["sheetId", "title"] }],
      properties: {
        action: { const: "smartsheet_update_sheet" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        properties: {
          ...smartsheetSheetPropertiesSchema,
          required: ["sheet_id", "title"],
          description: "官方 MCP 形状：必须包含 sheet_id 和新 title",
        },
        sheetId: {
          ...sheetIdProperty,
          description: "兼容扁平参数：子表 ID；等价于 properties.sheet_id",
        },
        title: {
          type: "string",
          minLength: 1,
          description: "兼容扁平参数：新标题；等价于 properties.title",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "sheetId", "view_title", "view_type"],
      properties: {
        action: { const: "smartsheet_add_view" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        sheetId: sheetIdProperty,
        view_title: { type: "string", description: "视图标题" },
        view_type: {
          type: "string",
          enum: [
            "VIEW_TYPE_GRID",
            "VIEW_TYPE_KANBAN",
            "VIEW_TYPE_GALLERY",
            "VIEW_TYPE_GANTT",
            "VIEW_TYPE_CALENDAR",
          ],
          description: "视图类型",
        },
        property_gantt: genericObjectProperty,
        property_calendar: genericObjectProperty,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "sheetId", "view_id"],
      properties: {
        action: { const: "smartsheet_update_view" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        sheetId: sheetIdProperty,
        view_id: { type: "string", description: "视图 ID" },
        view_title: { type: "string", description: "视图标题" },
        property: {
          ...genericObjectProperty,
          description: "可选：视图属性对象；更新视图时 view_title/property 至少提供一项",
        },
        property_gantt: genericObjectProperty,
        property_calendar: genericObjectProperty,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "sheetId", "view_ids"],
      properties: {
        action: { const: "smartsheet_del_view" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        sheetId: sheetIdProperty,
        view_ids: { type: "array", items: { type: "string" }, description: "视图 ID 列表" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "sheetId", "fields"],
      properties: {
        action: { const: "smartsheet_add_fields" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        sheetId: sheetIdProperty,
        fields: {
          type: "array",
          items: nonEmptyObjectProperty,
          description:
            "要添加的字段列表，每项包含 field_title, field_type 等；数字/日期/选择等字段可传 property_*，未传时插件会按企业微信 API 补默认属性",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "sheetId", "field_ids"],
      properties: {
        action: { const: "smartsheet_del_fields" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        sheetId: sheetIdProperty,
        field_ids: { type: "array", items: { type: "string" }, description: "字段 ID 列表" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "sheetId", "fields"],
      properties: {
        action: { const: "smartsheet_update_fields" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        sheetId: sheetIdProperty,
        fields: {
          type: "array",
          items: nonEmptyObjectProperty,
          description:
            "要更新的字段列表，每项需包含 field_id；field_type 必须保持原类型，未传时插件会先查询字段并补回原类型",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "sheetId", "name", "children"],
      properties: {
        action: { const: "smartsheet_add_group" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        sheetId: sheetIdProperty,
        name: { type: "string", description: "编组名称" },
        children: {
          type: "array",
          minItems: 1,
          items: fieldGroupChildProperty,
          description:
            "字段 ID 列表；可传字符串数组，插件会按企业微信 API 转成 {field_id} 对象数组",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "sheetId", "field_group_id"],
      properties: {
        action: { const: "smartsheet_del_group" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        sheetId: sheetIdProperty,
        field_group_id: { type: "string", description: "编组 ID" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "sheetId", "field_group_id"],
      properties: {
        action: { const: "smartsheet_update_group" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        sheetId: sheetIdProperty,
        field_group_id: { type: "string", description: "编组 ID" },
        name: { type: "string" },
        children: {
          type: "array",
          items: fieldGroupChildProperty,
          description: "字段 ID 列表；插件会按企业微信 API 转成 {field_id} 对象数组",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "sheetId"],
      properties: {
        action: { const: "smartsheet_get_groups" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        sheetId: sheetIdProperty,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "sheetId", "records"],
      properties: {
        action: { const: "smartsheet_add_records" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        sheetId: { type: "string", description: "子表 ID" },
        key_type: cellValueKeyTypeProperty,
        records: {
          type: "array",
          items: nonEmptyObjectProperty,
          description:
            "记录列表；每条记录需包含 values 对象，values 的 key 按 key_type 使用字段标题或字段 ID",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "sheetId", "records"],
      properties: {
        action: { const: "smartsheet_update_records" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        sheetId: { type: "string", description: "子表 ID" },
        key_type: cellValueKeyTypeProperty,
        records: {
          type: "array",
          items: nonEmptyObjectProperty,
          description:
            "更新记录列表，每条需包含 record_id 和 values 对象；values 的 key 按 key_type 使用字段标题或字段 ID",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "sheetId", "record_ids"],
      properties: {
        action: { const: "smartsheet_del_records" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        sheetId: { type: "string", description: "子表 ID" },
        record_ids: { type: "array", items: { type: "string" }, description: "记录 ID 列表" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "sheetId"],
      properties: {
        action: { const: "smartsheet_get_records" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        sheetId: { type: "string", description: "子表 ID" },
        view_id: { type: "string", description: "可选：按视图上下文查询记录" },
        key_type: cellValueKeyTypeProperty,
        record_ids: {
          type: "array",
          items: { type: "string" },
          description: "可选：指定记录 ID 列表",
        },
        field_titles: {
          type: "array",
          items: { type: "string" },
          description: "可选：按字段标题筛选返回字段；不筛选时不要传空数组",
        },
        field_ids: {
          type: "array",
          items: { type: "string" },
          description: "可选：按字段 ID 筛选返回字段；不筛选时不要传空数组",
        },
        sort: {
          type: "array",
          items: genericObjectProperty,
          description: "可选：排序条件；不排序时不要传空数组",
        },
        offset: { type: "integer" },
        limit: { type: "integer" },
        ver: { type: "integer", description: "可选：数据版本号" },
        filter_spec: {
          ...genericObjectProperty,
          description: "可选：筛选条件；企业微信要求 filter_spec 与 sort 不同时使用",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId"],
      properties: {
        action: { const: "smartsheet_get_sheet_priv" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        sheetId: {
          type: "string",
          description:
            "可选：用于提示调用者关注的子表；企业微信 get_sheet_priv API 本身不按 sheet_id 查询",
        },
        type: {
          type: "integer",
          enum: [1, 2],
          default: 1,
          description: "规则类型：1-全员权限（默认），2-额外权限；type=2 需要 rule_id_list",
        },
        rule_id_list: {
          type: "array",
          items: { type: "integer" },
          description: "额外权限规则 ID 列表；type=2 时必填且非空",
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "priv_list"],
      anyOf: [{ required: ["rule_id"] }, { required: ["name"] }],
      properties: {
        action: { const: "smartsheet_update_sheet_priv" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        type: {
          type: "integer",
          enum: [1, 2],
          description:
            "规则类型：1-全员权限，2-额外权限；type=2 通常需要 rule_id，按企业微信 content_priv/update_sheet_priv 协议填写",
        },
        rule_id: { type: "integer" },
        name: { type: "string" },
        priv_list: privListSchema,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId"],
      anyOf: [{ required: ["name"] }, { required: ["rule_name"] }, { required: ["ruleName"] }],
      properties: {
        action: { const: "smartsheet_create_rule" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        name: {
          type: "string",
          minLength: 1,
          maxLength: 4,
          description: "权限规则名称；使用 4 个字符以内的短名称",
        },
        rule_name: {
          type: "string",
          minLength: 1,
          maxLength: 4,
          description: "权限规则名称；兼容常见别名，建议 4 个字符以内",
        },
        ruleName: {
          type: "string",
          minLength: 1,
          maxLength: 4,
          description: "权限规则名称；兼容常见别名，建议 4 个字符以内",
        },
        type: {
          type: "integer",
          enum: [2],
          default: 2,
          description: "可选：携带 priv_list 时用于初始化额外权限规则，固定为2",
        },
        priv_list: {
          ...privListSchema,
          description:
            "可选：创建规则后立即调用 update_sheet_priv 初始化子表权限；create_rule 本身只创建规则名",
        },
        member_range: {
          ...memberRangeSchema,
          description: "可选：创建规则后立即添加成员范围；等价于 add_member_range",
        },
        add_member_range: memberRangeSchema,
        del_member_range: memberRangeSchema,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "rule_id"],
      properties: {
        action: { const: "smartsheet_mod_rule_member" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        rule_id: { type: "integer" },
        add_member_range: memberRangeSchema,
        del_member_range: memberRangeSchema,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "docId", "rule_id_list"],
      properties: {
        action: { const: "smartsheet_delete_rule" },
        accountId: accountIdProperty,
        docId: docIdProperty,
        rule_id_list: { type: "array", items: { type: "integer" }, description: "规则 ID 列表" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "userid_list"],
      properties: {
        action: { const: "doc_assign_advanced_account" },
        accountId: accountIdProperty,
        userid_list: { type: "array", items: { type: "string" }, description: "成员 ID 列表" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "userid_list"],
      properties: {
        action: { const: "doc_cancel_advanced_account" },
        accountId: accountIdProperty,
        userid_list: { type: "array", items: { type: "string" }, description: "成员 ID 列表" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action"],
      properties: {
        action: { const: "doc_get_advanced_account_list" },
        accountId: accountIdProperty,
        offset: { type: "integer" },
        limit: { type: "integer" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "file_path", "docId"],
      properties: {
        action: { const: "upload_doc_image" },
        accountId: accountIdProperty,
        docId: {
          ...docIdProperty,
          description: "文档 docid，上传图片需要关联文档",
        },
        file_path: { type: "string", description: "本地图片路径" },
      },
    },
  ],
} as const;
