import type { AccessDescriptor } from "./access-descriptor.types";

const descriptors = new Map<string, AccessDescriptor>();

export interface RegisterOptions {
  /**
   * Allow replacing an existing registration.
   *
   * Production code should never pass this flag. It exists for dev-only
   * hot-reload scenarios where Next.js re-evaluates a module and would
   * otherwise trigger the "already registered" error.
   */
  readonly allowReplace?: boolean;
}

/**
 * Register a descriptor for a channel.
 *
 * @throws when the channelId is already registered and `allowReplace` is falsy.
 */
export function registerAccessDescriptor(
  descriptor: AccessDescriptor,
  options: RegisterOptions = {},
): void {
  if (descriptors.has(descriptor.channelId) && !options.allowReplace) {
    throw new Error(`AccessDescriptor already registered: ${descriptor.channelId}`);
  }
  descriptors.set(descriptor.channelId, descriptor);
}

/**
 * Retrieve the descriptor for a channel, or null when none is registered.
 */
export function getAccessDescriptor(channelId: string): AccessDescriptor | null {
  return descriptors.get(channelId) ?? null;
}

/**
 * Check whether a descriptor is registered for a channel.
 */
export function hasAccessDescriptor(channelId: string): boolean {
  return descriptors.has(channelId);
}

/**
 * Test-only helper. Production code must not invoke this.
 */
export function __resetAccessDescriptorsForTesting(): void {
  descriptors.clear();
}
