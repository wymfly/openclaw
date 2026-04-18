"use client";

import {
  type ChannelOnboardingDescriptor,
  type ChannelOnboardingRenderProps,
  getRegistryOnboardingDescriptor,
} from "@/features/channels/registry/channel-onboarding-descriptors";

export type { ChannelOnboardingDescriptor, ChannelOnboardingRenderProps };

export function getChannelOnboardingDescriptor(
  channelId: string,
): ChannelOnboardingDescriptor | null {
  return getRegistryOnboardingDescriptor(channelId);
}
