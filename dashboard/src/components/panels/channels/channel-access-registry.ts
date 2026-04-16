export interface ChannelAccessDescriptor {
  channelId: string;
  accessKey: string;
}

const CHANNEL_ACCESS_REGISTRY: Record<string, ChannelAccessDescriptor> = {
  wecom: {
    channelId: "wecom",
    accessKey: "wecom",
  },
};

export function getChannelAccessDescriptor(channelId: string): ChannelAccessDescriptor | null {
  return CHANNEL_ACCESS_REGISTRY[channelId] ?? null;
}

export function hasDedicatedAccessSurface(channelId: string): boolean {
  return getChannelAccessDescriptor(channelId) !== null;
}
