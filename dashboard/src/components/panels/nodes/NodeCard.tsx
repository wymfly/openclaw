"use client";

import { Check, Pencil, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useNodesStore, type NodeSummary } from "@/stores/nodes";

interface NodeCardProps {
  node: NodeSummary;
}

export function NodeCard({ node }: NodeCardProps) {
  const t = useTranslations("nodes");
  const renameNode = useNodesStore((s) => s.renameNode);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(node.displayName ?? "");

  const handleRename = async () => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === node.displayName) {
      setEditing(false);
      return;
    }
    const ok = await renameNode(node.nodeId, trimmed);
    if (ok) {
      setEditing(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{
              backgroundColor: node.connected
                ? "var(--status-connected)"
                : "var(--status-disconnected)",
            }}
          />
          {editing ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 text-sm font-semibold px-1 py-0.5 rounded border bg-transparent"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void handleRename();
                  }
                  if (e.key === "Escape") {
                    setEditing(false);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => void handleRename()}
                className="p-1 rounded hover:bg-[var(--accent)]"
              >
                <Check size={14} className="text-[var(--success)]" />
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="p-1 rounded hover:bg-[var(--accent)]"
              >
                <X size={14} className="text-[var(--muted-foreground)]" />
              </button>
            </div>
          ) : (
            <>
              <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                {node.displayName ?? node.nodeId}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setNewName(node.displayName ?? "");
                  setEditing(true);
                }}
                className="p-1 rounded hover:bg-[var(--accent)]"
              >
                <Pencil size={12} className="text-[var(--muted-foreground)]" />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 ml-4">
          <StatusBadge connected={node.connected} paired={node.paired} />
          {node.platform && (
            <span className="text-[10px] text-[var(--text-tertiary)]">{node.platform}</span>
          )}
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <InfoRow label={t("nodeId")} value={node.nodeId} mono />
        {node.version && <InfoRow label={t("version")} value={node.version} />}
        {node.coreVersion && <InfoRow label={t("coreVersion")} value={node.coreVersion} />}
        {node.uiVersion && <InfoRow label={t("uiVersion")} value={node.uiVersion} />}
        {node.deviceFamily && <InfoRow label={t("deviceFamily")} value={node.deviceFamily} />}
        {node.modelIdentifier && <InfoRow label={t("model")} value={node.modelIdentifier} />}
        {node.remoteIp && <InfoRow label={t("remoteIp")} value={node.remoteIp} mono />}
        {node.connectedAtMs != null && (
          <InfoRow label={t("connectedAt")} value={new Date(node.connectedAtMs).toLocaleString()} />
        )}
      </div>

      {/* Capabilities */}
      {node.caps.length > 0 && (
        <div>
          <h4 className="text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>
            {t("capabilities")}
          </h4>
          <div className="flex flex-wrap gap-1">
            {node.caps.map((cap) => (
              <span
                key={cap}
                className="px-2 py-0.5 text-[10px] rounded-full"
                style={{ backgroundColor: "var(--primary-muted)", color: "var(--primary)" }}
              >
                {cap}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Commands */}
      {node.commands.length > 0 && (
        <div>
          <h4 className="text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>
            {t("commands")}
          </h4>
          <div className="flex flex-wrap gap-1">
            {node.commands.map((cmd) => (
              <span
                key={cmd}
                className="px-2 py-0.5 text-[10px] font-mono rounded-full"
                style={{ backgroundColor: "var(--muted)", color: "var(--foreground)" }}
              >
                {cmd}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ connected, paired }: { connected: boolean; paired: boolean }) {
  const t = useTranslations("nodes");
  if (connected && paired) {
    return (
      <span
        className="text-[10px] px-1.5 py-0.5 rounded-full"
        style={{ backgroundColor: "var(--success-muted)", color: "var(--success-muted-text)" }}
      >
        {t("statusConnected")}
      </span>
    );
  }
  if (paired) {
    return (
      <span
        className="text-[10px] px-1.5 py-0.5 rounded-full"
        style={{ backgroundColor: "var(--neutral-muted)", color: "var(--neutral-muted-text)" }}
      >
        {t("statusPaired")}
      </span>
    );
  }
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded-full"
      style={{ backgroundColor: "var(--warning-muted)", color: "var(--warning-muted-text)" }}
    >
      {t("statusUnpaired")}
    </span>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] text-[var(--text-tertiary)]">{label}</dt>
      <dd className={`text-xs ${mono ? "font-mono" : ""}`} style={{ color: "var(--foreground)" }}>
        {value}
      </dd>
    </div>
  );
}
