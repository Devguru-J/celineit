CREATE TYPE "public"."trend_account_source" AS ENUM('reels', 'x', 'threads', 'tiktok');--> statement-breakpoint
CREATE TABLE "trend_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "trend_account_source" NOT NULL,
	"username" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "trend_accounts_source_username_uniq" ON "trend_accounts" USING btree ("source","username");--> statement-breakpoint
-- 신규 public 테이블 RLS 활성화 (0003_enable_rls 정책 준수: postgres 직결만 접근).
ALTER TABLE "trend_accounts" ENABLE ROW LEVEL SECURITY;