import { describe, it, expect } from "vitest";
import {
  categorizeContent,
  extractTitle,
  detectLanguage,
  extractKeywords,
  extractDocsFromMessages,
} from "../doc-extractor.js";

// ---------------------------------------------------------------------------
// categorizeContent
// ---------------------------------------------------------------------------

describe("categorizeContent", () => {
  it("detects summary category from Chinese keywords", () => {
    expect(categorizeContent("这是本次讨论的总结，以下是摘要内容")).toBe("summary");
  });

  it("detects summary category from English keywords", () => {
    expect(categorizeContent("Here is the summary and overview of the project")).toBe("summary");
  });

  it("detects plan category from Chinese keywords", () => {
    expect(categorizeContent("以下是详细的计划和路线图安排")).toBe("plan");
  });

  it("detects plan category from English keywords", () => {
    expect(categorizeContent("This is the project roadmap with milestone dates and timeline")).toBe(
      "plan",
    );
  });

  it("detects spec category from Chinese keywords", () => {
    expect(categorizeContent("API 接口规范定义，包含请求协议")).toBe("spec");
  });

  it("detects spec category from English keywords", () => {
    expect(
      categorizeContent("The API specification defines the schema and protocol contract"),
    ).toBe("spec");
  });

  it("detects manual category from Chinese keywords", () => {
    expect(categorizeContent("用户手册：按照以下步骤操作指南")).toBe("manual");
  });

  it("detects manual category from English keywords", () => {
    expect(categorizeContent("This tutorial is a step-by-step guide with instructions")).toBe(
      "manual",
    );
  });

  it("detects draft category from Chinese keywords", () => {
    expect(categorizeContent("草稿：一些初步的想法和思考")).toBe("draft");
  });

  it("detects draft category from English keywords", () => {
    expect(categorizeContent("This is a draft with some brainstorm ideas and notes")).toBe("draft");
  });

  it("defaults to draft for ambiguous content", () => {
    expect(categorizeContent("Hello world, just some random text here")).toBe("draft");
  });

  it("picks category with highest keyword count when multiple match", () => {
    // "plan" keywords: 计划, 路线图, 里程碑 => 3 hits
    // "summary" keywords: 总结 => 1 hit
    const text = "项目计划包含路线图和里程碑，附带总结";
    expect(categorizeContent(text)).toBe("plan");
  });
});

// ---------------------------------------------------------------------------
// extractTitle
// ---------------------------------------------------------------------------

describe("extractTitle", () => {
  it("extracts title from markdown h1 heading", () => {
    expect(extractTitle("# Project Overview\n\nSome content here")).toBe("Project Overview");
  });

  it("extracts title from markdown h2 heading", () => {
    expect(extractTitle("## Implementation Plan\n\nDetails below")).toBe("Implementation Plan");
  });

  it("extracts title from first sentence when no heading", () => {
    expect(extractTitle("This is the first sentence. And some more text follows.")).toBe(
      "This is the first sentence",
    );
  });

  it("truncates long titles", () => {
    const longHeading = "# " + "A".repeat(200);
    const title = extractTitle(longHeading);
    expect(title.length).toBeLessThanOrEqual(100);
  });

  it("uses first line for very short content", () => {
    expect(extractTitle("Short note")).toBe("Short note");
  });

  it("handles Chinese headings", () => {
    expect(extractTitle("# 项目概述\n\n内容详情")).toBe("项目概述");
  });
});

// ---------------------------------------------------------------------------
// detectLanguage
// ---------------------------------------------------------------------------

describe("detectLanguage", () => {
  it("detects Chinese text", () => {
    expect(detectLanguage("这是一段中文内容，用于测试语言检测功能")).toBe("zh");
  });

  it("detects English text", () => {
    expect(detectLanguage("This is an English text for language detection testing")).toBe("en");
  });

  it("detects mixed text as Chinese when CJK ratio is high", () => {
    expect(detectLanguage("这是混合内容 with some English 但主要是中文")).toBe("zh");
  });

  it("defaults to en for empty text", () => {
    expect(detectLanguage("")).toBe("en");
  });
});

