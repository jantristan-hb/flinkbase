import { describe, it, expect, vi } from "vitest";

vi.mock("@google/generative-ai", () => {
  const mockGenerateContent = vi.fn().mockResolvedValue({
    response: {
      text: () => JSON.stringify([
        { id: 1, relevant: true, confidence: 0.95 },
        { id: 2, relevant: false, confidence: 0.3 },
        { id: 3, relevant: true, confidence: 0.6 },
      ]),
    },
  });
  const mockGetGenerativeModel = vi.fn().mockReturnValue({ generateContent: mockGenerateContent });
  function MockGoogleGenerativeAI() {
    return { getGenerativeModel: mockGetGenerativeModel };
  }
  return { GoogleGenerativeAI: MockGoogleGenerativeAI };
});

const { filterForAIRelevance } = await import("../scripts/ai-filter.mts");

describe("AI Filter", () => {
  it("filters stories by AI relevance with confidence threshold", async () => {
    const stories = [
      { id: 1, title: "OpenAI releases GPT-5", url: "https://openai.com", score: 500, descendants: 200, hnUrl: "" },
      { id: 2, title: "Best coffee shops in SF", url: "https://coffee.com", score: 100, descendants: 50, hnUrl: "" },
      { id: 3, title: "New ML framework", url: "https://ml.com", score: 200, descendants: 80, hnUrl: "" },
    ];
    const result = await filterForAIRelevance(stories);
    expect(result).toHaveLength(1);
    expect(result[0].story.id).toBe(1);
    expect(result[0].confidence).toBe(0.95);
  });
});
