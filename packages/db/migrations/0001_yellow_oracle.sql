CREATE TABLE "comment_keywords" (
	"post_id" uuid NOT NULL,
	"keyword" text NOT NULL,
	"kind" text NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "comment_keywords_post_id_keyword_kind_pk" PRIMARY KEY("post_id","keyword","kind")
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"platform_comment_id" text NOT NULL,
	"text" text,
	"like_count" integer,
	"author_handle" text,
	"posted_at" timestamp with time zone,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comment_keywords" ADD CONSTRAINT "comment_keywords_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "comments_post_platform_uniq" ON "comments" USING btree ("post_id","platform_comment_id");