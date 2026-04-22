import { NextRequest, NextResponse } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

const DEFAULT_RUNTIME_ID = "rt_local";

type Stage2RunRecord = {
  runId: string;
  sessionKey?: string | null;
  status?: string | null;
  lastEventAt?: string | null;
};

function selectActiveRunID(runs: Stage2RunRecord[], sessionKey: string): string | null {
  const activeRuns = runs
    .filter((run) => run.sessionKey === sessionKey && run.status === "running" && run.runId)
    .toSorted(
      (left, right) =>
        new Date(right.lastEventAt ?? 0).getTime() - new Date(left.lastEventAt ?? 0).getTime(),
    );
  return activeRuns[0]?.runId ?? null;
}

export async function POST(request: NextRequest) {
  const cloned = request.clone();
  const body = (await cloned.json()) as {
    sessionKey?: string;
    runId?: string;
  };
  const sessionKey = body.sessionKey?.trim() ?? "";

  if (!sessionKey) {
    return Response.json({ error: "sessionKey is required" }, { status: 400 });
  }

  let runId = body.runId?.trim() || "";
  if (!runId) {
    const runsResponse = await fetchDeckGo(
      new NextRequest(request.url, {
        method: "GET",
        headers: request.headers,
      }),
      `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/runs`,
    );
    if (runsResponse) {
      if (!runsResponse.ok) {
        return runsResponse;
      }
      const payload = (await runsResponse.json()) as { runs?: Stage2RunRecord[] };
      runId = selectActiveRunID(payload.runs ?? [], sessionKey) ?? "";
      if (!runId) {
        return NextResponse.json({
          ok: true,
          abortedRunId: null,
          status: "no-active-run",
        });
      }
    }
  }

  const proxied = await fetchDeckGo(
    new NextRequest(request.url, {
      method: request.method,
      headers: request.headers,
    }),
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/runs/${encodeURIComponent(
      runId,
    )}:abort`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    return NextResponse.json({
      ok: true,
      abortedRunId: runId,
      status: "aborted",
    });
  }
  return deckGoUnavailableResponse();
}
