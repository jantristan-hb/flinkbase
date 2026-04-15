import { describe, it, expect, vi } from "vitest";

const mockEmbedContent = vi.fn();

vi.mock("@google/generative-ai", () => {
  function MockGoogleGenerativeAI() {}
  MockGoogleGenerativeAI.prototype.getGenerativeModel = vi.fn().mockReturnValue({
    embedContent: mockEmbedContent,
  });
  return { GoogleGenerativeAI: MockGoogleGenerativeAI };
});

const { generateEmbedding } = await import("../src/lib/embedding");

describe("src/lib/embedding.ts", () => {
  it("returns 768-dimensional embedding", async () => {
    const fakeEmb = Array.from({ length: 768 }, (_, i) => i * 0.001);
    mockEmbedContent.mockResolvedValueOnce({ embedding: { values: fakeEmb } });

    const result = await generateEmbedding("test");
    expect(result).toHaveLength(768);
  });

  it("passes outputDimensionality 768 to Gemini", async () => {
    mockEmbedContent.mockResolvedValueOnce({ embedding: { values: [0.1] } });

    await generateEmbedding("hello");
    expect(mockEmbedContent).toHaveBeenCalledWith({
      content: { role: "user", parts: [{ text: "hello" }] },
      outputDimensionality: 768,
    });
  });
});
