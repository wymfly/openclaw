"use client";

import type { ReactNode } from "react";
import { ChannelLegacySettingsPanel } from "@/components/panels/channels/ChannelLegacySettingsPanel";
import { OpenClawWeixinWizard } from "@/components/panels/channels/OpenClawWeixinWizard";
import { OpenClawWeixinStatusPanel } from "@/components/panels/channels/OpenClawWeixinWizard";
import { WeComWizard } from "@/components/panels/channels/WeComWizard";
import { ChannelWizardDialog } from "@/components/panels/channels/wizard/wizard-spec-loader";
import { getChannelUiRegistryEntry } from "./channel-ui-registry";

export interface ChannelOnboardingRenderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface ChannelOnboardingDescriptor {
  channelId: string;
  kind: "adapter" | "login";
  titleKey: string;
  renderPanel: () => ReactNode;
  renderDialog: (props: ChannelOnboardingRenderProps) => ReactNode;
}

const LOCAL_ONBOARDING_DESCRIPTORS: Record<string, ChannelOnboardingDescriptor> = {
  wecom: {
    channelId: "wecom",
    kind: "adapter",
    titleKey: "channels.settings.configureWizard",
    renderPanel: () => <ChannelLegacySettingsPanel channelId="wecom" hideDmPolicy />,
    renderDialog: ({ open, onOpenChange }) => (
      <WeComWizard open={open} onOpenChange={onOpenChange} />
    ),
  },
  "openclaw-weixin": {
    channelId: "openclaw-weixin",
    kind: "login",
    titleKey: "channels.settings.configureWizard",
    renderPanel: () => <OpenClawWeixinStatusPanel />,
    renderDialog: ({ open, onOpenChange }) => (
      <OpenClawWeixinWizard open={open} onOpenChange={onOpenChange} />
    ),
  },
};

export function getLocalOnboardingDescriptor(
  channelId: string,
): ChannelOnboardingDescriptor | null {
  return LOCAL_ONBOARDING_DESCRIPTORS[channelId] ?? null;
}

export function createWizardSpecOnboardingDescriptor(
  channelId: string,
): ChannelOnboardingDescriptor {
  return {
    channelId,
    kind: "adapter",
    titleKey: "channels.settings.configureWizard",
    renderPanel: () => <ChannelLegacySettingsPanel channelId={channelId} />,
    renderDialog: ({ open, onOpenChange }: ChannelOnboardingRenderProps) => (
      <ChannelWizardDialog channelId={channelId} open={open} onOpenChange={onOpenChange} />
    ),
  };
}

export function getRegistryOnboardingDescriptor(
  channelId: string,
): ChannelOnboardingDescriptor | null {
  const localDescriptor = getLocalOnboardingDescriptor(channelId);
  if (localDescriptor) {
    return localDescriptor;
  }

  const uiEntry = getChannelUiRegistryEntry(channelId);
  if (uiEntry?.ownership.onboarding === "wizard-spec") {
    return createWizardSpecOnboardingDescriptor(channelId);
  }

  return null;
}
