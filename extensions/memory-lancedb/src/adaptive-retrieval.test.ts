import { describe, test, expect } from "vitest";
import { shouldSkipRetrieval } from "./adaptive-retrieval.js";

describe("shouldSkipRetrieval", () => {
  describe("skip patterns", () => {
    test("skips greetings", () => {
      expect(shouldSkipRetrieval("hi")).toBe(true);
      expect(shouldSkipRetrieval("hello")).toBe(true);
      expect(shouldSkipRetrieval("hey there")).toBe(true);
      expect(shouldSkipRetrieval("Good morning!")).toBe(true);
    });

    test("skips shell commands", () => {
      expect(shouldSkipRetrieval("git status")).toBe(true);
      expect(shouldSkipRetrieval("npm install express")).toBe(true);
      expect(shouldSkipRetrieval("docker build -t app .")).toBe(true);
      expect(shouldSkipRetrieval("/help")).toBe(true);
    });

    test("skips affirmations", () => {
      expect(shouldSkipRetrieval("yes")).toBe(true);
      expect(shouldSkipRetrieval("ok")).toBe(true);
      expect(shouldSkipRetrieval("thanks!")).toBe(true);
      expect(shouldSkipRetrieval("got it")).toBe(true);
    });

    test("skips continuation prompts", () => {
      expect(shouldSkipRetrieval("go ahead")).toBe(true);
      expect(shouldSkipRetrieval("continue")).toBe(true);
      expect(shouldSkipRetrieval("do it")).toBe(true);
      expect(shouldSkipRetrieval("继续")).toBe(true);
      expect(shouldSkipRetrieval("好的")).toBe(true);
    });

    test("skips system messages", () => {
      expect(shouldSkipRetrieval("HEARTBEAT")).toBe(true);
      expect(shouldSkipRetrieval("[System] checking status")).toBe(true);
    });

    test("skips very short text", () => {
      expect(shouldSkipRetrieval("abc")).toBe(true);
      expect(shouldSkipRetrieval("")).toBe(true);
    });
  });

  describe("force retrieve patterns", () => {
    test("retrieves memory-related queries", () => {
      expect(shouldSkipRetrieval("do you remember my name?")).toBe(false);
      expect(shouldSkipRetrieval("what did I tell you last time?")).toBe(false);
      expect(shouldSkipRetrieval("recall my preferences")).toBe(false);
    });

    test("retrieves personal info queries", () => {
      expect(shouldSkipRetrieval("what is my email address?")).toBe(false);
      expect(shouldSkipRetrieval("my name is Alice")).toBe(false);
    });

    test("retrieves CJK memory queries", () => {
      expect(shouldSkipRetrieval("你记得我喜欢什么吗")).toBe(false);
      expect(shouldSkipRetrieval("之前我说过这个事")).toBe(false);
      expect(shouldSkipRetrieval("上次提到过的")).toBe(false);
    });
  });

  describe("normal queries", () => {
    test("retrieves substantive questions", () => {
      expect(shouldSkipRetrieval("What design patterns should I use for the API?")).toBe(false);
      expect(shouldSkipRetrieval("How do I configure the database connection?")).toBe(false);
    });

    test("retrieves long enough statements", () => {
      expect(shouldSkipRetrieval("I want to refactor the authentication module")).toBe(false);
    });

    test("skips short non-question non-CJK messages", () => {
      expect(shouldSkipRetrieval("sounds good")).toBe(true);
      expect(shouldSkipRetrieval("nice work")).toBe(true);
    });

    test("does not skip short CJK messages with questions", () => {
      expect(shouldSkipRetrieval("这是什么？")).toBe(false);
    });
  });

  describe("metadata stripping", () => {
    test("strips cron wrapper", () => {
      expect(shouldSkipRetrieval("[cron:123 daily-job] git pull")).toBe(true);
    });

    test("strips timestamp prefix", () => {
      expect(shouldSkipRetrieval("[Mon 2026-03-02 04:21 GMT+8] hello")).toBe(true);
    });

    test("strips metadata headers then evaluates content", () => {
      const withMetadata = `Sender (untrusted metadata):\nUser: Alice\n\nWhat is my preferred theme?`;
      expect(shouldSkipRetrieval(withMetadata)).toBe(false);
    });
  });

  describe("custom minLength", () => {
    test("uses custom minimum length", () => {
      // "short msg" is 9 chars, default min for non-CJK is 15
      expect(shouldSkipRetrieval("short msg")).toBe(true);

      // With custom minLength of 5, it should not skip
      expect(shouldSkipRetrieval("short msg", 5)).toBe(false);
    });

    test("questions bypass minLength", () => {
      // "why?" is only 4 chars, below the absolute minimum of 5, so it gets skipped.
      // Use a longer question to test that the ? bypass works with custom minLength.
      expect(shouldSkipRetrieval("why this?", 20)).toBe(false);
      // But a very short question below 5 chars is always skipped
      expect(shouldSkipRetrieval("why?", 20)).toBe(true);
    });
  });
});
