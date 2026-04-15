import { db, pgClient } from "./client";
import { digests, stories, storyEmbeddings, subscribers } from "./schema";
import type { NewDigest, NewStory } from "./schema";
import { eq, desc, and, lt, gt, sql, asc } from "drizzle-orm";

export async function getLatestDigest() {
  const result = await db
    .select()
    .from(digests)
    .orderBy(desc(digests.publishedAt))
    .limit(1);
  return result[0] ?? null;
}

export async function getDigestBySlug(dateStr: string, slot: string) {
  const result = await db
    .select()
    .from(digests)
    .where(and(eq(digests.digestDate, dateStr), eq(digests.slot, slot)))
    .limit(1);
  return result[0] ?? null;
}

export async function getStoriesForDigest(digestId: string) {
  return db
    .select()
    .from(stories)
    .where(
      and(
        eq(stories.digestId, digestId),
        sql`${stories.verificationStatus} != 'rejected'`
      )
    )
    .orderBy(asc(stories.position));
}

export async function getDigestWithStories(dateStr: string, slot: string) {
  const digest = await getDigestBySlug(dateStr, slot);
  if (!digest) return null;
  const digestStories = await getStoriesForDigest(digest.id);
  return { digest, stories: digestStories };
}

export async function getDigestsPaginated(page: number, limit: number = 20) {
  const offset = (page - 1) * limit;
  const [items, countResult] = await Promise.all([
    db.select().from(digests).orderBy(desc(digests.publishedAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(digests),
  ]);
  const total = Number(countResult[0].count);
  return { items, total, totalPages: Math.ceil(total / limit) };
}

export async function getDigestsByMonth(year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return db
    .select()
    .from(digests)
    .where(
      and(
        sql`${digests.digestDate} >= ${startDate}`,
        sql`${digests.digestDate} < ${endDate}`
      )
    )
    .orderBy(desc(digests.publishedAt));
}

export async function getPrevNextDigest(currentPublishedAt: Date) {
  const [prev, next] = await Promise.all([
    db
      .select({
        id: digests.id,
        digestDate: digests.digestDate,
        slot: digests.slot,
        title: digests.title,
      })
      .from(digests)
      .where(lt(digests.publishedAt, currentPublishedAt))
      .orderBy(desc(digests.publishedAt))
      .limit(1),
    db
      .select({
        id: digests.id,
        digestDate: digests.digestDate,
        slot: digests.slot,
        title: digests.title,
      })
      .from(digests)
      .where(gt(digests.publishedAt, currentPublishedAt))
      .orderBy(asc(digests.publishedAt))
      .limit(1),
  ]);
  return { prev: prev[0] ?? null, next: next[0] ?? null };
}

export async function searchStoriesByEmbedding(
  queryEmbedding: number[],
  limit: number = 20
) {
  const vectorStr = `[${queryEmbedding.join(",")}]`;
  return pgClient`
    SELECT s.id, s.headline_de, s.summary, s.why_relevant, s.hn_url, s.source_url, s.tags,
      d.digest_date, d.slot, d.title as digest_title,
      se.embedding <=> ${vectorStr}::vector AS distance
    FROM story_embeddings se
    JOIN stories s ON se.story_id = s.id
    JOIN digests d ON s.digest_id = d.id
    ORDER BY se.embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `;
}

export async function insertDigestWithStories(
  digestData: NewDigest,
  storiesData: Omit<NewStory, "digestId">[],
  embeddings: { contentText: string; embedding: number[] }[]
) {
  return db.transaction(async (tx) => {
    const [digest] = await tx.insert(digests).values(digestData).returning();
    const storyValues = storiesData.map((s, i) => ({
      ...s,
      digestId: digest.id,
      position: i + 1,
    }));
    const insertedStories = await tx
      .insert(stories)
      .values(storyValues)
      .returning();
    if (embeddings.length > 0) {
      const embeddingValues = insertedStories.map((s, i) => ({
        storyId: s.id,
        embedding: embeddings[i].embedding,
        contentText: embeddings[i].contentText,
      }));
      await tx.insert(storyEmbeddings).values(embeddingValues);
    }
    return { digest, stories: insertedStories };
  });
}

export async function insertSubscriber(email: string) {
  return db
    .insert(subscribers)
    .values({ email })
    .onConflictDoNothing({ target: subscribers.email })
    .returning();
}

export async function confirmSubscriber(id: string) {
  return db
    .update(subscribers)
    .set({ confirmedAt: new Date() })
    .where(eq(subscribers.id, id))
    .returning();
}

export async function unsubscribe(id: string) {
  return db
    .update(subscribers)
    .set({ unsubscribedAt: new Date() })
    .where(eq(subscribers.id, id))
    .returning();
}

export async function getUnverifiedStories(digestId: string) {
  return db
    .select()
    .from(stories)
    .where(and(eq(stories.digestId, digestId), eq(stories.verificationStatus, "unverified")))
    .orderBy(asc(stories.position));
}

export async function updateStoryVerification(
  storyId: string,
  status: "verified" | "rejected",
  reason: string
) {
  return db
    .update(stories)
    .set({ verificationStatus: status, verificationReason: reason })
    .where(eq(stories.id, storyId))
    .returning();
}

export async function getLatestUnverifiedDigest() {
  const result = await db
    .select()
    .from(digests)
    .where(
      sql`EXISTS (SELECT 1 FROM stories WHERE stories.digest_id = digests.id AND stories.verification_status = 'unverified')`
    )
    .orderBy(desc(digests.publishedAt))
    .limit(1);
  return result[0] ?? null;
}

export async function getConfirmedSubscribers() {
  return db
    .select()
    .from(subscribers)
    .where(
      and(
        sql`${subscribers.confirmedAt} IS NOT NULL`,
        sql`${subscribers.unsubscribedAt} IS NULL`
      )
    );
}

export async function getRecentDigests(days: number = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return db
    .select()
    .from(digests)
    .where(gt(digests.publishedAt, cutoff))
    .orderBy(desc(digests.publishedAt));
}

export async function getAllDigestSlugs() {
  return db
    .select({ digestDate: digests.digestDate, slot: digests.slot })
    .from(digests)
    .orderBy(desc(digests.publishedAt));
}