// ---------------------------------------------------------------------------
// extractKeywords
// ---------------------------------------------------------------------------

describe("extractKeywords", () => {
  it("extracts relevant keywords from text", () => {
    const keywords = extractKeywords("API 接口设计规范和数据模型定义", "spec");
    expect(keywords.length).toBeGreaterThan(0);
    expect(keywords.length).toBeLessThanOrEqual(10);
  });

  it("returns empty array for empty text", () => {
    expect(extractKeywords("", "draft")).toEqual([]);
  });

  it("deduplicates keywords", () => {
    const keywords = extractKeywords("计划 计划 计划 方案 方案", "plan");
    const unique = new Set(keywords);
    expect(keywords.length).toBe(unique.size);
  });
});

// ---------------------------------------------------------------------------
// extractDocsFromMessages
// ---------------------------------------------------------------------------

describe("extractDocsFromMessages", () => {
  it("extracts docs from assistant messages with substantive content", () => {
    const longPlanContent =
      "# 项目计划\n\n" +
      "以下是详细的项目计划和路线图：\n\n" +
      "## 里程碑 1：基础架构搭建\n\n" +
      "在第一阶段，我们需要完成基础架构的搭建工作，包括数据库设计、接口定义和核心模块开发。\n\n" +
      "## 里程碑 2：功能开发\n\n" +
      "第二阶段将重点关注功能开发，包括用户管理、权限控制和数据分析模块的实现。\n\n" +
      "## 里程碑 3：测试与部署\n\n" +
      "最后阶段进行全面测试和部署，确保系统稳定运行。这是一个完整的计划方案，包含时间表和资源分配。";

    const messages = [
      { role: "user", content: "请给我一个项目计划" },
      { role: "assistant", content: longPlanContent },
    ];

    const results = extractDocsFromMessages(messages);
    expect(results.length).toBe(1);
    expect(results[0].category).toBe("plan");
    expect(results[0].title).toBe("项目计划");
    expect(results[0].language).toBe("zh");
  });

  it("skips short assistant messages (< 200 chars)", () => {
    const messages = [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello! How can I help?" },
    ];

    const results = extractDocsFromMessages(messages);
    expect(results).toHaveLength(0);
  });

  it("skips user messages", () => {
    const messages = [
      {
        role: "user",
        content: "A".repeat(300) + " summary overview recap conclusion",
      },
    ];

    const results = extractDocsFromMessages(messages);
    expect(results).toHaveLength(0);
  });

  it("extracts multiple docs from a conversation", () => {
    const messages = [
      { role: "user", content: "Write a spec" },
      {
        role: "assistant",
        content:
          "# API Specification\n\n" +
          "The following specification defines the schema and protocol contract for the API. " +
          "Each endpoint has a defined request and response format.\n\n" +
          "## Endpoints\n\n- GET /api/items\n- POST /api/items\n\n" +
          "This specification is the contract between frontend and backend.",
      },
      { role: "user", content: "Now write a guide" },
      {
        role: "assistant",
        content:
          "# User Guide\n\n" +
          "This tutorial provides step-by-step instructions for using the system. " +
          "Follow this guide to get started with the setup process.\n\n" +
          "## Step 1: Installation\n\nRun the installer and follow the instructions.\n\n" +
          "## Step 2: Configuration\n\nConfigure the settings as described in this manual.",
      },
    ];

    const results = extractDocsFromMessages(messages);
    expect(results.length).toBe(2);
    expect(results[0].category).toBe("spec");
    expect(results[1].category).toBe("manual");
  });

  it("returns empty array for empty messages", () => {
    expect(extractDocsFromMessages([])).toEqual([]);
  });
});
