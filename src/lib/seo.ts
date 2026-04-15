import type { Digest } from "@/db/schema";
import { strings } from "./strings";

export interface SEOProps {
  title: string;
  description: string;
  canonical: string;
  ogType?: string;
  ogImage?: string;
  publishedAt?: string;
  noindex?: boolean;
}

export function digestSEO(digest: Digest): SEOProps {
  return {
    title: `${digest.title} | ${strings.siteName}`,
    description: digest.description,
    canonical: `https://flinkbase.com/digest/${digest.digestDate}-${digest.slot}`,
    ogType: "article",
    ogImage: "https://flinkbase.com/og-default.png",
    publishedAt: digest.publishedAt.toISOString(),
  };
}

export function pageSEO(title: string, description: string, path: string): SEOProps {
  return {
    title: `${title} | ${strings.siteName}`,
    description,
    canonical: `https://flinkbase.com${path}`,
    ogImage: "https://flinkbase.com/og-default.png",
  };
}

export function newsArticleJsonLd(digest: Digest) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: digest.title,
    datePublished: digest.publishedAt.toISOString(),
    dateModified: digest.publishedAt.toISOString(),
    author: { "@type": "Organization", name: "flinkbase" },
    publisher: { "@type": "Organization", name: "flinkbase", url: "https://flinkbase.com" },
    description: digest.description,
    mainEntityOfPage: `https://flinkbase.com/digest/${digest.digestDate}-${digest.slot}`,
  };
}

export function webSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "flinkbase",
    url: "https://flinkbase.com",
    description: strings.siteDescription,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: "https://flinkbase.com/suche?q={search_term_string}" },
      "query-input": "required name=search_term_string",
    },
  };
}
