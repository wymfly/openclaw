import { afterEach, describe, expect, it } from "vitest";
import { isChatVisualStateRequested } from "../visual-state-seed";

const originalLocation = window.location;

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  });
});

describe("chat visual state seed", () => {
  it("reads the fallback href when a Location-like test double cannot expose search", () => {
    const replacementLocation = Object.create(originalLocation) as Location;
    Object.defineProperty(replacementLocation, "href", {
      configurable: true,
      value: "http://127.0.0.1:5174/?deckVisualState=chat-rich",
    });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: replacementLocation,
    });

    expect(isChatVisualStateRequested()).toBe(true);
  });
});
