import { describe, it, expect } from "vitest";
import { digestSEO, pageSEO, newsArticleJsonLd, webSiteJsonLd } from "../src/lib/seo";
import type { Digest } from "../src/db/schema";

const mockDigest: Digest = {
  id: "test-id",
  digestDate: "2026-04-15",
  slot: "morgen",
  publishedAt: new Date("2026-04-15T09:00:00+02:00"),
  title: "Test Digest Title",
  description: "Test description",
  summaryOfDay: "Test summary",
  createdAt: new Date(),
};

describe("seo.ts", () => {
  describe("digestSEO", () => {
    it("generates correct title with siteName", () => {
      const seo = digestSEO(mockDigest);
      expect(seo.title).toBe("Test Digest Title | flinkbase");
    });

    it("generates canonical URL from date and slot", () => {
      const seo = digestSEO(mockDigest);
      expect(seo.canonical).toBe("https://flinkbase.com/digest/2026-04-15-morgen");
    });

    it("sets ogType to article", () => {
      const seo = digestSEO(mockDigest);
      expect(seo.ogType).toBe("article");
    });

    it("includes publishedAt as ISO string", () => {
      const seo = digestSEO(mockDigest);
      expect(seo.publishedAt).toBe(mockDigest.publishedAt.toISOString());
    });

    it("includes description from digest", () => {
      const seo = digestSEO(mockDigest);
      expect(seo.description).toBe("Test description");
    });

    it("includes og:image", () => {
      const seo = digestSEO(mockDigest);
      expect(seo.ogImage).toBe("https://flinkbase.com/og-default.png");
    });
  });

  describe("pageSEO", () => {
    it("generates correct title", () => {
      const seo = pageSEO("Archiv", "Alle Digests", "/archiv");
      expect(seo.title).toBe("Archiv | flinkbase");
    });

    it("generates canonical URL with path", () => {
      const seo = pageSEO("Suche", "Suche", "/suche");
      expect(seo.canonical).toBe("https://flinkbase.com/suche");
    });

    it("does not include publishedAt", () => {
      const seo = pageSEO("Test", "Desc", "/test");
      expect(seo.publishedAt).toBeUndefined();
    });

    it("does not include ogType", () => {
      const seo = pageSEO("Test", "Desc", "/test");
      expect(seo.ogType).toBeUndefined();
    });
  });

  describe("newsArticleJsonLd", () => {
    it("returns NewsArticle schema type", () => {
      const ld = newsArticleJsonLd(mockDigest);
      expect(ld["@type"]).toBe("NewsArticle");
      expect(ld["@context"]).toBe("https://schema.org");
    });

    it("includes headline from digest title", () => {
      const ld = newsArticleJsonLd(mockDigest);
      expect(ld.headline).toBe("Test Digest Title");
    });

    it("includes datePublished and dateModified", () => {
      const ld = newsArticleJsonLd(mockDigest);
      expect(ld.datePublished).toBe(mockDigest.publishedAt.toISOString());
      expect(ld.dateModified).toBe(mockDigest.publishedAt.toISOString());
    });

    it("includes flinkbase as author and publisher", () => {
      const ld = newsArticleJsonLd(mockDigest);
      expect(ld.author.name).toBe("flinkbase");
      expect(ld.publisher.name).toBe("flinkbase");
    });

    it("generates correct mainEntityOfPage URL", () => {
      const ld = newsArticleJsonLd(mockDigest);
      expect(ld.mainEntityOfPage).toBe("https://flinkbase.com/digest/2026-04-15-morgen");
    });
  });

  describe("webSiteJsonLd", () => {
    it("returns WebSite schema type", () => {
      const ld = webSiteJsonLd();
      expect(ld["@type"]).toBe("WebSite");
    });

    it("includes SearchAction with URL template", () => {
      const ld = webSiteJsonLd();
      expect(ld.potentialAction["@type"]).toBe("SearchAction");
      expect(ld.potentialAction.target.urlTemplate).toContain("/suche?q=");
    });

    it("includes site name and URL", () => {
      const ld = webSiteJsonLd();
      expect(ld.name).toBe("flinkbase");
      expect(ld.url).toBe("https://flinkbase.com");
    });
  });
});
