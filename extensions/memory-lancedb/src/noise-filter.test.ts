import { describe, test, expect } from "vitest";
import { isNoise, filterNoise } from "./noise-filter.js";

describe("isNoise", () => {
  test("very short text is noise", () => {
    expect(isNoise("hi")).toBe(true);
    expect(isNoise("")).toBe(true);
    expect(isNoise("    ")).toBe(true);
  });

  test("agent denial patterns are noise", () => {
    expect(isNoise("I don't have any information about that topic")).toBe(true);
    expect(isNoise("I'm not sure about that")).toBe(true);
    expect(isNoise("I don't recall any details")).toBe(true);
    expect(isNoise("No relevant memories found")).toBe(true);
    expect(isNoise("I wasn't able to find anything")).toBe(true);
  });

  test("meta-question patterns are noise", () => {
    expect(isNoise("Do you remember what I told you yesterday?")).toBe(true);
    expect(isNoise("Can you recall my preferences?")).toBe(true);
    expect(isNoise("Did I tell you about the project?")).toBe(true);
    expect(isNoise("你还记得我说过什么吗")).toBe(true);
    expect(isNoise("记不记得上次的事")).toBe(true);
  });

  test("boilerplate is noise", () => {
    expect(isNoise("Hello, how are you doing today?")).toBe(true);
    expect(isNoise("HEARTBEAT check")).toBe(true);
    expect(isNoise("fresh session starting")).toBe(true);
  });

  test("diagnostic artifacts are noise", () => {
    expect(isNoise("query -> none found")).toBe(true);
    expect(isNoise("no explicit solution provided")).toBe(true);
  });

  test("real content is not noise", () => {
    expect(isNoise("My preferred coding language is TypeScript")).toBe(false);
    expect(isNoise("The server runs on port 3000 with Node.js")).toBe(false);
    expect(isNoise("We decided to use PostgreSQL for the database")).toBe(false);
  });

  test("respects filter options", () => {
    // Denial should not be filtered when disabled
    expect(
      isNoise("I don't have any information about that", {
        filterDenials: false,
      }),
    ).toBe(false);

    // Meta-questions should not be filtered when disabled
    expect(
      isNoise("Do you remember what I told you?", {
        filterMetaQuestions: false,
      }),
    ).toBe(false);

    // Boilerplate should not be filtered when disabled
    expect(
      isNoise("Hello, how are you today?", {
        filterBoilerplate: false,
      }),
    ).toBe(false);
  });

  test("Chinese patterns detected correctly", () => {
    expect(isNoise("如果你知道的话只回复代号")).toBe(true);
    expect(isNoise("只回复 none")).toBe(true);
    expect(isNoise("我之前说过这个吗？")).toBe(true);
  });
});

describe("filterNoise", () => {
  test("filters noise items from array", () => {
    const items = [
      { id: 1, text: "I prefer dark mode in all editors" },
      { id: 2, text: "Hello, how are you?" },
      { id: 3, text: "The API endpoint is /api/v2/users" },
      { id: 4, text: "I don't have any information about that" },
    ];

    const filtered = filterNoise(items, (item) => item.text);
    expect(filtered).toHaveLength(2);
    expect(filtered[0].id).toBe(1);
    expect(filtered[1].id).toBe(3);
  });

  test("returns empty array when all items are noise", () => {
    const items = [{ text: "hi" }, { text: "hello" }, { text: "HEARTBEAT" }];

    const filtered = filterNoise(items, (item) => item.text);
    expect(filtered).toHaveLength(0);
  });

  test("returns all items when none are noise", () => {
    const items = [
      { text: "My name is Alice and I work at ACME Corp" },
      { text: "The database connection string uses port 5432" },
    ];

    const filtered = filterNoise(items, (item) => item.text);
    expect(filtered).toHaveLength(2);
  });
});
