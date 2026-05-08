// @vitest-environment jsdom
import { QueryClient } from "@tanstack/react-query";
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataFabricProvider } from "../../client/scoped-query-provider";
import { DataFabricBaseHashRequiredError } from "../shared";
import { agentsKeys } from "./keys";
import {
  AgentProtectedDeleteError,
  useDeleteAgentMutation,
  useSaveAgentFileMutation,
  useSaveAgentSkillsMutation,
} from "./mutations";

const apiMocks = vi.hoisted(() => ({
  deleteAgent: vi.fn(),
  saveAgentFile: vi.fn(),
  updateAgentSkills: vi.fn(),
}));

vi.mock("@/api", () => apiMocks);

type MutationHandles = {
  deleteAgent: ReturnType<typeof useDeleteAgentMutation>;
  saveFile: ReturnType<typeof useSaveAgentFileMutation>;
  saveSkills: ReturnType<typeof useSaveAgentSkillsMutation>;
};

let container: HTMLDivElement;
let root: Root | null = null;
let queryClient: QueryClient;
let handles: MutationHandles | null = null;

function MutationProbe({ onReady }: { onReady: (handles: MutationHandles) => void }) {
  const deleteAgentMutation = useDeleteAgentMutation();
  const saveFile = useSaveAgentFileMutation();
  const saveSkills = useSaveAgentSkillsMutation();

  useEffect(() => {
    onReady({ deleteAgent: deleteAgentMutation, saveFile, saveSkills });
  }, [deleteAgentMutation, onReady, saveFile, saveSkills]);

  return null;
}

async function renderProbe() {
  await act(async () => {
    root = createRoot(container);
    root.render(
      createElement(
        DataFabricProvider,
        { queryClient },
        createElement(MutationProbe, {
          onReady(next) {
            handles = next;
          },
        }),
      ),
    );
  });
  if (!handles) {
    throw new Error("mutation handles did not initialize");
  }
  return handles;
}

describe("Agents Data Fabric mutations", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    handles = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    container.remove();
  });

  it("blocks base-hash writes before calling the backend", async () => {
    const mutations = await renderProbe();

    await expect(
      mutations.saveSkills.mutateAsync({
        agentId: "main",
        baseHash: "",
        mode: "whitelist",
        skills: ["read"],
      }),
    ).rejects.toBeInstanceOf(DataFabricBaseHashRequiredError);
    expect(apiMocks.updateAgentSkills).not.toHaveBeenCalled();
  });

  it("blocks protected delete before calling the backend", async () => {
    const mutations = await renderProbe();

    await expect(
      mutations.deleteAgent.mutateAsync({
        agent: { id: "main", isMainProtected: true },
      }),
    ).rejects.toBeInstanceOf(AgentProtectedDeleteError);
    expect(apiMocks.deleteAgent).not.toHaveBeenCalled();
  });

  it("invalidates file read models after file save", async () => {
    const mutations = await renderProbe();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    apiMocks.saveAgentFile.mockResolvedValue({
      file: { name: "AGENTS.md" },
      ok: true,
    });

    await mutations.saveFile.mutateAsync({
      agentId: "main",
      content: "hello",
      name: "AGENTS.md",
    });

    expect(apiMocks.saveAgentFile).toHaveBeenCalledWith("main", "AGENTS.md", "hello");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: agentsKeys.files("main") });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: agentsKeys.file("main", "AGENTS.md") });
  });
});
