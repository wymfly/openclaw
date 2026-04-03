// extensions/wecom/src/capability/external-contact/types.ts

export interface WecomExternalContact {
  external_userid: string;
  name?: string;
  position?: string;
  avatar?: string;
  corp_name?: string;
  corp_full_name?: string;
  type?: number; // 1=微信用户, 2=企业微信用户
  gender?: number;
  unionid?: string;
}

export interface WecomExternalContactFollowUser {
  userid: string;
  remark?: string;
  description?: string;
  createtime?: number;
  tags?: Array<{
    group_name?: string;
    tag_name?: string;
    type?: number;
  }>;
  state?: string;
}

export interface WecomExternalContactDetail {
  external_contact: WecomExternalContact;
  follow_user: WecomExternalContactFollowUser[];
}

export interface WecomGroupChat {
  chat_id: string;
  name?: string;
  owner?: string;
  create_time?: number;
  notice?: string;
  member_count?: number;
  status: number; // 0=正常, 1=跟进人离职, 2=离职继承中, 3=离职继承完成
}

export interface WecomGroupChatListResult {
  group_chat_list: Array<{
    chat_id: string;
    status: number;
  }>;
  next_cursor?: string;
}
