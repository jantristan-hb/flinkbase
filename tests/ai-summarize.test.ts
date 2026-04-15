import { describe, it, expect, vi } from "vitest";

const mockGenerateContent = vi.fn();

vi.mock("@google/generative-ai", () => {
  function MockGoogleGenerativeAI() {}
  MockGoogleGenerativeAI.prototype.getGenerativeModel = vi.fn().mockReturnValue({
    generateContent: mockGenerateContent,
  });
  return { GoogleGenerativeAI: MockGoogleGenerativeAI };
});

const { summarizeStory, correctStory, summarizeDaySummary } = await import(
  "../scripts/ai-summarize.mts"
);

describe("ai-summarize.mts", () => {
  describe("summarizeStory", () => {
    it("returns structured German summary from Gemini response", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () =>
            JSON.stringify({
              headline_de: "OpenAI stellt GPT-5 vor",
              summary: "OpenAI hat GPT-5 vorgestellt.",
              why_relevant: "Neues Frontier-Modell.",
              tags: ["openai", "llm"],
            }),
        },
      });

      const result = await summarizeStory({
        id: 1,
        title: "OpenAI releases GPT-5",
        url: "https://openai.com",
        score: 500,
        descendants: 200,
        hnUrl: "https://news.ycombinator.com/item?id=1",
      });

      expect(result.headline_de).toBe("OpenAI stellt GPT-5 vor");
      expect(result.summary).toBeTruthy();
      expect(result.tags).toContain("openai");
    });

    it("handles JSON wrapped in markdown code block", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () =>
            '```json\n{"headline_de":"Test","summary":"Test.","why_relevant":"Test.","tags":["test"]}\n```',
        },
      });

      const result = await summarizeStory({
        id: 2, title: "Test", url: null, score: 10, descendants: 0, hnUrl: "",
      });

      expect(result.headline_de).toBe("Test");
    });
  });

  describe("correctStory", () => {
    it("returns corrected summary based on rejection reason", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () =>
            JSON.stringify({
              headline_de: "Korrigierte Headline",
              summary: "Korrigierte Summary.",
              why_relevant: "Korrigierter Grund.",
              tags: ["fixed"],
            }),
        },
      });

      const result = await correctStory(
        { title: "Original Title", url: "https://example.com", score: 100, descendants: 50 },
        { headline_de: "Falsch", summary: "Falsch.", why_relevant: "Falsch.", tags: ["wrong"] },
        "Die Headline hat nichts mit der Quelle zu tun.",
        "Actual source content."
      );

      expect(result.headline_de).toBe("Korrigierte Headline");
      expect(result.tags).toContain("fixed");
    });

    it("handles null source content", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () =>
            JSON.stringify({ headline_de: "Ok", summary: "Ok.", why_relevant: "Ok.", tags: ["ok"] }),
        },
      });

      const result = await correctStory(
        { title: "Title", url: null, score: 10, descendants: 0 },
        { headline_de: "Alt", summary: "Alt.", why_relevant: "Alt.", tags: [] },
        "Reason",
        null
      );

      expect(result.headline_de).toBe("Ok");
    });
  });

  describe("summarizeDaySummary", () => {
    it("returns trimmed plain text day summary", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: { text: () => "  Der rote Faden heute: AI everywhere.  " },
      });

      const result = await summarizeDaySummary([
        { headline_de: "Story 1", summary: "s", why_relevant: "r", tags: [] },
      ]);

      expect(result).toBe("Der rote Faden heute: AI everywhere.");
    });
  });
});
