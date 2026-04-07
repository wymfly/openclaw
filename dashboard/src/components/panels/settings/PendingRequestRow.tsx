"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PendingRequest } from "@/stores/devices";
import { useNotificationsStore } from "@/stores/notifications";

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

function formatTimeAgo(ts: number): string {
  const diffMs = Date.now() - ts;
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

interface PendingRequestRowProps {
  request: PendingRequest;
  onApprove: (requestId: string) => Promise<void>;
  onReject: (requestId: string) => Promise<void>;
}

export function PendingRequestRow({ request, onApprove, onReject }: PendingRequestRowProps) {
  const t = useTranslations("devices");
  const tc = useTranslations("common");
  const { addToast } = useNotificationsStore();
  const [loadingAction, setLoadingAction] = useState<"approve" | "reject" | null>(null);

  const displayName = request.displayName || request.deviceId.slice(0, 8);
  const role = request.role ?? request.roles?.[0] ?? "viewer";

  const handleAction = async (action: "approve" | "reject") => {
    setLoadingAction(action);
    try {
      if (action === "approve") {
        await onApprove(request.requestId);
      } else {
        await onReject(request.requestId);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("operationFailed");
      addToast("error", msg);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-card px-3 py-2">
      {/* Platform icon + name */}
      <span className="text-sm shrink-0" role="img" aria-label={request.platform ?? "device"}>
        {platformIcon(request.platform)}
      </span>
      <span className="text-xs font-medium text-foreground truncate min-w-0 flex-1">
        {displayName}
      </span>

      {/* Role badge */}
      <Badge variant="outline" className="text-[10px] border-border text-muted-foreground shrink-0">
        {role}
      </Badge>

      {/* Requested time ago */}
      <span className="text-[10px] text-[var(--text-tertiary)] shrink-0 whitespace-nowrap">
        {t("requestedAgo", { time: formatTimeAgo(request.ts) })}
      </span>

      {/* Action buttons */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="xs"
          variant="default"
          disabled={loadingAction !== null}
          onClick={() => void handleAction("approve")}
          className="cursor-pointer"
        >
          {loadingAction === "approve" ? tc("loading") : t("approve")}
        </Button>
        <Button
          size="xs"
          variant="destructive"
          disabled={loadingAction !== null}
          onClick={() => void handleAction("reject")}
          className="cursor-pointer"
        >
          {loadingAction === "reject" ? tc("loading") : t("reject")}
        </Button>
      </div>
    </div>
  );
}
