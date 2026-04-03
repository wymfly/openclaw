// extensions/wecom/src/capability/approval/client.ts

import { resolveWecomEgressProxyUrlFromNetwork } from "../../config/index.js";
import { wecomFetch } from "../../http.js";
import { getAccessToken } from "../../transport/agent-api/core.js";
import { LIMITS } from "../../types/constants.js";
import type { ResolvedAgentAccount } from "../../types/index.js";
import type { WecomApprovalRecord, WecomApprovalTemplate } from "./types.js";

function readString(value: unknown): string {
  const trimmed = String(value ?? "").trim();
  return trimmed || "";
}

async function parseJsonResponse(res: Response, actionLabel: string): Promise<any> {
  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    if (!res.ok) {
      throw new Error(`WeCom ${actionLabel} failed: HTTP ${res.status}`);
    }
    throw new Error(`WeCom ${actionLabel} failed: invalid JSON response`);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`WeCom ${actionLabel} failed: empty response`);
  }

  if (!res.ok) {
    throw new Error(`WeCom ${actionLabel} failed: HTTP ${res.status} ${JSON.stringify(payload)}`);
  }

  if (Number(payload.errcode ?? 0) !== 0) {
    throw new Error(
      `WeCom ${actionLabel} failed: ${String(payload.errmsg || "unknown error")} (errcode ${String(payload.errcode)})`,
    );
  }

  return payload;
}

export class WecomApprovalClient {
  private async postWecomApprovalApi(params: {
    path: string;
    actionLabel: string;
    agent: ResolvedAgentAccount;
    body: Record<string, unknown>;
  }): Promise<any> {
    const { path, actionLabel, agent, body } = params;

    const token = await getAccessToken(agent);
    const url = `https://qyapi.weixin.qq.com${path}?access_token=${encodeURIComponent(token)}`;
    const proxyUrl = resolveWecomEgressProxyUrlFromNetwork(agent.network);

    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await wecomFetch(
          url,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify(body ?? {}),
          },
          { proxyUrl, timeoutMs: LIMITS.REQUEST_TIMEOUT_MS },
        );

        return await parseJsonResponse(res, actionLabel);
      } catch (err) {
        lastErr = err;
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    throw lastErr;
  }

  async submit(
    agent: ResolvedAgentAccount,
    params: {
      creator_userid: string;
      template_id: string;
      use_template_approver?: number;
      approver?: Array<{ attr: number; userid: string[] }>;
      apply_data?: { contents: Array<Record<string, unknown>> };
      summary_list?: Array<{ summary_info: Array<{ text: string; lang: string }> }>;
    },
  ): Promise<{ raw: any; sp_no: string }> {
    const creatorUserid = readString(params.creator_userid);
    const templateId = readString(params.template_id);
    if (!creatorUserid) throw new Error("creator_userid required");
    if (!templateId) throw new Error("template_id required");

    const payload: Record<string, unknown> = {
      creator_userid: creatorUserid,
      template_id: templateId,
    };
    if (params.use_template_approver !== undefined) {
      payload.use_template_approver = params.use_template_approver;
    }
    if (params.approver) payload.approver = params.approver;
    if (params.apply_data) payload.apply_data = params.apply_data;
    if (params.summary_list) payload.summary_list = params.summary_list;

    const json = await this.postWecomApprovalApi({
      path: "/cgi-bin/oa/applyevent",
      actionLabel: "submit",
      agent,
      body: payload,
    });

    return { raw: json, sp_no: readString(json.sp_no) };
  }

  async list(
    agent: ResolvedAgentAccount,
    params: {
      start_time: string;
      end_time: string;
      template_id?: string;
      cursor?: number;
      size?: number;
    },
  ): Promise<{ raw: any; sp_no_list: string[]; next_cursor?: number }> {
    const startTime = readString(params.start_time);
    const endTime = readString(params.end_time);
    if (!startTime) throw new Error("start_time required");
    if (!endTime) throw new Error("end_time required");

    // Map user-facing start_time/end_time to WeCom API's starttime/endtime
    const payload: Record<string, unknown> = {
      starttime: startTime,
      endtime: endTime,
    };
    const templateId = readString(params.template_id);
    if (templateId) payload.template_id = templateId;
    if (params.cursor !== undefined) payload.cursor = params.cursor;
    if (params.size !== undefined) payload.size = params.size;

    const json = await this.postWecomApprovalApi({
      path: "/cgi-bin/oa/getapprovalinfo",
      actionLabel: "list",
      agent,
      body: payload,
    });

    const spNoList = Array.isArray(json.sp_no_list) ? (json.sp_no_list as string[]) : [];
    return {
      raw: json,
      sp_no_list: spNoList,
      next_cursor: typeof json.new_next_cursor === "number" ? json.new_next_cursor : undefined,
    };
  }

  async getDetail(
    agent: ResolvedAgentAccount,
    spNo: string,
  ): Promise<WecomApprovalRecord> {
    const normalizedSpNo = readString(spNo);
    if (!normalizedSpNo) throw new Error("sp_no required");

    const json = await this.postWecomApprovalApi({
      path: "/cgi-bin/oa/getapprovaldetail",
      actionLabel: "get_detail",
      agent,
      body: { sp_no: normalizedSpNo },
    });

    return (json.info ?? json) as WecomApprovalRecord;
  }

  async getTemplate(
    agent: ResolvedAgentAccount,
    templateId: string,
  ): Promise<WecomApprovalTemplate> {
    const normalizedTemplateId = readString(templateId);
    if (!normalizedTemplateId) throw new Error("template_id required");

    const json = await this.postWecomApprovalApi({
      path: "/cgi-bin/oa/gettemplatedetail",
      actionLabel: "get_template",
      agent,
      body: { template_id: normalizedTemplateId },
    });

    return (json.template_names ? json : json.template) as WecomApprovalTemplate;
  }
}
