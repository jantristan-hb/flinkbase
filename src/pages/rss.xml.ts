import type { APIRoute } from "astro";
import { getRecentDigests, getStoriesForDigest } from "@/db/queries";
import { digestSlug } from "@/lib/date";

export const GET: APIRoute = async () => {
  const digests = await getRecentDigests(7);
  const items = await Promise.all(
    digests.map(async (digest) => {
      const stories = await getStoriesForDigest(digest.id);
      const storyList = stories.map((s) => `<li><strong>${s.headlineDe}</strong>: ${s.summary}</li>`).join("");
      return `<item>
      <title><![CDATA[${digest.title}]]></title>
      <link>https://flinkbase.com/digest/${digestSlug(digest.digestDate, digest.slot)}</link>
      <guid>https://flinkbase.com/digest/${digestSlug(digest.digestDate, digest.slot)}</guid>
      <pubDate>${digest.publishedAt.toUTCString()}</pubDate>
      <description><![CDATA[<p>${digest.description}</p><ul>${storyList}</ul><p><em>${digest.summaryOfDay}</em></p>]]></description>
    </item>`;
    })
  );
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>flinkbase — AI News Digest</title>
    <link>https://flinkbase.com</link>
    <description>Deutschsprachiger AI News Digest — 3x täglich</description>
    <language>de</language>
    <atom:link href="https://flinkbase.com/rss.xml" rel="self" type="application/rss+xml"/>
    ${items.join("\n")}
  </channel>
</rss>`;
  return new Response(rss, { headers: { "Content-Type": "application/xml" } });
};
