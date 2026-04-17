"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { ChannelInfo } from "@/stores/channels";
import "./index";
import { getAccessDescriptor } from "./access-descriptor-registry";
import type { AccessRenderContext } from "./access-descriptor.types";
import { useAccessDescriptorState } from "./hooks";

/**
 * Common consumer of the access descriptor registry.
 *
 * Shared by `ChannelDetail` (Status summary slot) and `ChannelAccessTab`
 * (Access tab slot). MUST NOT special-case any channelId — all rendering
 * decisions are delegated to the registered descriptor.
 *
 * When no descriptor is registered for the channel:
 *   - `slot="access-tab"` renders an "unsupported" fallback card
 *   - `slot="status-summary"` returns null (no summary to show)
 */
export function AccessPanel({
  channelId,
  channel,
  slot,
  selectedAccountId,
  onSelectedAccountChange,
  onActivateAccessTab,
}: {
  channelId: string;
  channel: ChannelInfo | null;
  slot: "access-tab" | "status-summary";
  selectedAccountId?: string;
  onSelectedAccountChange?: (accountId: string) => void;
  onActivateAccessTab?: () => void;
}): ReactNode {
  const t = useTranslations("channels.access");
  const descriptor = getAccessDescriptor(channelId);
  const { state, actions } = useAccessDescriptorState(descriptor, {
    channel,
    selectedAccountId,
    onSelectedAccountChange,
    onActivateAccessTab,
  });

  const renderContext: AccessRenderContext = {
    channelId,
    channel,
    state,
    actions,
    selectedAccountId,
    onSelectedAccountChange,
  };

  if (!descriptor) {
    if (slot === "status-summary") {
      return null;
    }
    return (
      <div className="px-4 py-4">
        <div
          className="rounded-lg border px-4 py-3 text-sm"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
        >
          <p className="font-medium" style={{ color: "var(--foreground)" }}>
            {t("unsupportedTitle")}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
            {t("unsupportedDescription")}
          </p>
        </div>
      </div>
    );
  }

  if (slot === "status-summary") {
    return descriptor.renderStatusSummary?.(renderContext) ?? null;
  }

  return descriptor.render(renderContext);
}
