CREATE TYPE "public"."ad_format" AS ENUM('image', 'video', 'carousel');--> statement-breakpoint
CREATE TYPE "public"."cadence" AS ENUM('daily', 'every_2d');--> statement-breakpoint
CREATE TYPE "public"."owner_type" AS ENUM('ad', 'post');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('meta_ads', 'instagram', 'twitter', 'tiktok', 'bereal');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('running', 'done', 'error');--> statement-breakpoint
CREATE TABLE "account_metrics_daily" (
	"brand_account_id" uuid NOT NULL,
	"date" date NOT NULL,
	"followers" integer,
	"following" integer,
	"posts_count" integer,
	"engagement_rate_30d" double precision,
	CONSTRAINT "account_metrics_daily_brand_account_id_date_pk" PRIMARY KEY("brand_account_id","date")
);
--> statement-breakpoint
CREATE TABLE "ad_presence_daily" (
	"ad_id" uuid NOT NULL,
	"date" date NOT NULL,
	"was_active" boolean NOT NULL,
	CONSTRAINT "ad_presence_daily_ad_id_date_pk" PRIMARY KEY("ad_id","date")
);
--> statement-breakpoint
CREATE TABLE "ads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_account_id" uuid NOT NULL,
	"platform_ad_id" text NOT NULL,
	"ad_copy" text,
	"format" "ad_format",
	"destination_url" text,
	"landing_domain" text,
	"first_seen" date NOT NULL,
	"last_seen" date NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"days_active" integer DEFAULT 0 NOT NULL,
	"raw" jsonb
);
--> statement-breakpoint
CREATE TABLE "brand_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"handle" text NOT NULL,
	"profile_url" text,
	"apify_input" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"collect_cadence" "cadence" DEFAULT 'daily' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brands_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "collection_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_account_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"apify_run_id" text,
	"status" "run_status" DEFAULT 'running' NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "content_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" "owner_type" NOT NULL,
	"owner_id" uuid NOT NULL,
	"message_type" text,
	"format_type" text,
	"is_sponsored" boolean,
	"confidence" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" "owner_type" NOT NULL,
	"owner_id" uuid NOT NULL,
	"r2_key" text,
	"original_url" text NOT NULL,
	"kind" text,
	"sha256" text,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_metrics_daily" (
	"post_id" uuid NOT NULL,
	"date" date NOT NULL,
	"likes" integer,
	"comments" integer,
	"views" integer,
	"shares" integer,
	"saves" integer,
	CONSTRAINT "post_metrics_daily_post_id_date_pk" PRIMARY KEY("post_id","date")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_account_id" uuid NOT NULL,
	"platform_post_id" text NOT NULL,
	"caption" text,
	"format" "ad_format",
	"permalink" text,
	"posted_at" timestamp with time zone,
	"raw" jsonb
);
--> statement-breakpoint
ALTER TABLE "account_metrics_daily" ADD CONSTRAINT "account_metrics_daily_brand_account_id_brand_accounts_id_fk" FOREIGN KEY ("brand_account_id") REFERENCES "public"."brand_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_presence_daily" ADD CONSTRAINT "ad_presence_daily_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_brand_account_id_brand_accounts_id_fk" FOREIGN KEY ("brand_account_id") REFERENCES "public"."brand_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_accounts" ADD CONSTRAINT "brand_accounts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_runs" ADD CONSTRAINT "collection_runs_brand_account_id_brand_accounts_id_fk" FOREIGN KEY ("brand_account_id") REFERENCES "public"."brand_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_metrics_daily" ADD CONSTRAINT "post_metrics_daily_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_brand_account_id_brand_accounts_id_fk" FOREIGN KEY ("brand_account_id") REFERENCES "public"."brand_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ads_account_platform_ad_uniq" ON "ads" USING btree ("brand_account_id","platform_ad_id");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_accounts_brand_platform_handle_uniq" ON "brand_accounts" USING btree ("brand_id","platform","handle");--> statement-breakpoint
CREATE UNIQUE INDEX "media_owner_url_uniq" ON "media_assets" USING btree ("owner_type","owner_id","original_url");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_account_platform_post_uniq" ON "posts" USING btree ("brand_account_id","platform_post_id");