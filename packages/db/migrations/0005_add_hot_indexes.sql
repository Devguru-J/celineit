CREATE INDEX "ads_days_active_idx" ON "ads" USING btree ("days_active" desc);--> statement-breakpoint
CREATE INDEX "ads_first_seen_idx" ON "ads" USING btree ("first_seen" desc);--> statement-breakpoint
CREATE INDEX "ads_last_seen_idx" ON "ads" USING btree ("last_seen" desc);--> statement-breakpoint
CREATE INDEX "collection_runs_started_at_idx" ON "collection_runs" USING btree ("started_at" desc);--> statement-breakpoint
CREATE INDEX "collection_runs_apify_run_id_idx" ON "collection_runs" USING btree ("apify_run_id");--> statement-breakpoint
CREATE INDEX "collection_runs_brand_account_idx" ON "collection_runs" USING btree ("brand_account_id");--> statement-breakpoint
CREATE INDEX "posts_posted_at_idx" ON "posts" USING btree ("posted_at" desc);