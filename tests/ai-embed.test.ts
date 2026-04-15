import { describe, it, expect, vi } from "vitest";

const mockEmbedContent = vi.fn();

vi.mock("@google/generative-ai", () => {
  function MockGoogleGenerativeAI() {}
  MockGoogleGenerativeAI.prototype.getGenerativeModel = vi.fn().mockReturnValue({
    embedContent: mockEmbedContent,
  });
  return { GoogleGenerativeAI: MockGoogleGenerativeAI };
});

const { generateEmbedding, generateEmbeddings } = await import("../scripts/ai-embed.mts");

describe("ai-embed.mts", () => {
  describe("generateEmbedding", () => {
    it("returns embedding values from Gemini API", async () => {
      const fakeEmbedding = Array.from({ length: 768 }, (_, i) => i * 0.001);
      mockEmbedContent.mockResolvedValueOnce({
        embedding: { values: fakeEmbedding },
      });

      const result = await generateEmbedding("test text");
      expect(result).toHaveLength(768);
      expect(result[0]).toBe(0);
      expect(result[1]).toBeCloseTo(0.001);
    });

    it("passes correct parameters to embedContent", async () => {
      mockEmbedContent.mockResolvedValueOnce({
        embedding: { values: [0.1, 0.2] },
      });

      await generateEmbedding("hello world");
      expect(mockEmbedContent).toHaveBeenCalledWith({
        content: { role: "user", parts: [{ text: "hello world" }] },
        outputDimensionality: 768,
      });
    });
  });

  describe("generateEmbeddings", () => {
    it("generates embeddings for multiple texts sequentially", async () => {
      mockEmbedContent
        .mockResolvedValueOnce({ embedding: { values: [0.1] } })
        .mockResolvedValueOnce({ embedding: { values: [0.2] } })
        .mockResolvedValueOnce({ embedding: { values: [0.3] } });

      const results = await generateEmbeddings(["a", "b", "c"]);
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual([0.1]);
      expect(results[1]).toEqual([0.2]);
      expect(results[2]).toEqual([0.3]);
    });

    it("returns empty array for empty input", async () => {
      const results = await generateEmbeddings([]);
      expect(results).toEqual([]);
    });
  });
});
