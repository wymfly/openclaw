"use client";

import type { ReactNode } from "react";
import { ChannelLegacySettingsPanel } from "./ChannelLegacySettingsPanel";
import { OpenClawWeixinWizard } from "./OpenClawWeixinWizard";
import { OpenClawWeixinStatusPanel } from "./OpenClawWeixinWizard";
import { WeComWizard } from "./WeComWizard";

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

const ONBOARDING_DESCRIPTORS: Record<string, ChannelOnboardingDescriptor> = {
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

export function getChannelOnboardingDescriptor(
  channelId: string,
): ChannelOnboardingDescriptor | null {
  return ONBOARDING_DESCRIPTORS[channelId] ?? null;
}
