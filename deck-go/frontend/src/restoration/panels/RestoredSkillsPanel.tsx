import { useEffect, useMemo, useState } from "react";
import type { DeckGoSkillEntry, DeckGoSkillsResponse } from "../../api";
import { fetchSkills, updateSkill } from "../../api";
import { JsonDetails, ShellStat } from "../../shell-components";

type PanelState = "idle" | "loading" | "ready";
type SkillStatus = "ready" | "needs-setup" | "disabled";

const VALID_SOURCES = new Set<DeckGoSkillEntry["source"]>(["bundled", "managed", "plugin"]);

function normalizeSkill(raw: Record<string, unknown>): DeckGoSkillEntry {
  const skillKey =
    typeof raw.skillKey === "string" ? raw.skillKey : typeof raw.name === "string" ? raw.name : "";
  const disabled = raw.disabled === true;
  const eligible = raw.eligible !== false;
  const hasMissing = Array.isArray(raw.missing) && raw.missing.length > 0;

  let status: SkillStatus = "ready";
  if (disabled) {
    status = "disabled";
  } else if (hasMissing || !eligible) {
    status = "needs-setup";
  }

  const source = typeof raw.source === "string" ? raw.source : "bundled";
  return {
    key: typeof raw.key === "string" ? raw.key : skillKey,
    name: typeof raw.name === "string" ? raw.name : skillKey,
    status,
    source: VALID_SOURCES.has(source as DeckGoSkillEntry["source"])
      ? (source as DeckGoSkillEntry["source"])
      : "bundled",
    enabled: !disabled,
    missingRequirements: Array.isArray(raw.missing) ? (raw.missing as string[]) : undefined,
    config:
      typeof raw.config === "object" && raw.config !== null
        ? (raw.config as Record<string, unknown>)
        : undefined,
    description: typeof raw.description === "string" ? raw.description : undefined,
    emoji: typeof raw.emoji === "string" ? raw.emoji : undefined,
    homepage: typeof raw.homepage === "string" ? raw.homepage : undefined,
    primaryEnv: typeof raw.primaryEnv === "string" ? raw.primaryEnv : undefined,
    installOptions: Array.isArray(raw.install)
      ? (raw.install as DeckGoSkillEntry["installOptions"])
      : undefined,
  };
}

export function RestoredSkillsPanel() {
  const [payload, setPayload] = useState<DeckGoSkillsResponse | null>(null);
  const [selectedSkillKey, setSelectedSkillKey] = useState("");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<"idle" | "updating">("idle");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [error, setError] = useState("");

  const refresh = async (preferredSkillKey?: string) => {
    setLoadState("loading");
    try {
      const next = await fetchSkills();
      setPayload(next);
      setLoadState("ready");
      setError("");
      const skills = (next.skills ?? []).map(normalizeSkill);
      const fallbackKey = preferredSkillKey?.trim() || skills[0]?.key || "";
      setSelectedSkillKey((current) =>
        skills.some((skill) => skill.key === current)
          ? current
          : skills.some((skill) => skill.key === fallbackKey)
            ? fallbackKey
            : skills[0]?.key || "",
      );
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : "failed to load skills");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const skills = useMemo(() => (payload?.skills ?? []).map(normalizeSkill), [payload]);
  const selectedSkill = skills.find((skill) => skill.key === selectedSkillKey) ?? skills[0] ?? null;
  const readyCount = skills.filter((skill) => skill.status === "ready").length;
  const setupCount = skills.filter((skill) => skill.status === "needs-setup").length;

  const runToggle = async (enabled: boolean) => {
    if (!selectedSkill) {
      return;
    }
    setActionState("updating");
    try {
      const result = await updateSkill(selectedSkill.key, { enabled });
      setActionResult(result);
      setError("");
      await refresh(selectedSkill.key);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "skill update failed");
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-restored-workspace">
      <div className="deckgo-column">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Installed skills</h2>
          </div>
          <p className="deckgo-card-subtitle">
            First Vite-owned skills slice: installed inventory and a bounded enable/disable action.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-pill-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Skills {loadState}
              </span>
              <span className="deckgo-pill">{skills.length} installed</span>
              <span className="deckgo-pill">{setupCount} need setup</span>
            </div>
            <div className="deckgo-grid deckgo-grid-3">
              <ShellStat label="installed" value={skills.length} />
              <ShellStat label="ready" value={readyCount} />
              <ShellStat label="needs setup" value={setupCount} />
            </div>
            <div className="deckgo-actions">
              <button
                className="deckgo-button"
                type="button"
                onClick={() => void refresh(selectedSkillKey)}
              >
                Refresh skills
              </button>
              <button
                className="deckgo-button is-primary"
                type="button"
                onClick={() => void runToggle(true)}
                disabled={!selectedSkill || actionState !== "idle" || selectedSkill.enabled}
              >
                {actionState === "updating" ? "Updating" : "Enable"}
              </button>
              <button
                className="deckgo-button is-danger"
                type="button"
                onClick={() => void runToggle(false)}
                disabled={!selectedSkill || actionState !== "idle" || !selectedSkill.enabled}
              >
                {actionState === "updating" ? "Updating" : "Disable"}
              </button>
            </div>
            {error ? <p className="deckgo-note">{error}</p> : null}
            {skills.length === 0 ? (
              <p className="deckgo-note">No skills reported.</p>
            ) : (
              <ul className="deckgo-shell-list">
                {skills.map((skill) => (
                  <li key={skill.key}>
                    <button
                      type="button"
                      className={`deckgo-selectable-card ${selectedSkill?.key === skill.key ? "is-selected" : ""}`}
                      onClick={() => setSelectedSkillKey(skill.key)}
                    >
                      <strong>
                        {skill.emoji ? `${skill.emoji} ` : ""}
                        {skill.name}
                      </strong>
                      <div className="deckgo-meta">
                        key: {skill.key} | source: {skill.source} | status: {skill.status}
                      </div>
                      <div className="deckgo-meta">enabled: {skill.enabled ? "yes" : "no"}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-restored-chat-main">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Selected skill</h2>
          </div>
          <p className="deckgo-card-subtitle">
            This slice stays intentionally narrow: inventory truth, setup visibility, and a direct
            enable/disable action.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            {selectedSkill ? (
              <>
                <div className="deckgo-restored-hero-strip">
                  <div>
                    <p className="deckgo-kicker">Skill</p>
                    <strong>{selectedSkill.name}</strong>
                    <p className="deckgo-note">{selectedSkill.description || "No description"}</p>
                  </div>
                  <div className="deckgo-pill-row">
                    <span className="deckgo-pill">source {selectedSkill.source}</span>
                    <span className="deckgo-pill">status {selectedSkill.status}</span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2">
                  <ShellStat label="enabled" value={selectedSkill.enabled ? "yes" : "no"} />
                  <ShellStat label="primary env" value={selectedSkill.primaryEnv || "n/a"} />
                </div>
                {selectedSkill.missingRequirements?.length ? (
                  <JsonDetails
                    title="Missing requirements"
                    payload={selectedSkill.missingRequirements}
                  />
                ) : null}
                <JsonDetails title="Skill payload" payload={selectedSkill} />
              </>
            ) : (
              <p className="deckgo-note">Choose a skill to inspect it.</p>
            )}
            {actionResult ? <JsonDetails title="Last skill action" payload={actionResult} /> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
