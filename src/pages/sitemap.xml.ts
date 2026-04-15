import type { APIRoute } from "astro";
import { getAllDigestSlugs } from "@/db/queries";
import { digestSlug } from "@/lib/date";

export const GET: APIRoute = async () => {
  const slugs = await getAllDigestSlugs();
  const staticPages = [
    { loc: "/", priority: "1.0", changefreq: "hourly" },
    { loc: "/archiv", priority: "0.8", changefreq: "hourly" },
    { loc: "/suche", priority: "0.6", changefreq: "weekly" },
    { loc: "/ueber", priority: "0.4", changefreq: "monthly" },
    { loc: "/impressum", priority: "0.2", changefreq: "yearly" },
    { loc: "/datenschutz", priority: "0.2", changefreq: "yearly" },
  ];
  const digestPages = slugs.map((s) => ({ loc: `/digest/${digestSlug(s.digestDate, s.slot)}`, priority: "0.9", changefreq: "never" }));
  const months = new Set<string>();
  for (const s of slugs) { const [year, month] = s.digestDate.split("-"); months.add(`/archiv/${year}/${month}`); }
  const archivePages = Array.from(months).map((loc) => ({ loc, priority: "0.5", changefreq: "daily" }));
  const allPages = [...staticPages, ...digestPages, ...archivePages];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map((p) => `  <url><loc>https://flinkbase.com${p.loc}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`).join("\n")}
</urlset>`;
  return new Response(sitemap, { headers: { "Content-Type": "application/xml" } });
};
