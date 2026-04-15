import { describe, it, expect, vi } from "vitest";

vi.mock("@google/generative-ai", () => {
  const mockGenerateContent = vi.fn().mockResolvedValue({
    response: {
      text: () => JSON.stringify({
        headline_de: "OpenAI stellt GPT-5 vor",
        summary: "OpenAI hat GPT-5 vorgestellt — das bisher größte Modell.",
        why_relevant: "Neues Frontier-Modell verschiebt die Baseline.",
        tags: ["openai", "llm"],
      }),
    },
  });
  const mockGetGenerativeModel = vi.fn().mockReturnValue({ generateContent: mockGenerateContent });
  function MockGoogleGenerativeAI() {
    return { getGenerativeModel: mockGetGenerativeModel };
  }
  return { GoogleGenerativeAI: MockGoogleGenerativeAI };
});

const { summarizeStory } = await import("../scripts/ai-summarize.mts");

describe("AI Summarize", () => {
  it("returns structured German summary", async () => {
    const story = { id: 1, title: "OpenAI releases GPT-5", url: "https://openai.com/gpt5", score: 500, descendants: 200, hnUrl: "https://news.ycombinator.com/item?id=1" };
    const result = await summarizeStory(story);
    expect(result.headline_de).toBe("OpenAI stellt GPT-5 vor");
    expect(result.summary).toBeTruthy();
    expect(result.tags).toBeInstanceOf(Array);
    expect(result.tags.length).toBeGreaterThan(0);
  });
});
