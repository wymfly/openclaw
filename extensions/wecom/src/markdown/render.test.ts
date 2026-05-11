import { describe, expect, it } from "vitest";
import { chunkWecomMarkdownText, renderWecomMarkdownText } from "./render.js";

describe("WeCom markdown rendering", () => {
  it("downgrades markdown constructs that render poorly in WeCom", () => {
    const rendered = renderWecomMarkdownText(`## 工具测试结果

\`\`\`ts
smartTableAddRecords({ records })
\`\`\`

> \`smartsheet_add_fields\` 的部分字段类型：
> \`FIELD_TYPE_DATE_TIME\` / \`FIELD_TYPE_NUMBER\`

文档权限类：\`get_auth\` / \`grant_access\``);

    expect(rendered).toContain("## 工具测试结果");
    expect(rendered).toContain("smartTableAddRecords({ records })");
    expect(rendered).toContain("smartsheet_add_fields 的部分字段类型");
    expect(rendered).toContain("FIELD_TYPE_DATE_TIME / FIELD_TYPE_NUMBER");
    expect(rendered).toContain("文档权限类：get_auth / grant_access");
    expect(rendered).not.toContain("```");
    expect(rendered).not.toContain("`");
    expect(rendered.split("\n").some((line) => line.trimStart().startsWith(">"))).toBe(false);
  });

  it("chunks rendered markdown by utf8 bytes", () => {
    const chunks = chunkWecomMarkdownText("一二三四五六", { maxBytes: 9 });

    expect(chunks).toEqual(["一二三", "四五六"]);
  });
});
