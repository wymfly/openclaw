/**
 * /api/agents — Manage agents.
 *
 * GET    — List all agents
 * POST   — Create a new agent
 * DELETE — Delete an agent by ID
 *
 * Gateway contracts:
 *   agents.list:   {} (no params)
 *   agents.create: { name, workspace, emoji?, avatar? }
 *   agents.delete: { agentId, deleteFiles? }
 */
import os from "node:os";
import path from "node:path";
import { getRuntime } from "@server/runtime";
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localAgentsGetHandler(_request: NextRequest) {
  return gwRequest("agents.list", {});
}

async function localAgentsPostHandler(request: NextRequest) {
  const body = (await request.json()) as {
    name?: string;
    workspace?: string;
    emoji?: string;
    avatar?: string;
  };

  const name = body.name?.trim();
  if (!name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  // Gateway schema requires `workspace`. When the caller omits it,
  // resolve the default from config, falling back to the same pattern
  // as resolveAgentWorkspaceDir: `${stateDir}/workspace-${agentId}`.
  let workspace = body.workspace?.trim() || undefined;
  if (!workspace) {
    try {
      const runtime = getRuntime();
      if (runtime) {
        const cfg = (await runtime.adapter.request("config.get", {
          path: "agents.defaults.workspace",
        })) as { exists?: boolean; raw?: string };
        if (cfg.exists && cfg.raw) {
          workspace = cfg.raw;
        }
      }
    } catch {
      // Ignore — use computed fallback below.
    }
  }
  if (!workspace) {
    const stateDir = process.env.OPENCLAW_STATE_DIR || path.join(os.homedir(), ".openclaw");
    const agentId = name.toLowerCase().replace(/\s+/g, "-");
    workspace = path.join(stateDir, `workspace-${agentId}`);
  }

  return gwRequest("agents.create", {
    name,
    workspace,
    ...(body.emoji ? { emoji: body.emoji } : {}),
    ...(body.avatar ? { avatar: body.avatar } : {}),
  });
}

async function localAgentsDeleteHandler(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const agentId = searchParams.get("agentId");

  if (!agentId) {
    return Response.json({ error: "agentId is required" }, { status: 400 });
  }

  return gwRequest("agents.delete", {
    agentId,
  });
}

const guardedLocalAgentsGetHandler = withAuth(localAgentsGetHandler);
const guardedLocalAgentsPostHandler = withAuth(localAgentsPostHandler);
const guardedLocalAgentsDeleteHandler = withAuth(localAgentsDeleteHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/agents`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return guardedLocalAgentsGetHandler(request);
}

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/agents`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalAgentsPostHandler(request);
}

export async function DELETE(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get("agentId");
  const proxied =
    agentId == null
      ? null
      : await fetchDeckGo(
          request,
          `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/agents/${encodeURIComponent(agentId)}`,
        );
  if (proxied) {
    return proxied;
  }
  return guardedLocalAgentsDeleteHandler(request);
}
