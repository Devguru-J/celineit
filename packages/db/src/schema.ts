// Celine Intelligence — Drizzle 스키마 (스펙 §4 데이터 모델).
// 엔티티(잘 안 변함, upsert)와 스냅샷(매일 append, 시계열)을 분리한다.

import { desc } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
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

export const collectionRuns = pgTable(
  "collection_runs",
  {
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
  },
  (t) => [
    // run 이 매일 계정 수만큼 쌓여 무한 증가 — 관리 화면 최근순 조회와 KPI 기간 집계용.
    index("collection_runs_started_at_idx").on(desc(t.startedAt)),
    // Apify webhook/reconciler 가 콜백마다 apify_run_id 로 조회한다(핫패스 풀스캔 방지).
    index("collection_runs_apify_run_id_idx").on(t.apifyRunId),
    // FK 조인 + brand_accounts cascade delete 대상.
    index("collection_runs_brand_account_idx").on(t.brandAccountId),
  ],
);

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
  (t) => [
    uniqueIndex("ads_account_platform_ad_uniq").on(t.brandAccountId, t.platformAdId),
    // 위닝 광고/피드가 days_active DESC 정렬로 조회한다.
    index("ads_days_active_idx").on(desc(t.daysActive)),
    // 최근 변경(신규/비활성) 카드가 first/last_seen DESC 로 조회한다.
    index("ads_first_seen_idx").on(desc(t.firstSeen)),
    index("ads_last_seen_idx").on(desc(t.lastSeen)),
  ],
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
  (t) => [
    uniqueIndex("posts_account_platform_post_uniq").on(t.brandAccountId, t.platformPostId),
    // 피드/캘린더/최근 변경이 posted_at 정렬·범위 조회로 접근한다.
    index("posts_posted_at_idx").on(desc(t.postedAt)),
  ],
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
    // 팔로워는 integer(21.4억) 상한을 넘을 수 있어 bigint. mode:"number"라 JS 쪽은 number 그대로.
    followers: bigint("followers", { mode: "number" }),
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
    // 바이럴 영상 조회수는 integer(21.4억)를 넘겨 인제스트가 하드 실패할 수 있어 bigint.
    // ⚠️ raw sql`max()/sum()` 으로 집계할 땐 ::float8 캐스트 필수 — postgres.js 가
    // int8 을 string 으로 반환해 산술이 문자열 결합으로 깨진다.
    likes: bigint("likes", { mode: "number" }),
    comments: bigint("comments", { mode: "number" }),
    views: bigint("views", { mode: "number" }),
    shares: bigint("shares", { mode: "number" }),
    saves: bigint("saves", { mode: "number" }),
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

// ── 트렌드 뷰어 (Trend Radar) 구독 계정 ─────────────────
// 릴스/X/스레드/틱톡 탭에서 모니터링할 외부 계정 목록. 사용자 간 공유(서버 저장).
// 소스별 행이 0개면 코드의 기본 계정으로 시드된다(lib/radar/constants).

export const trendAccountSourceEnum = pgEnum("trend_account_source", [
  "reels",
  "x",
  "threads",
  "tiktok",
]);

export const trendAccounts = pgTable(
  "trend_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: trendAccountSourceEnum("source").notNull(),
    username: text("username").notNull(), // X는 대소문자 보존, 그 외 소문자
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("trend_accounts_source_username_uniq").on(t.source, t.username)],
);

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
  trendAccounts,
};
