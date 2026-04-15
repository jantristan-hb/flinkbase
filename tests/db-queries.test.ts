import { describe, it, expect, beforeEach } from "vitest";
import { cleanDb, seedTestDigest } from "./setup";
import {
  getLatestDigest,
  getDigestBySlug,
  getDigestWithStories,
  getDigestsPaginated,
  getDigestsByMonth,
  insertSubscriber,
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
});
