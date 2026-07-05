-- 모든 public 테이블에 RLS 활성화 (Supabase Security Advisor: rls_disabled_in_public).
-- 앱은 PostgREST/anon 키를 쓰지 않고 postgres 직결(drizzle)로만 접근하므로,
-- 별도 정책 없이 RLS 활성화만으로 외부 REST 노출을 전면 차단한다.
-- (postgres 소유자 롤은 BYPASSRLS 이므로 앱 쿼리에는 영향 없음.)
ALTER TABLE "brands" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "brand_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "account_metrics_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "collection_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "post_metrics_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "media_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "content_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ad_presence_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "comment_keywords" ENABLE ROW LEVEL SECURITY;
