import AjvPkg from "ajv";
import { describe, expect, it } from "vitest";
import { buildMcpToolSchema } from "./mcp-http.schema.js";

const Ajv = AjvPkg as unknown as new (opts?: object) => import("ajv").default;

describe("buildMcpToolSchema", () => {
  it("merges duplicate union properties instead of keeping the first action shape", () => {
    const [tool] = buildMcpToolSchema([
      {
        name: "wecom_doc",
        description: "WeCom doc",
        parameters: {
          oneOf: [
            {
              type: "object",
              required: ["action", "docId", "requests"],
              properties: {
                action: { const: "update_content" },
                docId: { type: "string" },
                requests: {
                  type: "array",
                  items: {
                    type: "object",
                    oneOf: [
                      {
                        required: ["insert_text"],
                        properties: {
                          insert_text: {
                            type: "object",
                            required: ["text"],
                            properties: { text: { type: "string" } },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
            {
              type: "object",
              required: ["action", "requests"],
              properties: {
                action: { const: "get_form_statistic" },
                formId: { type: "string" },
                requests: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["repeated_id", "req_type"],
                    properties: {
                      repeated_id: { type: "string" },
                      req_type: { type: "integer", enum: [1, 2, 3] },
                    },
                  },
                },
              },
            },
            {
              type: "object",
              required: ["action", "repeatedId", "answerIds"],
              properties: {
                action: { const: "get_form_answer" },
                repeatedId: { type: "string" },
                answerIds: { type: "array", items: { type: "integer" } },
              },
            },
          ],
        },
        execute: async () => ({ content: [{ type: "text", text: "ok" }] }),
      },
    ] as never);

    const properties = tool?.inputSchema.properties as Record<string, Record<string, unknown>>;
    expect(properties.action?.enum).toEqual([
      "update_content",
      "get_form_statistic",
      "get_form_answer",
    ]);
    expect(properties.requests?.anyOf).toHaveLength(2);

    const ajv = new Ajv({ strict: false });
    const validate = ajv.compile(tool?.inputSchema);

    expect(
      validate({
        action: "get_form_statistic",
        formId: "FORMID",
        requests: [{ repeated_id: "REPEATED_ID", req_type: 2 }],
      }),
      JSON.stringify(validate.errors, null, 2),
    ).toBe(true);
    expect(
      validate({
        action: "update_content",
        docId: "DOCID",
        requests: [{ insert_text: { text: "hello" } }],
      }),
      JSON.stringify(validate.errors, null, 2),
    ).toBe(true);
  });
});
