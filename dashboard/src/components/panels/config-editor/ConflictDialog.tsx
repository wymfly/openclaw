"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useMemo, useCallback } from "react";
import { computeConfigDiff, type DiffEntry } from "@/lib/config-diff";
import { useConfigStore } from "@/stores/config";

interface ConflictDialogProps {
  onReload: () => void;
  onCancel: () => void;
}

/** Format a value for display, truncating long strings */
function formatValue(val: unknown): string {
  if (val === undefined) {
    return "—";
  }
  if (val === null) {
    return "null";
  }
  if (typeof val === "string") {
    return val.length > 40 ? `"${val.slice(0, 40)}…"` : `"${val}"`;
  }
  if (typeof val === "number" || typeof val === "boolean") {
    return String(val);
  }
  if (Array.isArray(val)) {
    return `[${val.length} items]`;
  }
  if (typeof val === "object") {
    return "{...}";
  }
  return JSON.stringify(val) ?? "?";
}

/** Per-field resolution choice */
type FieldChoice = "local" | "remote";

/**
 * Set a value at a dotted path in a nested object, creating intermediate
 * objects as needed. Mutates the target.
 */
function setDeepValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!current[key] || typeof current[key] !== "object" || Array.isArray(current[key])) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  if (value === undefined) {
    delete current[parts[parts.length - 1]];
  } else {
    current[parts[parts.length - 1]] = value;
  }
}

/**
 * Get the local and remote display values for a diff entry.
 *
 * computeConfigDiff(remote, local) produces:
 * - type="add": key exists in local but NOT remote → oldValue=undefined, newValue=local_value
 * - type="remove": key exists in remote but NOT local → oldValue=remote_value, newValue=undefined
 * - type="change": both exist, different → oldValue=remote_value, newValue=local_value
 */
function getDisplayValues(diff: DiffEntry): { localVal: unknown; remoteVal: unknown } {
  return {
    localVal: diff.newValue, // newValue is always the local side
    remoteVal: diff.oldValue, // oldValue is always the remote side
  };
}

