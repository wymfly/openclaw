export interface WecomMeeting {
  meetingid: string;
  title: string;
  meeting_code?: string;
  password?: string;
  status?: number; // 1=not_started, 2=in_progress, 3=ended, 4=cancelled
  start_time: string;
  end_time: string;
  hosts?: string[];
  invitees?: string[];
  settings?: WecomMeetingSettings;
}

export interface WecomMeetingSettings {
  mute_enable_join?: boolean;
  allow_unmute_self?: boolean;
  play_ivr_on_join?: boolean;
  play_ivr_on_leave?: boolean;
  allow_in_before_host?: boolean;
}

export interface WecomMeetingListItem {
  meetingid: string;
  title: string;
  meeting_code?: string;
  start_time: string;
  end_time: string;
  status?: number;
}
