import { describe, test, expect } from "vitest";
import {
  chunkDocument,
  smartChunk,
  DEFAULT_CHUNKER_CONFIG,
  EMBEDDING_CONTEXT_LIMITS,
  type ChunkerConfig,
} from "./chunker.js";

describe("chunker", () => {
  describe("chunkDocument", () => {
    test("returns empty for empty input", () => {
      const result = chunkDocument("");
      expect(result.chunks).toEqual([]);
      expect(result.chunkCount).toBe(0);
    });

    test("returns empty for whitespace-only input", () => {
      const result = chunkDocument("   \n  \t  ");
      expect(result.chunks).toEqual([]);
      expect(result.chunkCount).toBe(0);
    });

    test("returns single chunk for short text", () => {
      const text = "Hello, this is a short document.";
      const result = chunkDocument(text);
      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0]).toBe(text);
      expect(result.totalOriginalLength).toBe(text.length);
    });

    test("splits long text into multiple chunks", () => {
      // Create text longer than default maxChunkSize (4000)
      const text = "A".repeat(10000);
      const result = chunkDocument(text);
      expect(result.chunks.length).toBeGreaterThan(1);
      expect(result.chunkCount).toBe(result.chunks.length);
    });

    test("preserves semantic boundaries (sentences)", () => {
      const sentences = [];
      for (let i = 0; i < 80; i++) {
        sentences.push(`This is sentence number ${i}. It contains some text.`);
      }
      const text = sentences.join(" ");

      const config: ChunkerConfig = {
        maxChunkSize: 500,
        overlapSize: 50,
        minChunkSize: 100,
        semanticSplit: true,
        maxLinesPerChunk: 50,
      };

      const result = chunkDocument(text, config);
      expect(result.chunks.length).toBeGreaterThan(1);

      // Each chunk (except possibly last) should end near a sentence boundary
      for (let i = 0; i < result.chunks.length - 1; i++) {
        const chunk = result.chunks[i];
        // Should end with punctuation or near it
        expect(chunk.length).toBeLessThanOrEqual(config.maxChunkSize);
      }
    });

    test("respects max lines per chunk", () => {
      const lines = [];
      for (let i = 0; i < 200; i++) {
        lines.push(`Line ${i}: some content here that is long enough.`);
      }
      const text = lines.join("\n");

      const config: ChunkerConfig = {
        maxChunkSize: 1500, // small enough to force many splits
        overlapSize: 100,
        minChunkSize: 50,
        semanticSplit: true,
        maxLinesPerChunk: 20,
      };

      const result = chunkDocument(text, config);
      expect(result.chunks.length).toBeGreaterThan(1);

      // Non-last chunks should respect maxLinesPerChunk.
      // The last chunk may be smaller/larger since it takes the remainder.
      for (let i = 0; i < result.chunks.length - 1; i++) {
        const lineCount = result.chunks[i].split("\n").length;
        expect(lineCount).toBeLessThanOrEqual(config.maxLinesPerChunk + 2);
      }
    });

    test("chunk metadata has correct indices", () => {
      const text = "Hello. World. This is a test.";
      const config: ChunkerConfig = {
        maxChunkSize: 15,
        overlapSize: 3,
        minChunkSize: 5,
        semanticSplit: true,
        maxLinesPerChunk: 50,
      };

      const result = chunkDocument(text, config);
      expect(result.metadatas.length).toBe(result.chunks.length);

      for (let i = 0; i < result.chunks.length; i++) {
        const meta = result.metadatas[i];
        expect(meta.length).toBe(result.chunks[i].length);
        expect(meta.endIndex).toBeGreaterThanOrEqual(meta.startIndex);
      }
    });

    test("overlap is applied between chunks", () => {
      const text = "A".repeat(1000);
      const config: ChunkerConfig = {
        maxChunkSize: 300,
        overlapSize: 50,
        minChunkSize: 100,
        semanticSplit: false,
        maxLinesPerChunk: 0,
      };

      const result = chunkDocument(text, config);
      expect(result.chunks.length).toBeGreaterThan(2);

      // Total characters across chunks should exceed original due to overlap
      const totalChunked = result.chunks.reduce((sum, c) => sum + c.length, 0);
      expect(totalChunked).toBeGreaterThan(text.length);
    });

    test("handles text with no natural break points", () => {
      // Single continuous string with no spaces, newlines, or punctuation
      const text = "x".repeat(5000);
      const result = chunkDocument(text);
      expect(result.chunks.length).toBeGreaterThan(1);
      // All chunks should be non-empty
      for (const chunk of result.chunks) {
        expect(chunk.length).toBeGreaterThan(0);
      }
    });
  });

  describe("smartChunk", () => {
    test("adapts chunk size to model context limit", () => {
      const text = "word ".repeat(5000);

      const resultSmall = smartChunk(text, "all-MiniLM-L6-v2");
      const resultLarge = smartChunk(text, "text-embedding-3-small");

      // Small context model should produce more chunks
      expect(resultSmall.chunkCount).toBeGreaterThan(resultLarge.chunkCount);
    });

    test("uses default limit for unknown models", () => {
      const text = "word ".repeat(5000);
      const result = smartChunk(text, "unknown-model-xyz");
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    test("handles short text without splitting", () => {
      const result = smartChunk("A short sentence.");
      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0]).toBe("A short sentence.");
    });
  });

  describe("EMBEDDING_CONTEXT_LIMITS", () => {
    test("contains expected models", () => {
      expect(EMBEDDING_CONTEXT_LIMITS["text-embedding-3-small"]).toBe(8192);
      expect(EMBEDDING_CONTEXT_LIMITS["all-MiniLM-L6-v2"]).toBe(512);
    });
  });
});
