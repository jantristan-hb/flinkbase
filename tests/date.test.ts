import { describe, it, expect } from "vitest";
import {
  formatDateLong,
  formatDateShort,
  formatMonthYear,
  digestSlug,
  parseDigestSlug,
  isOlderThanDays,
} from "../src/lib/date";

describe("date.ts", () => {
  describe("formatDateLong", () => {
    it("formats a Date object to German long format", () => {
      const date = new Date("2026-04-15T12:00:00Z");
      const result = formatDateLong(date);
      expect(result).toContain("April");
      expect(result).toContain("2026");
    });

    it("formats a string date to German long format", () => {
      const result = formatDateLong("2026-01-01");
      expect(result).toContain("Januar");
      expect(result).toContain("2026");
    });
  });

  describe("formatDateShort", () => {
    it("formats a Date object to short DD.MM.YYYY format", () => {
      const date = new Date("2026-04-15T12:00:00Z");
      const result = formatDateShort(date);
      expect(result).toMatch(/15\.04\.2026/);
    });

    it("formats a string date to short format", () => {
      const result = formatDateShort("2026-12-25");
      expect(result).toMatch(/25\.12\.2026/);
    });
  });

  describe("formatMonthYear", () => {
    it("formats month and year to German", () => {
      expect(formatMonthYear(2026, 4)).toContain("April");
      expect(formatMonthYear(2026, 4)).toContain("2026");
    });

    it("handles January (month=1)", () => {
      expect(formatMonthYear(2026, 1)).toContain("Januar");
    });

    it("handles December (month=12)", () => {
      expect(formatMonthYear(2026, 12)).toContain("Dezember");
    });
  });

  describe("digestSlug", () => {
    it("combines date and slot into slug", () => {
      expect(digestSlug("2026-04-15", "morgen")).toBe("2026-04-15-morgen");
      expect(digestSlug("2026-04-15", "abend")).toBe("2026-04-15-abend");
    });
  });

  describe("parseDigestSlug", () => {
    it("parses valid morgen slug", () => {
      const result = parseDigestSlug("2026-04-15-morgen");
      expect(result).toEqual({ date: "2026-04-15", slot: "morgen" });
    });

    it("parses valid mittag slug", () => {
      const result = parseDigestSlug("2026-04-15-mittag");
      expect(result).toEqual({ date: "2026-04-15", slot: "mittag" });
    });

    it("parses valid abend slug", () => {
      const result = parseDigestSlug("2026-04-15-abend");
      expect(result).toEqual({ date: "2026-04-15", slot: "abend" });
    });

    it("returns null for invalid slot", () => {
      expect(parseDigestSlug("2026-04-15-nacht")).toBeNull();
    });

    it("returns null for invalid date format", () => {
      expect(parseDigestSlug("15-04-2026-morgen")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseDigestSlug("")).toBeNull();
    });

    it("returns null for random string", () => {
      expect(parseDigestSlug("hello-world")).toBeNull();
    });
  });

  describe("isOlderThanDays", () => {
    it("returns true for date older than threshold", () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      expect(isOlderThanDays(oldDate, 7)).toBe(true);
    });

    it("returns false for recent date", () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3);
      expect(isOlderThanDays(recentDate, 7)).toBe(false);
    });

    it("accepts string dates", () => {
      const oldDateStr = "2020-01-01";
      expect(isOlderThanDays(oldDateStr, 7)).toBe(true);
    });

    it("returns false for today", () => {
      expect(isOlderThanDays(new Date(), 7)).toBe(false);
    });
  });
});
