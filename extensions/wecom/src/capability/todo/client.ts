import { resolveWecomEgressProxyUrlFromNetwork } from "../../config/index.js";
import { wecomFetch } from "../../http.js";
import { getAccessToken } from "../../transport/agent-api/core.js";
import { LIMITS } from "../../types/constants.js";
import type { ResolvedAgentAccount } from "../../types/index.js";
import type { WecomWorkRecord } from "./types.js";

function readString(value: unknown): string {
  const trimmed = String(value ?? "").trim();
  return trimmed || "";
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => readString(item)).filter(Boolean) : [];
}

function withoutErrFields<T extends Record<string, unknown>>(
  value: T,
): Omit<T, "errcode" | "errmsg"> {
  const cloned = { ...value };
  delete (cloned as { errcode?: unknown }).errcode;
  delete (cloned as { errmsg?: unknown }).errmsg;
  return cloned;
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

export class WecomTodoClient {
  private async postWecomTodoApi(params: {
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

  async create(
    agent: ResolvedAgentAccount,
    params: {
      title: string;
      creator: string;
      url?: string;
      appname?: string;
      userids?: string[];
    },
  ): Promise<string> {
    const title = readString(params.title);
    const creator = readString(params.creator);
    if (!title) throw new Error("title required");
    if (!creator) throw new Error("creator required");

    const payload: Record<string, unknown> = {
      title,
      creator,
    };

    const url = readString(params.url);
    const appname = readString(params.appname);
    const userids = readStringArray(params.userids);
    if (url) payload.url = url;
    if (appname) payload.appname = appname;
    if (userids.length > 0) payload.userids = userids;

    const json = await this.postWecomTodoApi({
      path: "/cgi-bin/oa/addworkrecord",
      actionLabel: "create",
      agent,
      body: payload,
    });

    return readString(json.sp_no);
  }

  async updateStatus(agent: ResolvedAgentAccount, spNo: string, status: number): Promise<void> {
    const normalizedSpNo = readString(spNo);
    if (!normalizedSpNo) throw new Error("spNo required");
    if (status !== 0 && status !== 1) {
      throw new Error("status must be 0 or 1");
    }

    await this.postWecomTodoApi({
      path: "/cgi-bin/oa/updateworkrecord",
      actionLabel: "update_status",
      agent,
      body: {
        sp_no: normalizedSpNo,
        status,
      },
    });
  }

  async get(agent: ResolvedAgentAccount, spNo: string): Promise<WecomWorkRecord> {
    const normalizedSpNo = readString(spNo);
    if (!normalizedSpNo) throw new Error("spNo required");

    const json = await this.postWecomTodoApi({
      path: "/cgi-bin/oa/getworkrecord",
      actionLabel: "get",
      agent,
      body: {
        sp_no: normalizedSpNo,
      },
    });

    const result = (json.work_record ?? withoutErrFields(json)) as WecomWorkRecord;
    return result;
  }
}
