"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DeviceTokenSummary, PairedDevice } from "@/stores/devices";
import { ConfirmActionModal } from "./ConfirmActionModal";
import { TokenRotateModal } from "./TokenRotateModal";

function platformIcon(platform?: string): string {
  switch (platform?.toLowerCase()) {
    case "ios":
      return "\u{1F4F1}"; // 📱
    case "android":
      return "\u{1F916}"; // 🤖
    default:
      return "\u{1F4BB}"; // 💻
  }
}

function formatTimeAgo(ms: number): string {
  const diffMs = Date.now() - ms;
  const minutes = Math.max(1, Math.floor(diffMs / 60_000));
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString();
}

interface DeviceRowProps {
  device: PairedDevice;
  isSelf: boolean;
  onRemove: (deviceId: string) => Promise<void>;
  onRotate: (deviceId: string, role: string) => Promise<string>;
  onRevoke: (deviceId: string, role: string) => Promise<void>;
}

export function DeviceRow({ device, isSelf, onRemove, onRotate, onRevoke }: DeviceRowProps) {
  const t = useTranslations("devices");
  const [expanded, setExpanded] = useState(false);

  // Modal state
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    variant: "default" | "destructive";
    action: () => Promise<void>;
  }>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "",
    variant: "default",
    action: async () => {},
  });

  const [tokenModal, setTokenModal] = useState<{ open: boolean; token: string | null }>({
    open: false,
    token: null,
  });

  const displayName = device.displayName || device.deviceId.slice(0, 8);
  const roles = device.roles ?? (device.role ? [device.role] : []);
  const tokens = device.tokens ?? [];
  const hasRevoked = tokens.some((tok) => tok.revokedAtMs != null);
  const allActive = tokens.length > 0 && !hasRevoked;

  // --- Action handlers ---

  const openRemoveConfirm = () => {
    setConfirmModal({
      open: true,
      title: t("remove"),
      description: t("confirmRemove", { name: displayName }),
      confirmLabel: t("remove"),
      variant: "destructive",
      action: () => onRemove(device.deviceId),
    });
  };

  const openRevokeConfirm = (tok: DeviceTokenSummary) => {
    setConfirmModal({
      open: true,
      title: t("revoke"),
      description: t("confirmRevoke", { name: displayName, role: tok.role }),
      confirmLabel: t("revoke"),
      variant: "destructive",
      action: () => onRevoke(device.deviceId, tok.role),
    });
  };

  const openRotateConfirm = (tok: DeviceTokenSummary) => {
    setConfirmModal({
      open: true,
      title: t("rotate"),
      description: t("confirmRotate", { name: displayName, role: tok.role }),
      confirmLabel: t("rotate"),
      variant: "default",
      action: async () => {
        const newToken = await onRotate(device.deviceId, tok.role);
        setTokenModal({ open: true, token: newToken });
      },
    });
  };

  return (
    <>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        {/* Collapsed header — uses render={<div />} because action buttons may appear inside */}
        <CollapsibleTrigger
          render={<div />}
          className="group flex w-full cursor-pointer items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-card px-3 py-2 transition-colors hover:bg-accent"
        >
          {/* Platform icon */}
          <span className="text-sm shrink-0" role="img" aria-label={device.platform ?? "device"}>
            {platformIcon(device.platform)}
          </span>

          {/* Device name */}
          <span className="text-xs font-medium text-foreground truncate min-w-0 flex-1 text-left">
            {displayName}
          </span>

          {/* Role badges */}
          {roles.map((r) => (
            <Badge
              key={r}
              variant="outline"
              className="text-[10px] border-border text-muted-foreground shrink-0"
            >
              {r}
            </Badge>
          ))}

          {/* This Device badge */}
          {isSelf && (
            <Badge className="text-[10px] bg-[var(--primary-muted)] text-primary shrink-0">
              {t("thisDevice")}
            </Badge>
          )}

          {/* Status dot */}
          <span
            className={cn(
              "size-2 rounded-full shrink-0",
              allActive ? "bg-[var(--success)]" : hasRevoked ? "bg-destructive" : "bg-muted",
            )}
            title={allActive ? t("active") : hasRevoked ? t("revoked") : ""}
          />

          {/* Chevron */}
          <ChevronRight
            size={14}
            className={cn(
              "text-muted-foreground transition-transform duration-150 shrink-0",
              expanded && "rotate-90",
            )}
          />
        </CollapsibleTrigger>

        {/* Expanded detail panel */}
        <CollapsibleContent>
          <div className="ml-6 mt-1 space-y-3 rounded-md border border-[var(--border-subtle)] bg-card px-3 py-3">
            {/* Detail grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground">{t("platform")}</span>
              <span className="text-foreground">
                {device.platform ?? "-"} {device.deviceFamily ? `(${device.deviceFamily})` : ""}
              </span>

              <span className="text-muted-foreground">{t("ip")}</span>
              <span className="text-foreground font-mono">{device.remoteIp ?? "-"}</span>

              {device.approvedAtMs && (
                <>
                  <span className="text-muted-foreground">{t("pairedAgo", { time: "" })}</span>
                  <span className="text-[var(--text-tertiary)]">
                    {formatTimestamp(device.approvedAtMs)}
                  </span>
                </>
              )}
            </div>

            {/* Tokens table */}
            {tokens.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("tokens")}
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)]">
                        <th className="py-1 pr-3 text-left font-medium text-muted-foreground">
                          {t("role")}
                        </th>
                        <th className="py-1 pr-3 text-left font-medium text-muted-foreground">
                          {t("scopes")}
                        </th>
                        <th className="py-1 pr-3 text-left font-medium text-muted-foreground">
                          {t("lastActive", { time: "" })}
                        </th>
                        <th className="py-1 pr-3 text-left font-medium text-muted-foreground">
                          {t("status")}
                        </th>
                        <th className="py-1 text-right font-medium text-muted-foreground" />
                      </tr>
                    </thead>
                    <tbody>
                      {tokens.map((tok, idx) => {
                        const isRevoked = tok.revokedAtMs != null;
                        return (
                          <tr
                            key={`${tok.role}-${idx}`}
                            className="border-b border-[var(--border-subtle)] last:border-0"
                          >
                            <td className="py-1.5 pr-3 font-mono text-foreground">{tok.role}</td>
                            <td className="py-1.5 pr-3 text-muted-foreground">
                              {tok.scopes.join(", ") || "-"}
                            </td>
                            <td className="py-1.5 pr-3 text-[var(--text-tertiary)]">
                              {tok.lastUsedAtMs
                                ? t("lastActive", { time: formatTimeAgo(tok.lastUsedAtMs) })
                                : "-"}
                            </td>
                            <td className="py-1.5 pr-3">
                              <Badge
                                variant={isRevoked ? "destructive" : "outline"}
                                className="text-[10px]"
                              >
                                {isRevoked ? t("revoked") : t("active")}
                              </Badge>
                            </td>
                            <td className="py-1.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {/* Rotate — always allowed, even for self */}
                                <Button
                                  size="xs"
                                  variant="outline"
                                  disabled={isRevoked}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openRotateConfirm(tok);
                                  }}
                                  className="cursor-pointer"
                                >
                                  {t("rotate")}
                                </Button>

                                {/* Revoke — disabled for self device */}
                                {isSelf ? (
                                  <Tooltip>
                                    <TooltipTrigger render={<span />}>
                                      <Button
                                        size="xs"
                                        variant="destructive"
                                        disabled
                                        className="cursor-not-allowed"
                                      >
                                        {t("revoke")}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{t("cannotRevokeSelf")}</TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <Button
                                    size="xs"
                                    variant="destructive"
                                    disabled={isRevoked}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openRevokeConfirm(tok);
                                    }}
                                    className="cursor-pointer"
                                  >
                                    {t("revoke")}
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Remove Device button */}
            <div className="flex justify-end pt-1">
              {isSelf ? (
                <Tooltip>
                  <TooltipTrigger render={<span />}>
                    <Button size="sm" variant="destructive" disabled className="cursor-not-allowed">
                      {t("remove")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("cannotRemoveSelf")}</TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    openRemoveConfirm();
                  }}
                  className="cursor-pointer"
                >
                  {t("remove")}
                </Button>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Confirmation modal */}
      <ConfirmActionModal
        open={confirmModal.open}
        onOpenChange={(open) => setConfirmModal((prev) => ({ ...prev, open }))}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmLabel={confirmModal.confirmLabel}
        variant={confirmModal.variant}
        onConfirm={confirmModal.action}
      />

      {/* Token display modal */}
      <TokenRotateModal
        open={tokenModal.open}
        onOpenChange={(open) => setTokenModal((prev) => ({ ...prev, open }))}
        token={tokenModal.token}
      />
    </>
  );
}
