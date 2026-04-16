import "dotenv/config";
import { fetchTopStories } from "./hn-client.mts";
import { filterForAIRelevance } from "./ai-filter.mts";
import { summarizeStory, summarizeDaySummary } from "./ai-summarize.mts";
import { generateEmbeddings } from "./ai-embed.mts";
import { insertDigestWithStories, getConfirmedSubscribers, getStoriesForDigest, getRecentHnUrls, hasEmbeddingForHnUrl } from "../src/db/queries";
import { sendDigestToAll } from "../src/lib/mail";
import { runVerification } from "./ai-verify.mts";

type Slot = "morgen" | "mittag" | "abend";

const SLOT_HOURS: Record<Slot, number> = { morgen: 9, mittag: 12, abend: 18 };

function getSlotFromArgs(): Slot {
  const arg = process.argv[2];
  if (arg && ["morgen", "mittag", "abend"].includes(arg)) return arg as Slot;
  const hour = new Date().getHours();
  if (hour < 11) return "morgen";
  if (hour < 16) return "mittag";
  return "abend";
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

async function main() {
  const slot = getSlotFromArgs();
  const now = new Date();
  const dateStr = formatDate(now);

  console.log(`[flinkbase] Generating ${slot} digest for ${dateStr}...`);

  // 1. Fetch HN stories
  console.log("[1/6] Fetching top 60 HN stories...");
  const hnStories = await fetchTopStories(60);
  console.log(`  → ${hnStories.length} stories fetched`);

  // 2. Filter for AI relevance
  console.log("[2/6] Filtering for AI relevance...");
  const filtered = await filterForAIRelevance(hnStories);
  console.log(`  → ${filtered.length} AI-relevant stories found`);

  // 2b. Dedup: remove stories already in recent digests (24h)
  const recentUrls = await getRecentHnUrls(24);
  const deduped = filtered.filter((f) => !recentUrls.has(f.story.hnUrl));
  const skipped = filtered.length - deduped.length;
  if (skipped > 0) console.log(`  → ${skipped} duplicates from last 24h removed`);

  if (deduped.length === 0) {
    console.log("  ⚠ No new AI-relevant stories found. Skipping digest.");
    process.exit(0);
  }

  // 3. Take top 7
  const top7 = deduped.slice(0, 7);
  console.log(`  → Top ${top7.length} selected`);

  // 4. Summarize each story
  console.log("[3/6] Summarizing stories...");
  const summaries = [];
  for (const { story } of top7) {
    const summary = await summarizeStory(story);
    summaries.push({ story, summary });
    console.log(`  → "${summary.headline_de}"`);
  }

  // 5. Generate day summary
  console.log("[4/6] Generating day summary...");
  const daySummary = await summarizeDaySummary(summaries.map((s) => s.summary));
  console.log(`  → "${daySummary.slice(0, 80)}..."`);

  // 6. Build title + description
  const titleHeadlines = summaries.slice(0, 2).map((s) => s.summary.headline_de).join(", ");
  const title = `${titleHeadlines} — AI Digest ${new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}`;
  const description = summaries.slice(0, 3).map((s) => s.summary.headline_de).join(". ").slice(0, 152) + "...";

  // 7. Persist (without embeddings — those come after verification)
  console.log("[5/8] Persisting to database...");
  const publishedAt = new Date(now);
  publishedAt.setHours(SLOT_HOURS[slot], 0, 0, 0);

  const result = await insertDigestWithStories(
    { digestDate: dateStr, slot, publishedAt, title, description, summaryOfDay: daySummary },
    summaries.map((s) => ({
      headlineDe: s.summary.headline_de,
      headlineEn: s.story.title,
      summary: s.summary.summary,
      whyRelevant: s.summary.why_relevant,
      hnUrl: s.story.hnUrl,
      sourceUrl: s.story.url,
      tags: s.summary.tags,
    })),
    [] // No embeddings yet — generated after verification
  );

  console.log(`\n✓ Digest "${result.digest.title}" created with ${result.stories.length} stories.`);
  console.log(`  ID: ${result.digest.id}`);
  console.log(`  URL: /digest/${dateStr}-${slot}`);

  // 8. Cross-model verification + correction (Claude Sonnet ↔ Gemini Flash)
  console.log(`\n[6/8] Cross-model verification (Claude Sonnet)...`);
  const { verified, rejected } = await runVerification(result.digest.id);
  console.log(`  → ${verified} verified, ${rejected} rejected`);

  // 9. Generate embeddings for verified stories (skip if HN URL already has embedding)
  const verifiedStories = await getStoriesForDigest(result.digest.id);
  const newStories = [];
  for (const s of verifiedStories) {
    if (!(await hasEmbeddingForHnUrl(s.hnUrl))) {
      newStories.push(s);
    }
  }
  const dupeEmbeddings = verifiedStories.length - newStories.length;
  console.log(`\n[7/8] Generating embeddings for ${newStories.length} new stories (${dupeEmbeddings} already in RAG)...`);
  if (newStories.length > 0) {
    const embeddingTexts = newStories.map((s) => `${s.headlineDe} ${s.summary}`);
    const embeddings = await generateEmbeddings(embeddingTexts);
    const { storyEmbeddings } = await import("../src/db/schema");
    const { db: database } = await import("../src/db/client");
    await database.insert(storyEmbeddings).values(
      newStories.map((s, i) => ({
        storyId: s.id,
        embedding: embeddings[i],
        contentText: embeddingTexts[i],
      }))
    );
    console.log(`  → ${embeddings.length} embeddings generated`);
  }

  // 10. Send newsletter only for abend digest (only verified stories)
  if (slot === "abend") {
    const subs = await getConfirmedSubscribers();
    if (subs.length > 0) {
      console.log(`\n[8/8] Sending newsletter to ${subs.length} subscribers (${verifiedStories.length} verified stories)...`);
      const { sent, failed } = await sendDigestToAll(subs, result.digest, verifiedStories);
      console.log(`  → ${sent} sent, ${failed} failed`);
    } else {
      console.log("\n[8/8] No confirmed subscribers — skipping newsletter.");
    }
  } else {
    console.log("\n[8/8] Newsletter only sent with abend digest — skipping.");
  }
}

main().catch((err) => { console.error("[flinkbase] FATAL:", err); process.exit(1); });
