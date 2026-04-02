export interface WecomWorkRecord {
  sp_no?: string;
  title: string;
  creator: string;
  url?: string;
  appname?: string;
  create_time?: number;
  status?: number; // 0=not_started, 1=completed
  detail?: Array<{
    userid: string;
    title?: string;
    status?: number;
  }>;
}
