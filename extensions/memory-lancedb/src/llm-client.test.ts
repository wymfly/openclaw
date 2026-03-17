import { describe, test, expect, vi, beforeEach } from "vitest";
import {
  extractJsonFromResponse,
  repairCommonJson,
  createLlmClient,
  type LlmClientConfig,
} from "./llm-client.js";

describe("extractJsonFromResponse", () => {
  test("extracts JSON from markdown code fence", () => {
    const input = 'Some text\n```json\n{"key": "value"}\n```\nMore text';
    expect(extractJsonFromResponse(input)).toBe('{"key": "value"}');
  });

  test("extracts JSON from plain code fence", () => {
    const input = '```\n{"a": 1}\n```';
    expect(extractJsonFromResponse(input)).toBe('{"a": 1}');
  });

  test("extracts JSON by balanced brace matching", () => {
    const input = 'Here is the result: {"memories": [{"cat": "profile"}]} done.';
    expect(extractJsonFromResponse(input)).toBe('{"memories": [{"cat": "profile"}]}');
  });

  test("handles nested braces correctly", () => {
    const input = '{"outer": {"inner": {"deep": 1}}}';
    expect(extractJsonFromResponse(input)).toBe('{"outer": {"inner": {"deep": 1}}}');
  });

  test("returns null for no JSON content", () => {
    expect(extractJsonFromResponse("no json here")).toBeNull();
    expect(extractJsonFromResponse("")).toBeNull();
  });

  test("returns null for unbalanced braces", () => {
    expect(extractJsonFromResponse("{ unclosed")).toBeNull();
  });
});

describe("repairCommonJson", () => {
  test("removes trailing commas before } or ]", () => {
    expect(JSON.parse(repairCommonJson('{"a": 1,}'))).toEqual({ a: 1 });
    expect(JSON.parse(repairCommonJson("[1, 2,]"))).toEqual([1, 2]);
  });

  test("escapes raw newlines inside strings", () => {
    const input = '{"text": "line1\nline2"}';
    const repaired = repairCommonJson(input);
    expect(JSON.parse(repaired)).toEqual({ text: "line1\nline2" });
  });

  test("escapes raw tabs inside strings", () => {
    const input = '{"text": "col1\tcol2"}';
    const repaired = repairCommonJson(input);
    expect(JSON.parse(repaired)).toEqual({ text: "col1\tcol2" });
  });

  test("escapes stray quotes inside strings", () => {
    const input = '{"text": "He said "hello" loudly"}';
    const repaired = repairCommonJson(input);
    const parsed = JSON.parse(repaired);
    expect(parsed.text).toContain("hello");
  });

  test("passes valid JSON through unchanged", () => {
    const valid = '{"a": 1, "b": [2, 3]}';
    expect(repairCommonJson(valid)).toBe(valid);
  });
});

describe("createLlmClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  test("returns parsed JSON from successful response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"memories": []}' } }],
      }),
    });

    const client = createLlmClient({
      apiKey: "test-key",
      model: "gpt-4",
    });

    const result = await client.completeJson<{ memories: unknown[] }>("test prompt");
    expect(result).toEqual({ memories: [] });
  });

  test("returns null on HTTP error", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const client = createLlmClient({
      apiKey: "test-key",
      model: "gpt-4",
    });

    const result = await client.completeJson("test");
    expect(result).toBeNull();
    expect(client.getLastError()).toContain("HTTP 500");
  });

  test("returns null on empty response content", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "" } }],
      }),
    });

    const client = createLlmClient({
      apiKey: "test-key",
      model: "gpt-4",
    });

    const result = await client.completeJson("test");
    expect(result).toBeNull();
  });

  test("handles JSON in markdown fences", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '```json\n{"key": "val"}\n```' } }],
      }),
    });

    const client = createLlmClient({
      apiKey: "test-key",
      model: "gpt-4",
    });

    const result = await client.completeJson<{ key: string }>("test");
    expect(result).toEqual({ key: "val" });
  });

  test("attempts JSON repair on parse failure", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"a": 1,}' } }],
      }),
    });

    const log = vi.fn();
    const client = createLlmClient({
      apiKey: "test-key",
      model: "gpt-4",
      log,
    });

    const result = await client.completeJson<{ a: number }>("test");
    expect(result).toEqual({ a: 1 });
  });

  test("returns null on network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network error"));

    const client = createLlmClient({
      apiKey: "test-key",
      model: "gpt-4",
    });

    const result = await client.completeJson("test");
    expect(result).toBeNull();
    expect(client.getLastError()).toContain("Network error");
  });

  test("uses custom baseURL", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"ok": true}' } }],
      }),
    });

    const client = createLlmClient({
      apiKey: "test-key",
      model: "gpt-4",
      baseURL: "https://custom.api.com",
    });

    await client.completeJson("test");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://custom.api.com/v1/chat/completions",
      expect.any(Object),
    );
  });
});
