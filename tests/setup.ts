import { db } from "../src/db/client";
import { digests, stories, storyEmbeddings, subscribers } from "../src/db/schema";

export async function cleanDb() {
  await db.delete(storyEmbeddings);
  await db.delete(stories);
  await db.delete(digests);
  await db.delete(subscribers);
}

export async function seedTestDigest() {
  const [digest] = await db
    .insert(digests)
    .values({
      digestDate: "2026-04-15",
      slot: "morgen",
      publishedAt: new Date("2026-04-15T09:00:00+02:00"),
      title: "AI Digest — 15. April 2026, Morgen",
      description: "OpenAI stellt GPT-5 vor, EU verschärft AI Act Enforcement",
      summaryOfDay: "Heute dominiert das GPT-5 Release die Schlagzeilen.",
    })
    .returning();

  const testStories = [
    {
      digestId: digest.id,
      position: 1,
      headlineDe: "OpenAI stellt GPT-5 Turbo vor",
      headlineEn: "OpenAI Announces GPT-5 Turbo",
      summary: "OpenAI hat GPT-5 Turbo vorgestellt.",
      whyRelevant: "Neues Frontier-Modell.",
      hnUrl: "https://news.ycombinator.com/item?id=12345",
      sourceUrl: "https://openai.com/blog/gpt-5-turbo",
      tags: ["openai", "llm"],
    },
    {
      digestId: digest.id,
      position: 2,
      headlineDe: "EU verhängt erste AI Act Strafen",
      headlineEn: "EU Issues First AI Act Fines",
      summary: "Die EU hat erstmals Strafen verhängt.",
      whyRelevant: "AI Act wird durchgesetzt.",
      hnUrl: "https://news.ycombinator.com/item?id=12346",
      sourceUrl: "https://ec.europa.eu/ai-act",
      tags: ["regulation", "eu"],
    },
  ];

  const insertedStories = await db
    .insert(stories)
    .values(testStories)
    .returning();

  return { digest, stories: insertedStories };
}
