import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async ({ url }, next) => {
  const response = await next();
  const path = url.pathname;
  if (path.startsWith("/api/")) return response;
  if (path === "/suche") return response;
  if (path.startsWith("/digest/")) { response.headers.set("Cache-Control", "public, max-age=3600"); return response; }
  if (path.match(/^\/archiv\/\d{4}\/\d{2}/)) { response.headers.set("Cache-Control", "public, max-age=3600"); return response; }
  if (path === "/rss.xml") { response.headers.set("Cache-Control", "public, max-age=900"); return response; }
  if (path === "/sitemap.xml") { response.headers.set("Cache-Control", "public, max-age=3600"); return response; }
  response.headers.set("Cache-Control", "public, max-age=300");
  return response;
});
