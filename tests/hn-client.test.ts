import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { fetchTopStoryIds, fetchStoryDetails, fetchTopStories } = await import("../scripts/hn-client.mts");

describe("HN Client", () => {
  beforeEach(() => { mockFetch.mockReset(); });

  describe("fetchTopStoryIds", () => {
    it("fetches and slices to requested limit", async () => {
      const ids = Array.from({ length: 500 }, (_, i) => i + 1);
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(ids) });
      const result = await fetchTopStoryIds(60);
      expect(result).toHaveLength(60);
      expect(result[0]).toBe(1);
    });
  });

  describe("fetchStoryDetails", () => {
    it("parses story fields correctly", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 123, title: "Show HN: My AI project", url: "https://example.com/ai", score: 150, descendants: 42, by: "testuser", time: 1713168000 }),
      });
      const result = await fetchStoryDetails(123);
      expect(result.id).toBe(123);
      expect(result.title).toBe("Show HN: My AI project");
      expect(result.url).toBe("https://example.com/ai");
      expect(result.hnUrl).toBe("https://news.ycombinator.com/item?id=123");
    });

    it("handles stories without URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 456, title: "Ask HN: Best AI tools?", score: 80, descendants: 100, by: "testuser", time: 1713168000 }),
      });
      const result = await fetchStoryDetails(456);
      expect(result.url).toBeNull();
    });
  });

  describe("fetchTopStoryIds — error path", () => {
    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(fetchTopStoryIds(10)).rejects.toThrow("HN API error: 500");
    });
  });

  describe("fetchStoryDetails — error path", () => {
    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      await expect(fetchStoryDetails(999)).rejects.toThrow("HN API error for item 999: 404");
    });

    it("defaults score and descendants to 0 when missing", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 789, title: "Minimal story" }),
      });
      const result = await fetchStoryDetails(789);
      expect(result.score).toBe(0);
      expect(result.descendants).toBe(0);
      expect(result.url).toBeNull();
    });
  });

  describe("fetchTopStories", () => {
    it("fetches IDs then details in parallel", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([1, 2, 3]) });
      for (const id of [1, 2, 3]) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id, title: `Story ${id}`, url: `https://example.com/${id}`, score: 100 + id, descendants: 10, by: "user", time: 1713168000 }),
        });
      }
      const result = await fetchTopStories(3);
      expect(result).toHaveLength(3);
    });
  });
});
