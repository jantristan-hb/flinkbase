CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"digest_date" date NOT NULL,
	"slot" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"summary_of_day" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"digest_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"headline_de" text NOT NULL,
	"headline_en" text NOT NULL,
	"summary" text NOT NULL,
	"why_relevant" text NOT NULL,
	"hn_url" text NOT NULL,
	"source_url" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"embedding" vector(768) NOT NULL,
	"content_text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"confirmed_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscribers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_digest_id_digests_id_fk" FOREIGN KEY ("digest_id") REFERENCES "public"."digests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_embeddings" ADD CONSTRAINT "story_embeddings_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_digests_date_slot" ON "digests" USING btree ("digest_date","slot");--> statement-breakpoint
CREATE INDEX "idx_digests_published_at" ON "digests" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_stories_digest_position" ON "stories" USING btree ("digest_id","position");--> statement-breakpoint
CREATE INDEX "idx_stories_digest_id" ON "stories" USING btree ("digest_id");--> statement-breakpoint
CREATE INDEX "idx_story_embeddings_story_id" ON "story_embeddings" USING btree ("story_id");
--> statement-breakpoint
CREATE INDEX idx_story_embeddings_vector ON story_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);