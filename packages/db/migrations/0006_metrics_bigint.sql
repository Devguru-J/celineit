ALTER TABLE "account_metrics_daily" ALTER COLUMN "followers" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "post_metrics_daily" ALTER COLUMN "likes" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "post_metrics_daily" ALTER COLUMN "comments" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "post_metrics_daily" ALTER COLUMN "views" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "post_metrics_daily" ALTER COLUMN "shares" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "post_metrics_daily" ALTER COLUMN "saves" SET DATA TYPE bigint;