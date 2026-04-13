"use client";

import { Settings2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useChannelsStore } from "@/stores/channels";
import { ChannelLegacySettingsPanel } from "./ChannelLegacySettingsPanel";
import { ChannelSchemaSettings } from "./ChannelSchemaSettings";
import { getChannelOnboardingDescriptor } from "./onboarding-registry";

interface ChannelSettingsTabProps {
  channelId: string;
}

interface RetryState {
  attempts: number;
  minDelayMs: number;
  maxDelayMs: number;
  jitter: number;
}

const DEFAULT_RETRY: RetryState = {
  attempts: 3,
  minDelayMs: 1000,
  maxDelayMs: 30000,
  jitter: 0.2,
};

/**
 * Settings tab for a channel.
 *
 * When schema info is available (from config.schema discovery), renders the
 * schema-driven form which covers ALL fields including dmPolicy and retry.
 * Falls back to hardcoded DmPolicy + Retry fields when schema is unavailable.
 */
export function ChannelSettingsTab({ channelId }: ChannelSettingsTabProps) {
  const t = useTranslations("channels.settings");
  const { channelSchemas } = useChannelsStore();
  const [wizardOpen, setWizardOpen] = useState(false);
  const schemaInfo = channelSchemas.get(channelId);
  const onboardingDescriptor = getChannelOnboardingDescriptor(channelId);

  if (onboardingDescriptor) {
    return (
      <>
        <div className="flex flex-col h-full">
          <div className="px-4 pt-3 pb-2">
            <button
              onClick={() => setWizardOpen(true)}
              className="flex items-center gap-2 w-full text-xs px-3 py-2 rounded-lg border transition-colors hover:border-[var(--border-hover)]"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--card)",
                color: "var(--foreground)",
              }}
            >
              <Settings2 size={14} style={{ color: "var(--primary)" }} />
              <span>{t("configureWizard")}</span>
            </button>
          </div>
          <div className="flex-1 overflow-hidden">{onboardingDescriptor.renderPanel()}</div>
        </div>
        {onboardingDescriptor.renderDialog({ open: wizardOpen, onOpenChange: setWizardOpen })}
      </>
    );
  }

  // Schema available with renderable fields → schema-driven form
  // Falls back to legacy when schema has no properties (empty schema edge case)
  if (schemaInfo) {
    const props = schemaInfo.schema.properties;
    const hasFields = props && typeof props === "object" && Object.keys(props).length > 0;
    if (hasFields) {
      return <ChannelSchemaSettings channelId={channelId} schemaInfo={schemaInfo} />;
    }
  }

  // Fallback → hardcoded fields for channels without schema info or empty schema
  return <ChannelLegacySettingsPanel channelId={channelId} />;
}
