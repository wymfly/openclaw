// extensions/wecom/src/capability/approval/types.ts

export interface WecomApprovalRecord {
  sp_no: string;
  sp_name?: string;
  sp_status?: number; // 1=审批中, 2=已通过, 3=已驳回, 4=已撤销, 6=通过后撤销, 7=已删除, 10=已支付
  template_id?: string;
  apply_time?: number;
  apply_user_party?: string;
  apply_userid?: string;
  apply_username?: string;
  apply_userimage?: string;
  approval_nodes?: WecomApprovalNode[];
  notifier_nodes?: Array<{ attrs: { userid: string } }>;
  apply_data?: WecomApplyData;
  comments?: WecomApprovalComment[];
}

export interface WecomApprovalNode {
  node_status: number; // 1=审批中, 2=已同意, 3=已驳回, 4=已转审
  node_attr: number; // 1=或签, 2=会签, 3=依次审批
  node_type: number; // 1=审批人, 2=抄送人, 3=自选
  items: Array<{
    item_status: number;
    item_userid: string;
    item_speech?: string;
    item_optime?: number;
  }>;
}

export interface WecomApplyData {
  contents: Array<{
    control: string; // Text, Textarea, Number, Money, Date, Selector, Contact, etc.
    id: string;
    title: Array<{ text: string; lang: string }>;
    value: Record<string, unknown>;
  }>;
}

export interface WecomApprovalComment {
  commentUserInfo: { userid: string };
  commenttime?: number;
  commentcontent?: string;
  commentid?: string;
}

export interface WecomApprovalTemplate {
  template_names: Array<{ text: string; lang: string }>;
  template_content: {
    controls: Array<{
      property: {
        control: string;
        id: string;
        title: Array<{ text: string; lang: string }>;
        placeholder?: Array<{ text: string; lang: string }>;
        require?: number;
      };
      config?: Record<string, unknown>;
    }>;
  };
}
