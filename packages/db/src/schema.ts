// Celine Intelligence — Drizzle 스키마 (스펙 §4 데이터 모델).
// 엔티티(잘 안 변함, upsert)와 스냅샷(매일 append, 시계열)을 분리한다.

import {
  boolean,
  date,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const platformEnum = pgEnum("platform", [
  "meta_ads",
  "instagram",
  "twitter",
  "tiktok",
  "tiktok_ads",
  "bereal", // 미사용(수집 대상 아님). enum 값 제거는 마이그레이션 필요해 남겨둠 — @celine/shared PLATFORMS 가 실제 대상.
]);
export const cadenceEnum = pgEnum("cadence", ["daily", "every_2d"]);
export const runStatusEnum = pgEnum("run_status", ["running", "done", "error"]);
export const adFormatEnum = pgEnum("ad_format", ["image", "video", "carousel"]);
export const ownerTypeEnum = pgEnum("owner_type", ["ad", "post"]);

// ── 브랜드 / 계정 / 실행 ────────────────────────────────

export const brands = pgTable("brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const brandAccounts = pgTable(
  "brand_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    handle: text("handle").notNull(), // @핸들 또는 Ad Library page_id
    profileUrl: text("profile_url"),
    apifyInput: jsonb("apify_input"), // actor 입력 override
    isActive: boolean("is_active").notNull().default(true),
    collectCadence: cadenceEnum("collect_cadence").notNull().default("daily"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("brand_accounts_brand_platform_handle_uniq").on(t.brandId, t.platform, t.handle)],
);

export const collectionRuns = pgTable("collection_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandAccountId: uuid("brand_account_id")
    .notNull()
    .references(() => brandAccounts.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  apifyRunId: text("apify_run_id"),
  status: runStatusEnum("status").notNull().default("running"),
  itemCount: integer("item_count").notNull().default(0),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

// ── 엔티티 (upsert) ─────────────────────────────────────

export const ads = pgTable(
  "ads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandAccountId: uuid("brand_account_id")
      .notNull()
      .references(() => brandAccounts.id, { onDelete: "cascade" }),
    platformAdId: text("platform_ad_id").notNull(),
    adCopy: text("ad_copy"),
    format: adFormatEnum("format"),
    destinationUrl: text("destination_url"),
    landingDomain: text("landing_domain"),
    firstSeen: date("first_seen").notNull(),
    lastSeen: date("last_seen").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    daysActive: integer("days_active").notNull().default(0),
    raw: jsonb("raw"),
  },
  (t) => [uniqueIndex("ads_account_platform_ad_uniq").on(t.brandAccountId, t.platformAdId)],
);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandAccountId: uuid("brand_account_id")
      .notNull()
      .references(() => brandAccounts.id, { onDelete: "cascade" }),
    platformPostId: text("platform_post_id").notNull(),
    caption: text("caption"),
    format: adFormatEnum("format"),
    permalink: text("permalink"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    raw: jsonb("raw"),
  },
  (t) => [uniqueIndex("posts_account_platform_post_uniq").on(t.brandAccountId, t.platformPostId)],
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerType: ownerTypeEnum("owner_type").notNull(),
    ownerId: uuid("owner_id").notNull(),
    r2Key: text("r2_key"),
    originalUrl: text("original_url").notNull(),
    kind: text("kind"), // image | video
    sha256: text("sha256"),
    width: integer("width"),
    height: integer("height"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("media_owner_url_uniq").on(t.ownerType, t.ownerId, t.originalUrl)],
);

// ── 스냅샷 (매일 append, 시계열) ───────────────────────

export const adPresenceDaily = pgTable(
  "ad_presence_daily",
  {
    adId: uuid("ad_id")
      .notNull()
      .references(() => ads.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    wasActive: boolean("was_active").notNull(),
  },
  (t) => [primaryKey({ columns: [t.adId, t.date] })],
);

export const accountMetricsDaily = pgTable(
  "account_metrics_daily",
  {
    brandAccountId: uuid("brand_account_id")
      .notNull()
      .references(() => brandAccounts.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    followers: integer("followers"),
    following: integer("following"),
    postsCount: integer("posts_count"),
    engagementRate30d: doublePrecision("engagement_rate_30d"),
  },
  (t) => [primaryKey({ columns: [t.brandAccountId, t.date] })],
);

export const postMetricsDaily = pgTable(
  "post_metrics_daily",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    likes: integer("likes"),
    comments: integer("comments"),
    views: integer("views"),
    shares: integer("shares"),
    saves: integer("saves"),
  },
  (t) => [primaryKey({ columns: [t.postId, t.date] })],
);

// ── 댓글 + 키워드 분석 ───────────────────────────────

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    platformCommentId: text("platform_comment_id").notNull(),
    text: text("text"),
    likeCount: integer("like_count"),
    authorHandle: text("author_handle"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("comments_post_platform_uniq").on(t.postId, t.platformCommentId)],
);

export const commentKeywords = pgTable(
  "comment_keywords",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    kind: text("kind").notNull(), // "top" | "focus"
    count: integer("count").notNull(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.keyword, t.kind] })],
);

// ── 분류 (🟡 2차, 스키마만 준비) ──────────────────────

export const contentTags = pgTable("content_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerType: ownerTypeEnum("owner_type").notNull(),
  ownerId: uuid("owner_id").notNull(),
  messageType: text("message_type"),
  formatType: text("format_type"),
  isSponsored: boolean("is_sponsored"),
  confidence: doublePrecision("confidence"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schema = {
  brands,
  brandAccounts,
  collectionRuns,
  ads,
  posts,
  mediaAssets,
  adPresenceDaily,
  accountMetricsDaily,
  postMetricsDaily,
  comments,
  commentKeywords,
  contentTags,
};
