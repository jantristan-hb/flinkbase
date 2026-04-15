import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  date,
  uniqueIndex,
  index,
  customType,
} from "drizzle-orm/pg-core";

// Custom pgvector type for Drizzle
const vector = customType<{ data: number[]; driverType: string }>({
  dataType() {
    return "vector(768)";
  },
  toDriver(value: number[]) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string) {
    return value
      .slice(1, -1)
      .split(",")
      .map(Number);
  },
});

export const digests = pgTable(
  "digests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    digestDate: date("digest_date").notNull(),
    slot: text("slot").notNull(), // 'morgen' | 'mittag' | 'abend'
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    summaryOfDay: text("summary_of_day").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_digests_date_slot").on(table.digestDate, table.slot),
    index("idx_digests_published_at").on(table.publishedAt),
  ]
);

export const stories = pgTable(
  "stories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    digestId: uuid("digest_id")
      .notNull()
      .references(() => digests.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    headlineDe: text("headline_de").notNull(),
    headlineEn: text("headline_en").notNull(),
    summary: text("summary").notNull(),
    whyRelevant: text("why_relevant").notNull(),
    hnUrl: text("hn_url").notNull(),
    sourceUrl: text("source_url"),
    tags: text("tags").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_stories_digest_position").on(
      table.digestId,
      table.position
    ),
    index("idx_stories_digest_id").on(table.digestId),
  ]
);

export const storyEmbeddings = pgTable(
  "story_embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    embedding: vector("embedding").notNull(),
    contentText: text("content_text").notNull(),
  },
  (table) => [index("idx_story_embeddings_story_id").on(table.storyId)]
);

export const subscribers = pgTable("subscribers", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Type exports
export type Digest = typeof digests.$inferSelect;
export type NewDigest = typeof digests.$inferInsert;
export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;
export type StoryEmbedding = typeof storyEmbeddings.$inferSelect;
export type Subscriber = typeof subscribers.$inferSelect;
