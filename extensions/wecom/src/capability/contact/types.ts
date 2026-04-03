export interface WecomMember {
  userid: string;
  name: string;
  department: number[];
  position?: string;
  status?: number; // 1=activated, 2=disabled, 4=not-activated, 5=exit
  isleader?: number;
  english_name?: string;
  telephone?: string;
  order?: number[];
  main_department?: number;
  // Privacy-limited fields (empty for non-address-book-sync apps since 2022-06-20)
  avatar?: string;
  mobile?: string;
  email?: string;
  biz_mail?: string;
  gender?: string;
  thumb_avatar?: string;
}

export interface WecomMemberSimple {
  userid: string;
  name: string;
  department: number[];
}

export interface WecomDepartment {
  id: number;
  name: string;
  name_en?: string;
  parentid: number;
  order?: number;
  department_leader?: string[];
}

export interface WecomTagMemberResult {
  tagname: string;
  userlist: Array<{ userid: string; name: string }>;
  partylist: number[];
}
