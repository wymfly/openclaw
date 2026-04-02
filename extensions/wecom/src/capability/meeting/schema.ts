const accountIdProperty = {
  type: "string",
  minLength: 1,
  description: "可选：指定企业微信账号 ID；不填时按 agent 账号/默认账号自动选择",
};

const meetingIdProperty = {
  type: "string",
  minLength: 1,
  description: "会议 ID (meetingid)",
};

const titleProperty = {
  type: "string",
  minLength: 1,
  description: "会议标题",
};

const timeProperty = {
  type: "string",
  minLength: 1,
  description: "会议时间字符串",
};

const settingsProperty = {
  type: "object",
  additionalProperties: false,
  properties: {
    mute_enable_join: { type: "boolean", description: "入会时自动静音" },
    allow_unmute_self: { type: "boolean", description: "允许成员自行解除静音" },
    play_ivr_on_join: { type: "boolean", description: "成员入会播放提示音" },
    play_ivr_on_leave: { type: "boolean", description: "成员离会播放提示音" },
    allow_in_before_host: { type: "boolean", description: "允许主持人入会前进入" },
  },
};

export const wecomMeetingToolSchema = {
  type: "object",
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "title", "start_time", "end_time"],
      properties: {
        action: { const: "create" },
        accountId: accountIdProperty,
        title: titleProperty,
        start_time: timeProperty,
        end_time: timeProperty,
        invitees: {
          type: "array",
          items: { type: "string", minLength: 1 },
          description: "邀请成员 userid 列表",
        },
        password: {
          type: "string",
          minLength: 1,
          description: "会议密码",
        },
        settings: settingsProperty,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "meetingid"],
      properties: {
        action: { const: "update" },
        accountId: accountIdProperty,
        meetingid: meetingIdProperty,
        title: titleProperty,
        start_time: timeProperty,
        end_time: timeProperty,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "meetingid"],
      properties: {
        action: { const: "cancel" },
        accountId: accountIdProperty,
        meetingid: meetingIdProperty,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "meetingid"],
      properties: {
        action: { const: "get_info" },
        accountId: accountIdProperty,
        meetingid: meetingIdProperty,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "userid"],
      properties: {
        action: { const: "list_user_meetings" },
        accountId: accountIdProperty,
        userid: {
          type: "string",
          minLength: 1,
          description: "成员 userid",
        },
      },
    },
  ],
} as const;
