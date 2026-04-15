import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch for fetchSourceContent
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock Anthropic
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  function MockAnthropic() {}
  MockAnthropic.prototype.messages = { create: mockCreate };
  return { default: MockAnthropic };
});

// Mock DB queries
const mockGetUnverified = vi.fn();
const mockUpdateVerification = vi.fn();
vi.mock("../src/db/queries", () => ({
  getUnverifiedStories: (...args: any[]) => mockGetUnverified(...args),
  updateStoryVerification: (...args: any[]) => mockUpdateVerification(...args),
}));

// Mock correctStory
const mockCorrectStory = vi.fn();
vi.mock("../scripts/ai-summarize.mts", () => ({
  correctStory: (...args: any[]) => mockCorrectStory(...args),
}));

// Mock DB update — use a factory that always returns a fresh chain
vi.mock("../src/db/client", () => ({
  db: {
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  },
}));
vi.mock("../src/db/schema", () => ({
  stories: "stories-table",
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

const { fetchSourceContent, runVerification } = await import("../scripts/ai-verify.mts");

function makeStory(overrides = {}) {
  return {
    id: "story-1",
    digestId: "digest-1",
    position: 1,
    headlineDe: "Test Headline DE",
    headlineEn: "Test Headline EN",
    summary: "Test summary.",
    whyRelevant: "Test reason.",
    hnUrl: "https://news.ycombinator.com/item?id=1",
    sourceUrl: "https://example.com/article",
    tags: ["ai"],
    verificationStatus: "unverified",
    verificationReason: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function sonnetResponse(status: string, reason: string) {
  return {
    content: [{ type: "text", text: JSON.stringify({ status, reason }) }],
  };
}

describe("ai-verify.mts", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockCreate.mockReset();
    mockGetUnverified.mockReset();
    mockUpdateVerification.mockReset();
    mockCorrectStory.mockReset();
  });

  describe("fetchSourceContent", () => {
    it("returns stripped text content on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("<html><body><p>Hello World</p></body></html>"),
      });

      const result = await fetchSourceContent("https://example.com");
      expect(result).toContain("Hello World");
      expect(result).not.toContain("<p>");
    });

    it("strips script and style tags", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            '<html><script>var x=1;</script><style>.a{}</style><body>Content</body></html>'
          ),
      });

      const result = await fetchSourceContent("https://example.com");
      expect(result).toContain("Content");
      expect(result).not.toContain("var x");
      expect(result).not.toContain(".a{}");
    });

    it("returns null on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });
      const result = await fetchSourceContent("https://example.com");
      expect(result).toBeNull();
    });

    it("returns null on fetch error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const result = await fetchSourceContent("https://example.com");
      expect(result).toBeNull();
    });

    it("truncates content to 3000 chars", async () => {
      const longContent = "<p>" + "a".repeat(5000) + "</p>";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(longContent),
      });

      const result = await fetchSourceContent("https://example.com");
      expect(result!.length).toBeLessThanOrEqual(3000);
    });
  });

  describe("runVerification", () => {
    it("returns zeros when no unverified stories", async () => {
      mockGetUnverified.mockResolvedValueOnce([]);
      const result = await runVerification("digest-1");
      expect(result).toEqual({ verified: 0, rejected: 0 });
    });

    it("marks story as verified when Sonnet approves", async () => {
      const story = makeStory();
      mockGetUnverified.mockResolvedValueOnce([story]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("<p>Real article about AI</p>"),
      });
      mockCreate.mockResolvedValueOnce(sonnetResponse("verified", "Headline matches source."));
      mockUpdateVerification.mockResolvedValueOnce([story]);

      const result = await runVerification("digest-1");
      expect(result).toEqual({ verified: 1, rejected: 0 });
      expect(mockUpdateVerification).toHaveBeenCalledWith("story-1", "verified", "Headline matches source.");
    });

    it("corrects and re-verifies rejected stories", async () => {
      const story = makeStory();
      mockGetUnverified.mockResolvedValueOnce([story]);

      // Fetch source
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("<p>Article content</p>"),
      });

      // Round 0: rejected
      mockCreate.mockResolvedValueOnce(sonnetResponse("rejected", "Hallucination detected."));

      // Gemini corrects
      mockCorrectStory.mockResolvedValueOnce({
        headline_de: "Corrected Headline",
        summary: "Corrected summary.",
        why_relevant: "Corrected reason.",
        tags: ["fixed"],
      });

      // Round 1: verified
      mockCreate.mockResolvedValueOnce(sonnetResponse("verified", "Now correct."));
      mockUpdateVerification.mockResolvedValueOnce([story]);

      const result = await runVerification("digest-1");
      expect(result).toEqual({ verified: 1, rejected: 0 });
      expect(mockCorrectStory).toHaveBeenCalledTimes(1);
    });

    it("drops story after max correction rounds", async () => {
      const story = makeStory();
      mockGetUnverified.mockResolvedValueOnce([story]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("<p>Content</p>"),
      });

      // Round 0: rejected
      mockCreate.mockResolvedValueOnce(sonnetResponse("rejected", "Wrong."));
      mockCorrectStory.mockResolvedValueOnce({
        headline_de: "Attempt 1", summary: "s", why_relevant: "r", tags: [],
      });

      // Round 1: rejected again
      mockCreate.mockResolvedValueOnce(sonnetResponse("rejected", "Still wrong."));
      mockCorrectStory.mockResolvedValueOnce({
        headline_de: "Attempt 2", summary: "s", why_relevant: "r", tags: [],
      });

      // Round 2: still rejected → max reached
      mockCreate.mockResolvedValueOnce(sonnetResponse("rejected", "Final rejection."));
      mockUpdateVerification.mockResolvedValueOnce([story]);

      const result = await runVerification("digest-1");
      expect(result).toEqual({ verified: 0, rejected: 1 });
      expect(mockCorrectStory).toHaveBeenCalledTimes(2);
    });

    it("handles story without sourceUrl", async () => {
      const story = makeStory({ sourceUrl: null });
      mockGetUnverified.mockResolvedValueOnce([story]);

      // No fetch call for source
      mockCreate.mockResolvedValueOnce(sonnetResponse("verified", "Title matches."));
      mockUpdateVerification.mockResolvedValueOnce([story]);

      const result = await runVerification("digest-1");
      expect(result).toEqual({ verified: 1, rejected: 0 });
      // fetch should not be called for source (only Anthropic API)
    });

    it("handles Sonnet returning unparseable response", async () => {
      const story = makeStory();
      mockGetUnverified.mockResolvedValueOnce([story]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("<p>Content</p>"),
      });

      // Return garbage from Sonnet
      mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: "I cannot parse this as JSON" }],
      });
      mockUpdateVerification.mockResolvedValueOnce([story]);

      const result = await runVerification("digest-1");
      // Parse error → defaults to verified
      expect(result).toEqual({ verified: 1, rejected: 0 });
    });
  });
});
