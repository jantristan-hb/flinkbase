import "dotenv/config";
import { fetchTopStories } from "./hn-client.mts";
import { filterForAIRelevance } from "./ai-filter.mts";
import { summarizeStory, summarizeDaySummary } from "./ai-summarize.mts";
import { generateEmbeddings } from "./ai-embed.mts";
import { insertDigestWithStories } from "../src/db/queries";

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

  if (filtered.length === 0) {
    console.log("  ⚠ No AI-relevant stories found. Skipping digest.");
    process.exit(0);
  }

  // 3. Take top 7
  const top7 = filtered.slice(0, 7);
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

  // 6. Generate embeddings
  console.log("[5/6] Generating embeddings...");
  const embeddingTexts = summaries.map((s) => `${s.summary.headline_de} ${s.summary.summary}`);
  const embeddings = await generateEmbeddings(embeddingTexts);
  console.log(`  → ${embeddings.length} embeddings generated`);

  // 7. Build title + description
  const titleHeadlines = summaries.slice(0, 2).map((s) => s.summary.headline_de).join(", ");
  const title = `${titleHeadlines} — AI Digest ${new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}`;
  const description = summaries.slice(0, 3).map((s) => s.summary.headline_de).join(". ").slice(0, 152) + "...";

  // 8. Persist
  console.log("[6/6] Persisting to database...");
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
    embeddings.map((emb, i) => ({ embedding: emb, contentText: embeddingTexts[i] }))
  );

  console.log(`\n✓ Digest "${result.digest.title}" created with ${result.stories.length} stories.`);
  console.log(`  ID: ${result.digest.id}`);
  console.log(`  URL: /digest/${dateStr}-${slot}`);
}

main().catch((err) => { console.error("[flinkbase] FATAL:", err); process.exit(1); });
