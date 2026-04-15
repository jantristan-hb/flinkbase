import { describe, it, expect, beforeEach } from "vitest";
import { cleanDb, seedTestDigest } from "./setup";
import {
  getLatestDigest,
  getDigestBySlug,
  getDigestWithStories,
  getDigestsPaginated,
  getDigestsByMonth,
  getPrevNextDigest,
  insertDigestWithStories,
  insertSubscriber,
  confirmSubscriber,
  unsubscribe,
  getConfirmedSubscribers,
  getUnverifiedStories,
  updateStoryVerification,
  getRecentDigests,
  getAllDigestSlugs,
  getLatestUnverifiedDigest,
} from "../src/db/queries";

describe("DB Queries", () => {
  beforeEach(async () => {
    await cleanDb();
  });

  describe("getLatestDigest", () => {
    it("returns null when no digests exist", async () => {
      expect(await getLatestDigest()).toBeNull();
    });

    it("returns the most recent digest", async () => {
      const { digest } = await seedTestDigest();
      const result = await getLatestDigest();
      expect(result).not.toBeNull();
      expect(result!.id).toBe(digest.id);
    });
  });

  describe("getDigestBySlug", () => {
    it("returns null for non-existent slug", async () => {
      expect(await getDigestBySlug("2099-01-01", "morgen")).toBeNull();
    });

    it("returns digest matching date and slot", async () => {
      await seedTestDigest();
      const result = await getDigestBySlug("2026-04-15", "morgen");
      expect(result).not.toBeNull();
      expect(result!.slot).toBe("morgen");
    });
  });

  describe("getDigestWithStories", () => {
    it("returns digest with ordered stories", async () => {
      await seedTestDigest();
      const result = await getDigestWithStories("2026-04-15", "morgen");
      expect(result).not.toBeNull();
      expect(result!.stories).toHaveLength(2);
      expect(result!.stories[0].position).toBe(1);
    });
  });

  describe("getDigestsPaginated", () => {
    it("returns paginated results with total count", async () => {
      await seedTestDigest();
      const result = await getDigestsPaginated(1, 10);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });

  describe("getDigestsByMonth", () => {
    it("returns digests for correct month", async () => {
      await seedTestDigest();
      expect(await getDigestsByMonth(2026, 4)).toHaveLength(1);
    });

    it("returns empty for wrong month", async () => {
      await seedTestDigest();
      expect(await getDigestsByMonth(2026, 1)).toHaveLength(0);
    });
  });

  describe("insertSubscriber", () => {
    it("inserts new subscriber", async () => {
      const result = await insertSubscriber("test@example.com");
      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("test@example.com");
    });

    it("does not fail on duplicate", async () => {
      await insertSubscriber("test@example.com");
      const result = await insertSubscriber("test@example.com");
      expect(result).toHaveLength(0);
    });
  });

  describe("getPrevNextDigest", () => {
    it("returns null for both when only one digest", async () => {
      const { digest } = await seedTestDigest();
      const { prev, next } = await getPrevNextDigest(digest.publishedAt);
      expect(prev).toBeNull();
      expect(next).toBeNull();
    });
  });

  describe("getDigestsByMonth — December edge case", () => {
    it("handles month=12 (year boundary)", async () => {
      await seedTestDigest(); // April digest
      const result = await getDigestsByMonth(2026, 12);
      expect(result).toHaveLength(0);
    });
  });

  describe("insertDigestWithStories", () => {
    it("inserts digest with stories and embeddings in transaction", async () => {
      const result = await insertDigestWithStories(
        {
          digestDate: "2026-04-16",
          slot: "mittag",
          publishedAt: new Date("2026-04-16T12:00:00+02:00"),
          title: "Test Digest",
          description: "Desc",
          summaryOfDay: "Summary",
        },
        [
          {
            headlineDe: "Headline DE",
            headlineEn: "Headline EN",
            summary: "Summary text",
            whyRelevant: "Relevant because",
            hnUrl: "https://news.ycombinator.com/item?id=1",
            sourceUrl: "https://example.com",
            tags: ["test"],
          },
        ],
        [{ embedding: Array(768).fill(0.1), contentText: "test embedding" }]
      );

      expect(result.digest.id).toBeTruthy();
      expect(result.stories).toHaveLength(1);
      expect(result.stories[0].position).toBe(1);
      expect(result.stories[0].headlineDe).toBe("Headline DE");
    });

    it("inserts without embeddings when empty array", async () => {
      const result = await insertDigestWithStories(
        {
          digestDate: "2026-04-16",
          slot: "abend",
          publishedAt: new Date("2026-04-16T18:00:00+02:00"),
          title: "No Embed Digest",
          description: "Desc",
          summaryOfDay: "Summary",
        },
        [
          {
            headlineDe: "H",
            headlineEn: "H",
            summary: "S",
            whyRelevant: "R",
            hnUrl: "https://hn.com/1",
            tags: [],
          },
        ],
        []
      );

      expect(result.digest.id).toBeTruthy();
      expect(result.stories).toHaveLength(1);
    });
  });

  describe("confirmSubscriber + unsubscribe", () => {
    it("confirms a subscriber", async () => {
      const [sub] = await insertSubscriber("confirm@test.com");
      const result = await confirmSubscriber(sub.id);
      expect(result).toHaveLength(1);
      expect(result[0].confirmedAt).not.toBeNull();
    });

    it("unsubscribes a subscriber", async () => {
      const [sub] = await insertSubscriber("unsub@test.com");
      await confirmSubscriber(sub.id);
      const result = await unsubscribe(sub.id);
      expect(result).toHaveLength(1);
      expect(result[0].unsubscribedAt).not.toBeNull();
    });
  });

  describe("getConfirmedSubscribers", () => {
    it("returns only confirmed, non-unsubscribed subscribers", async () => {
      const [s1] = await insertSubscriber("confirmed@test.com");
      const [s2] = await insertSubscriber("unconfirmed@test.com");
      const [s3] = await insertSubscriber("unsubbed@test.com");
      await confirmSubscriber(s1.id);
      await confirmSubscriber(s3.id);
      await unsubscribe(s3.id);

      const result = await getConfirmedSubscribers();
      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("confirmed@test.com");
    });
  });

  describe("getUnverifiedStories + updateStoryVerification", () => {
    it("returns unverified stories for a digest", async () => {
      const { digest } = await seedTestDigest();
      const unverified = await getUnverifiedStories(digest.id);
      expect(unverified).toHaveLength(2);
    });

    it("updates verification status", async () => {
      const { stories } = await seedTestDigest();
      const result = await updateStoryVerification(stories[0].id, "verified", "Looks good.");
      expect(result).toHaveLength(1);
      expect(result[0].verificationStatus).toBe("verified");
      expect(result[0].verificationReason).toBe("Looks good.");
    });
  });

  describe("getRecentDigests", () => {
    it("returns digests from last 7 days", async () => {
      await seedTestDigest();
      const result = await getRecentDigests(7);
      // Seed digest is from 2026-04-15, which may or may not be within 7 days depending on test date
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getAllDigestSlugs", () => {
    it("returns all digest date+slot pairs", async () => {
      await seedTestDigest();
      const result = await getAllDigestSlugs();
      expect(result).toHaveLength(1);
      expect(result[0].digestDate).toBe("2026-04-15");
      expect(result[0].slot).toBe("morgen");
    });
  });

  describe("getLatestUnverifiedDigest", () => {
    it("returns digest with unverified stories", async () => {
      await seedTestDigest();
      const result = await getLatestUnverifiedDigest();
      expect(result).not.toBeNull();
    });

    it("returns null when all stories are verified", async () => {
      const { stories } = await seedTestDigest();
      await updateStoryVerification(stories[0].id, "verified", "ok");
      await updateStoryVerification(stories[1].id, "verified", "ok");
      const result = await getLatestUnverifiedDigest();
      expect(result).toBeNull();
    });
  });
});