export function ConflictDialog({ onReload, onCancel }: ConflictDialogProps) {
  const t = useTranslations("config");
  const tc = useTranslations("common");
  const { editedConfig, remoteConfig, resolveConflict, saving } = useConfigStore();

  // Compute field-level diffs between remote and local
  const diffs = useMemo((): DiffEntry[] => {
    if (!remoteConfig) {
      return [];
    }
    try {
      const local = JSON.parse(editedConfig || "{}") as Record<string, unknown>;
      const remote = JSON.parse(remoteConfig) as Record<string, unknown>;
      return computeConfigDiff(remote, local);
    } catch {
      return [];
    }
  }, [editedConfig, remoteConfig]);

  const [choices, setChoices] = useState<Record<string, FieldChoice>>({});

  const allResolved = diffs.length > 0 && diffs.every((d) => choices[d.path] !== undefined);

  const handleChoose = useCallback((path: string, choice: FieldChoice) => {
    setChoices((prev) => ({ ...prev, [path]: choice }));
  }, []);

  const handleChooseAll = useCallback(
    (choice: FieldChoice) => {
      const all: Record<string, FieldChoice> = {};
      for (const d of diffs) {
        all[d.path] = choice;
      }
      setChoices(all);
    },
    [diffs],
  );

  const handleApply = useCallback(async () => {
    if (!remoteConfig) {
      return;
    }
    try {
      const remote = JSON.parse(remoteConfig) as Record<string, unknown>;

      // Start from remote, then apply local choices
      const merged = structuredClone(remote);

      for (const diff of diffs) {
        const choice = choices[diff.path] ?? "remote";
        if (choice === "local") {
          // newValue is the local side
          setDeepValue(merged, diff.path, diff.newValue);
        }
        // "remote" → value already in merged base (from oldValue/remote)
      }

      await resolveConflict(merged);
    } catch {
      // Error handled by store
    }
  }, [remoteConfig, diffs, choices, resolveConflict]);

  // Fallback: no remote config available, show simple dialog
  if (!remoteConfig || diffs.length === 0) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      >
        <div
          className="rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl"
          style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle size={20} style={{ color: "var(--status-disconnected)" }} />
            <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {t("conflict")}
            </h3>
          </div>
          <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
            {t("conflictDescription")}
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="text-xs px-3 py-1.5 rounded"
              style={{
                border: "1px solid var(--border)",
                color: "var(--muted-foreground)",
                backgroundColor: "var(--card)",
              }}
            >
              {tc("cancel")}
            </button>
            <button
              onClick={onReload}
              className="text-xs px-3 py-1.5 rounded"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              {t("reload")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
    >
      <div
        className="rounded-lg shadow-xl max-w-2xl w-full mx-4 flex flex-col max-h-[80vh]"
        style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <AlertTriangle size={20} style={{ color: "var(--warning)" }} />
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {t("conflictTitle")}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {t("conflictFieldCount", { count: diffs.length })}
            </p>
          </div>
        </div>

        {/* Quick resolve buttons */}
        <div
          className="flex items-center justify-between px-5 py-2 border-b"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--muted)" }}
        >
          <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
            {t("conflictQuickResolve")}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => handleChooseAll("local")}
              className="text-[11px] px-2 py-0.5 rounded transition-colors"
              style={{
                border: "1px solid var(--border)",
                color: "var(--foreground)",
                backgroundColor: "var(--card)",
              }}
            >
              {t("conflictKeepAllLocal")}
            </button>
            <button
              onClick={() => handleChooseAll("remote")}
              className="text-[11px] px-2 py-0.5 rounded transition-colors"
              style={{
                border: "1px solid var(--border)",
                color: "var(--foreground)",
                backgroundColor: "var(--card)",
              }}
            >
              {t("conflictAcceptAllRemote")}
            </button>
          </div>
        </div>

        {/* Diff table */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <div className="flex flex-col gap-2">
            {diffs.map((diff) => {
              const choice = choices[diff.path];
              const { localVal, remoteVal } = getDisplayValues(diff);
              return (
                <div
                  key={diff.path}
                  className="rounded-lg border px-3 py-2"
                  style={{
                    borderColor: choice ? "var(--primary)" : "var(--border)",
                    backgroundColor: "var(--card)",
                  }}
                >
                  {/* Path */}
                  <div className="text-xs font-mono mb-1.5" style={{ color: "var(--foreground)" }}>
                    {diff.path}
                  </div>

                  {/* Values + choice buttons */}
                  <div className="flex items-stretch gap-2">
                    {/* Local value */}
                    <button
                      onClick={() => handleChoose(diff.path, "local")}
                      className="flex-1 rounded px-2 py-1.5 text-left transition-colors"
                      style={{
                        backgroundColor:
                          choice === "local" ? "var(--warning-muted)" : "var(--muted)",
                        border:
                          choice === "local"
                            ? "2px solid var(--warning)"
                            : "1px solid var(--border)",
                      }}
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <ArrowLeft size={10} style={{ color: "var(--muted-foreground)" }} />
                        <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                          {t("conflictLocal")}
                        </span>
                        {choice === "local" && (
                          <Check size={10} style={{ color: "var(--warning)" }} />
                        )}
                      </div>
                      <div
                        className="text-xs font-mono break-all"
                        style={{ color: "var(--foreground)" }}
                      >
                        {formatValue(localVal)}
                      </div>
                    </button>

                    {/* Remote value */}
                    <button
                      onClick={() => handleChoose(diff.path, "remote")}
                      className="flex-1 rounded px-2 py-1.5 text-left transition-colors"
                      style={{
                        backgroundColor:
                          choice === "remote" ? "var(--primary-muted)" : "var(--muted)",
                        border:
                          choice === "remote"
                            ? "2px solid var(--primary)"
                            : "1px solid var(--border)",
                      }}
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <ArrowRight size={10} style={{ color: "var(--muted-foreground)" }} />
                        <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                          {t("conflictRemote")}
                        </span>
                        {choice === "remote" && (
                          <Check size={10} style={{ color: "var(--primary)" }} />
                        )}
                      </div>
                      <div
                        className="text-xs font-mono break-all"
                        style={{ color: "var(--foreground)" }}
                      >
                        {formatValue(remoteVal)}
                      </div>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-3 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={onReload}
            className="text-xs px-3 py-1.5 rounded"
            style={{
              border: "1px solid var(--border)",
              color: "var(--muted-foreground)",
              backgroundColor: "var(--card)",
            }}
          >
            {t("conflictDiscardLocal")}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="text-xs px-3 py-1.5 rounded"
              style={{
                border: "1px solid var(--border)",
                color: "var(--muted-foreground)",
                backgroundColor: "var(--card)",
              }}
            >
              {tc("cancel")}
            </button>
            <button
              onClick={() => void handleApply()}
              disabled={!allResolved || saving}
              className="text-xs px-3 py-1.5 rounded transition-opacity disabled:opacity-40"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              {saving ? t("saving") : t("conflictApplyMerge")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
