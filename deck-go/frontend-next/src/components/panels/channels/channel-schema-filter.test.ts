import { describe, expect, it } from "vitest";
import type { FormField } from "@/lib/schema-parser";
import { filterSchemaFields } from "./channel-schema-filter";

function field(key: string, children?: FormField[]): FormField {
  return {
    key,
    type: "object",
    children,
  };
}

describe("filterSchemaFields", () => {
  it("removes exact nested paths and prunes empty parents", () => {
    const fields: FormField[] = [
      field("bot", [
        { key: "dm", type: "object" },
        { key: "webhook", type: "object" },
      ]),
      field("routing", [{ key: "failClosedOnDefaultRoute", type: "boolean" }]),
      field("media", [{ key: "maxBytes", type: "number" }]),
    ];

    const filtered = filterSchemaFields(fields, ["bot.dm", "routing.failClosedOnDefaultRoute"]);

    expect(filtered.map((entry) => entry.key)).toEqual(["bot", "media"]);
    expect(filtered[0]?.children?.map((entry) => entry.key)).toEqual(["webhook"]);
    expect(filtered[1]?.children?.map((entry) => entry.key)).toEqual(["maxBytes"]);
  });

  it("supports wildcard record paths such as accounts.*.bot.dm", () => {
    const fields: FormField[] = [
      {
        key: "accounts",
        type: "object",
        valueSchema: {
          key: "value",
          type: "object",
          children: [
            field("bot", [
              { key: "dm", type: "object" },
              { key: "webhook", type: "object" },
            ]),
            field("agent", [
              { key: "dm", type: "object" },
              { key: "token", type: "string" },
            ]),
          ],
        },
      },
      field("defaultAccount", [{ key: "name", type: "string" }]),
    ];

    const filtered = filterSchemaFields(fields, ["accounts.*.bot.dm", "accounts.*.agent.dm"]);

    const valueChildren = filtered[0]?.valueSchema?.children ?? [];
    const bot = valueChildren.find((entry) => entry.key === "bot");
    const agent = valueChildren.find((entry) => entry.key === "agent");

    expect(bot?.children?.map((entry) => entry.key)).toEqual(["webhook"]);
    expect(agent?.children?.map((entry) => entry.key)).toEqual(["token"]);
    expect(filtered[1]?.key).toBe("defaultAccount");
  });
});
