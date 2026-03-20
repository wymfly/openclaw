import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSkillsStore, type SkillEntry } from "./skills";

beforeEach(() => {
  useSkillsStore.setState({
    skills: [],
    selectedSkillKey: null,
    statusFilter: "all",
    searchQuery: "",
    loading: false,
    error: null,
  });
  vi.restoreAllMocks();
});

const SKILL_FIXTURE: SkillEntry = {
  key: "web-search",
  name: "Web Search",
  description: "",
  status: "ready",
  source: "bundled",
  enabled: true,
};

const SKILL_MANAGED: SkillEntry = {
  key: "custom-skill",
  name: "Custom Skill",
  description: "",
  status: "needs-setup",
  source: "managed",
  enabled: false,
  missingRequirements: ["API_KEY"],
};

describe("skills store", () => {
  it("has correct initial state", () => {
    const state = useSkillsStore.getState();
    expect(state.skills).toEqual([]);
    expect(state.selectedSkillKey).toBeNull();
    expect(state.statusFilter).toBe("all");
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("selectSkill sets selectedSkillKey", () => {
    useSkillsStore.getState().selectSkill("web-search");
    expect(useSkillsStore.getState().selectedSkillKey).toBe("web-search");
  });

  it("setStatusFilter changes filter", () => {
    useSkillsStore.getState().setStatusFilter("ready");
    expect(useSkillsStore.getState().statusFilter).toBe("ready");
  });

  describe("fetchSkills", () => {
    it("sets skills on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ skills: [SKILL_FIXTURE, SKILL_MANAGED] }), { status: 200 }),
      );

      await useSkillsStore.getState().fetchSkills();

      expect(useSkillsStore.getState().skills).toHaveLength(2);
      expect(useSkillsStore.getState().loading).toBe(false);
    });

    it("normalizes gateway skills.status response shape", async () => {
      // Gateway returns { skillKey, disabled, eligible, missing, ... } —
      // the store must normalize to { key, name, status, source, enabled, ... }
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            skills: [
              {
                skillKey: "web-search",
                name: "Web Search",
                source: "bundled",
                disabled: false,
                eligible: true,
                missing: [],
              },
              {
                skillKey: "custom-plugin",
                name: "Custom Plugin",
                source: "plugin",
                disabled: true,
                eligible: true,
                missing: [],
              },
              {
                skillKey: "needs-key",
                name: "Needs Key",
                source: "managed",
                disabled: false,
                eligible: false,
                missing: ["API_KEY"],
              },
            ],
          }),
          { status: 200 },
        ),
      );

      await useSkillsStore.getState().fetchSkills();

      const skills = useSkillsStore.getState().skills;
      expect(skills).toHaveLength(3);

      // Ready skill
      expect(skills[0].key).toBe("web-search");
      expect(skills[0].status).toBe("ready");
      expect(skills[0].enabled).toBe(true);

      // Disabled skill
      expect(skills[1].key).toBe("custom-plugin");
      expect(skills[1].status).toBe("disabled");
      expect(skills[1].enabled).toBe(false);

      // Needs-setup skill
      expect(skills[2].key).toBe("needs-key");
      expect(skills[2].status).toBe("needs-setup");
      expect(skills[2].enabled).toBe(true);
      expect(skills[2].missingRequirements).toEqual(["API_KEY"]);
    });

    it("passes agentId as query param", async () => {
      const spy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(JSON.stringify({ skills: [] }), { status: 200 }));

      await useSkillsStore.getState().fetchSkills("agent-1");

      expect(spy).toHaveBeenCalledWith("/api/skills?agentId=agent-1");
    });

    it("sets error on failure", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "Gateway down" }), { status: 502 }),
      );

      await useSkillsStore.getState().fetchSkills();

      expect(useSkillsStore.getState().error).toBe("Gateway down");
      expect(useSkillsStore.getState().loading).toBe(false);
    });

    it("handles fetch exception", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

      await useSkillsStore.getState().fetchSkills();

      expect(useSkillsStore.getState().error).toBe("Network error");
    });
  });

  describe("updateSkill", () => {
    it("updates skill in state on success", async () => {
      useSkillsStore.setState({ skills: [SKILL_FIXTURE] });
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ ok: true, skillKey: "web-search", config: {} }), {
          status: 200,
        }),
      );

      const ok = await useSkillsStore.getState().updateSkill("web-search", { enabled: false });

      expect(ok).toBe(true);
      expect(useSkillsStore.getState().skills[0].enabled).toBe(false);
    });

    it("returns false on non-ok response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "not found" }), { status: 404 }),
      );

      const ok = await useSkillsStore.getState().updateSkill("nope", { enabled: true });
      expect(ok).toBe(false);
    });

    it("encodes skillKey in URL", async () => {
      const spy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

      await useSkillsStore.getState().updateSkill("my/skill", { enabled: true });

      expect(spy).toHaveBeenCalledWith(
        "/api/skills/my%2Fskill",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });

  describe("installSkill", () => {
    it("returns true on success and sends caller-provided installId", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

      const ok = await useSkillsStore.getState().installSkill("new-skill", "installer-abc");

      expect(ok).toBe(true);
      // Verify installId matches the caller-provided value (not a random UUID)
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body as string) as { name: string; installId: string };
      expect(body.name).toBe("new-skill");
      expect(body.installId).toBe("installer-abc");
    });

    it("returns false on failure", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "fail" }), { status: 500 }),
      );

      const ok = await useSkillsStore.getState().installSkill("bad-skill", "inst-1");
      expect(ok).toBe(false);
    });

    it("returns false on network error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("timeout"));

      const ok = await useSkillsStore.getState().installSkill("x", "inst-2");
      expect(ok).toBe(false);
    });
  });
});
