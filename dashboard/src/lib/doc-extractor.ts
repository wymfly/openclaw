/**
 * Document extraction and categorization engine.
 *
 * Uses keyword + heuristic-based categorization (no LLM dependency).
 * Extracts structured documents from conversation messages.
 */

export type DocCategory = "summary" | "plan" | "spec" | "manual" | "draft";

export interface ExtractionResult {
  title: string;
  category: DocCategory;
  content: string;
  keywords: string[];
  language: "zh" | "en";
}

// Category detection keywords (zh + en)
const CATEGORY_KEYWORDS: Record<DocCategory, string[]> = {
  summary: ["总结", "摘要", "概要", "小结", "summary", "recap", "overview", "conclusion"],
  plan: [
    "计划",
    "方案",
    "路线图",
    "里程碑",
    "plan",
    "roadmap",
    "milestone",
    "timeline",
    "schedule",
  ],
  spec: [
    "规范",
    "规格",
    "接口",
    "协议",
    "API",
    "spec",
    "specification",
    "protocol",
    "schema",
    "contract",
  ],
  manual: ["手册", "教程", "指南", "步骤", "manual", "guide", "tutorial", "how-to", "instructions"],
  draft: ["草稿", "初稿", "想法", "draft", "idea", "brainstorm", "notes"],
};

const MIN_CONTENT_LENGTH = 200;
const MAX_TITLE_LENGTH = 100;
const MAX_KEYWORDS = 10;

// CJK Unicode ranges
const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g;

/**
 * Categorize content by counting keyword matches per category.
 * Returns the category with the highest score; defaults to "draft".
 */
export function categorizeContent(text: string): DocCategory {
  const lower = text.toLowerCase();

  let bestCategory: DocCategory = "draft";
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [
    DocCategory,
    string[],
  ][]) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

/**
 * Extract title from the first markdown heading or first sentence.
 */
export function extractTitle(text: string): string {
  // Try markdown headings (h1–h3)
  const headingMatch = text.match(/^#{1,3}\s+(.+)$/m);
  if (headingMatch) {
    const title = headingMatch[1].trim();
    return title.length > MAX_TITLE_LENGTH ? title.slice(0, MAX_TITLE_LENGTH) : title;
  }

  // Fall back to first sentence (split on period, question mark, newline)
  const firstLine = text.split(/\n/)[0] ?? text;
  const sentence = firstLine.split(/[.。!！?？]/)[0]?.trim() ?? firstLine.trim();

  if (sentence.length > MAX_TITLE_LENGTH) {
    return sentence.slice(0, MAX_TITLE_LENGTH);
  }

  return sentence || "Untitled";
}

/**
 * Detect language by CJK character ratio.
 * Returns "zh" when CJK characters make up ≥15% of the text.
 */
export function detectLanguage(text: string): "zh" | "en" {
  if (!text) {
    return "en";
  }

  const cjkMatches = text.match(CJK_RE);
  if (!cjkMatches) {
    return "en";
  }

  const ratio = cjkMatches.length / text.length;
  return ratio >= 0.15 ? "zh" : "en";
}

/**
 * Extract keywords from text based on category-specific terms and
 * significant words found in the content.
 */
export function extractKeywords(text: string, category: DocCategory): string[] {
  if (!text) {
    return [];
  }

  const lower = text.toLowerCase();
  const keywords = new Set<string>();

  // Add matching category keywords
  const categoryKws = CATEGORY_KEYWORDS[category] ?? [];
  for (const kw of categoryKws) {
    if (lower.includes(kw.toLowerCase())) {
      keywords.add(kw);
    }
  }

  // Extract significant words (3+ chars, not common stop words)
  const STOP_WORDS = new Set([
    "the",
    "and",
    "for",
    "are",
    "but",
    "not",
    "you",
    "all",
    "can",
    "had",
    "her",
    "was",
    "one",
    "our",
    "out",
    "has",
    "this",
    "that",
    "with",
    "from",
    "have",
    "will",
    "been",
    "some",
    "they",
    "其中",
    "以下",
    "这个",
    "进行",
    "使用",
    "包含",
    "通过",
  ]);

  const words = text.match(/[\w\u4e00-\u9fff]{3,}/g) ?? [];
  for (const word of words) {
    if (!STOP_WORDS.has(word.toLowerCase()) && keywords.size < MAX_KEYWORDS) {
      keywords.add(word);
    }
  }

  return [...keywords].slice(0, MAX_KEYWORDS);
}

/**
 * Flatten message content — handles both string and ContentBlock[] formats.
 * Gateway chat.history may return content as an array of blocks:
 * `[{ type: "text", text: "..." }, { type: "tool_use", ... }]`
 */
function flattenContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter(
        (block: Record<string, unknown>) => block.type === "text" && typeof block.text === "string",
      )
      .map((block: Record<string, unknown>) => block.text as string)
      .join("\n\n");
  }
  return "";
}

/**
 * Extract document candidates from conversation messages.
 * Only processes assistant messages with substantive content (≥ 200 chars).
 * Handles both string content and ContentBlock[] from Gateway.
 */
export function extractDocsFromMessages(
  messages: Array<{ role: string; content: unknown }>,
): ExtractionResult[] {
  const results: ExtractionResult[] = [];

  for (const msg of messages) {
    if (msg.role !== "assistant") {
      continue;
    }
    const text = flattenContent(msg.content);
    if (!text || text.length < MIN_CONTENT_LENGTH) {
      continue;
    }

    const category = categorizeContent(text);
    const title = extractTitle(text);
    const language = detectLanguage(text);
    const keywords = extractKeywords(text, category);

    results.push({
      title,
      category,
      content: text,
      keywords,
      language,
    });
  }

  return results;
}
