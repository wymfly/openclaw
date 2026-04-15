import { resolveWecomEgressProxyUrlFromNetwork } from "../../config/index.js";
import { wecomFetch } from "../../http.js";
import { getAccessToken } from "../../transport/agent-api/core.js";
import { LIMITS } from "../../types/constants.js";
import type { ResolvedAgentAccount } from "../../types/index.js";
import {
  isRetryableError,
  parseJsonResponse,
  readString,
  withoutErrFields,
} from "../shared-client-utils.js";
import type {
  WecomDepartment,
  WecomMember,
  WecomMemberSimple,
  WecomTagMemberResult,
} from "./types.js";

function readRequiredInteger(value: unknown, fieldName: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`${fieldName} must be an integer`);
  }
  return n;
}

function readOptionalInteger(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return readRequiredInteger(value, fieldName);
}

export class WecomContactClient {
  private async getWecomContactApi(params: {
    path: string;
    actionLabel: string;
    agent: ResolvedAgentAccount;
    query?: Record<string, string | number | undefined>;
  }): Promise<Record<string, unknown>> {
    const { path, actionLabel, agent, query } = params;

    const token = await getAccessToken(agent);
    const qs = new URLSearchParams();
    qs.set("access_token", token);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null) continue;
      if (typeof value === "string" && !value.trim()) continue;
      qs.set(key, String(value));
    }

    const url = `https://qyapi.weixin.qq.com${path}?${qs.toString()}`;
    const proxyUrl = resolveWecomEgressProxyUrlFromNetwork(agent.network);

    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await wecomFetch(
          url,
          { method: "GET" },
          { proxyUrl, timeoutMs: LIMITS.REQUEST_TIMEOUT_MS },
        );
        return await parseJsonResponse(res, actionLabel);
      } catch (err) {
        if (!isRetryableError(err)) throw err;
        lastErr = err;
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    throw lastErr;
  }

  async getMember(
    agent: ResolvedAgentAccount,
    userid: string,
  ): Promise<{ raw: Record<string, unknown>; member: WecomMember }> {
    const normalizedUserId = readString(userid);
    if (!normalizedUserId) throw new Error("userid required");

    const json = await this.getWecomContactApi({
      path: "/cgi-bin/user/get",
      actionLabel: "get_member",
      agent,
      query: { userid: normalizedUserId },
    });

    return {
      raw: json,
      member: withoutErrFields(json) as unknown as WecomMember,
    };
  }

  async listMembers(
    agent: ResolvedAgentAccount,
    departmentId: number,
    simple = false,
  ): Promise<{
    raw: Record<string, unknown>;
    departmentId: number;
    simple: boolean;
    members: Array<WecomMember | WecomMemberSimple>;
  }> {
    const normalizedDepartmentId = readRequiredInteger(departmentId, "departmentId");
    const path = simple ? "/cgi-bin/user/simplelist" : "/cgi-bin/user/list";
    const json = await this.getWecomContactApi({
      path,
      actionLabel: "list_members",
      agent,
      query: {
        department_id: normalizedDepartmentId,
        fetch_child: 1,
      },
    });

    return {
      raw: json,
      departmentId: normalizedDepartmentId,
      simple,
      members: Array.isArray(json.userlist)
        ? (json.userlist as Array<WecomMember | WecomMemberSimple>)
        : [],
    };
  }

  async listDepartments(
    agent: ResolvedAgentAccount,
    parentId?: number,
  ): Promise<{ raw: Record<string, unknown>; parentId?: number; departments: WecomDepartment[] }> {
    const normalizedParentId = readOptionalInteger(parentId, "parentId");
    const json = await this.getWecomContactApi({
      path: "/cgi-bin/department/list",
      actionLabel: "list_departments",
      agent,
      query: {
        id: normalizedParentId,
      },
    });

    return {
      raw: json,
      parentId: normalizedParentId,
      departments: Array.isArray(json.department) ? (json.department as WecomDepartment[]) : [],
    };
  }

  async getDepartment(
    agent: ResolvedAgentAccount,
    departmentId: number,
  ): Promise<{ raw: Record<string, unknown>; department: WecomDepartment }> {
    const normalizedDepartmentId = readRequiredInteger(departmentId, "departmentId");
    const json = await this.getWecomContactApi({
      path: "/cgi-bin/department/get",
      actionLabel: "get_department",
      agent,
      query: {
        id: normalizedDepartmentId,
      },
    });

    return {
      raw: json,
      department: withoutErrFields(json) as unknown as WecomDepartment,
    };
  }

  async listTagMembers(
    agent: ResolvedAgentAccount,
    tagId: number,
  ): Promise<{ raw: Record<string, unknown>; tag: WecomTagMemberResult }> {
    const normalizedTagId = readRequiredInteger(tagId, "tagId");
    const json = await this.getWecomContactApi({
      path: "/cgi-bin/tag/get",
      actionLabel: "list_tag_members",
      agent,
      query: {
        tagid: normalizedTagId,
      },
    });

    const userlist = Array.isArray(json.userlist)
      ? json.userlist.map((item: Record<string, unknown>) => ({
          userid: readString(item?.userid),
          name: readString(item?.name),
        }))
      : [];
    const partylist = Array.isArray(json.partylist)
      ? json.partylist
          .map((item: unknown) => Number(item))
          .filter((n: number) => Number.isFinite(n))
      : [];

    return {
      raw: json,
      tag: {
        tagname: readString(json.tagname),
        userlist,
        partylist,
      },
    };
  }

  async search(
    agent: ResolvedAgentAccount,
    departmentId: number,
    query: string,
  ): Promise<{
    raw: Record<string, unknown>;
    departmentId: number;
    query: string;
    total: number;
    members: WecomMember[];
  }> {
    const normalizedQuery = readString(query);
    if (!normalizedQuery) throw new Error("query required");

    const listed = await this.listMembers(agent, departmentId, false);
    const lowerQuery = normalizedQuery.toLowerCase();
    const members = listed.members as WecomMember[];

    const matched = members.filter((member) => {
      const fields = [
        readString(member.userid),
        readString(member.name),
        readString(member.english_name),
        readString(member.position),
        readString(member.email),
      ].map((value) => value.toLowerCase());
      return fields.some((field) => field.includes(lowerQuery));
    });

    return {
      raw: listed.raw,
      departmentId: listed.departmentId,
      query: normalizedQuery,
      total: listed.members.length,
      members: matched,
    };
  }
}
