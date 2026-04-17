import { afterEach, describe, expect, test } from "vitest";
import {
  __resetAccessDescriptorsForTesting,
  getAccessDescriptor,
  hasAccessDescriptor,
  registerAccessDescriptor,
} from "./access-descriptor-registry";
import type { AccessDescriptor } from "./access-descriptor.types";

function makeDescriptor(channelId: string): AccessDescriptor {
  return {
    channelId,
    async load() {
      return null;
    },
    render() {
      return null;
    },
  };
}

describe("access-descriptor-registry", () => {
  afterEach(() => {
    __resetAccessDescriptorsForTesting();
  });

  test("register + get returns the same descriptor object", () => {
    const descriptor = makeDescriptor("test-channel");
    registerAccessDescriptor(descriptor);
    expect(getAccessDescriptor("test-channel")).toBe(descriptor);
  });

  test("get returns null for unknown channelId", () => {
    expect(getAccessDescriptor("nonexistent")).toBeNull();
  });

  test("hasAccessDescriptor agrees with getAccessDescriptor !== null", () => {
    expect(hasAccessDescriptor("foo")).toBe(false);
    registerAccessDescriptor(makeDescriptor("foo"));
    expect(hasAccessDescriptor("foo")).toBe(true);
    expect(hasAccessDescriptor("foo")).toBe(getAccessDescriptor("foo") !== null);
  });

  test("register duplicate without allowReplace throws", () => {
    registerAccessDescriptor(makeDescriptor("dup"));
    expect(() => registerAccessDescriptor(makeDescriptor("dup"))).toThrow(/already registered/i);
  });

  test("register duplicate with allowReplace: true overwrites silently", () => {
    const first = makeDescriptor("replace-me");
    const second = makeDescriptor("replace-me");
    registerAccessDescriptor(first);
    expect(() => registerAccessDescriptor(second, { allowReplace: true })).not.toThrow();
    expect(getAccessDescriptor("replace-me")).toBe(second);
  });

  test("__resetAccessDescriptorsForTesting clears all registrations", () => {
    registerAccessDescriptor(makeDescriptor("a"));
    registerAccessDescriptor(makeDescriptor("b"));
    expect(hasAccessDescriptor("a")).toBe(true);
    expect(hasAccessDescriptor("b")).toBe(true);
    __resetAccessDescriptorsForTesting();
    expect(hasAccessDescriptor("a")).toBe(false);
    expect(hasAccessDescriptor("b")).toBe(false);
  });
});
