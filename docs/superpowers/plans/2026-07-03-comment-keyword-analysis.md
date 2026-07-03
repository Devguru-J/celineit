# 댓글 키워드 Top 10 분석 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인스타그램 게시물 댓글 본문을 수집·저장하고, 게시물별로 (1) 최다 등장 키워드 Top 10과 (2) 지정 집중 키워드 언급 수를 추출해 상세페이지에 표시한다.

**Architecture:** 신규 Apify 액터(instagram-comment-scraper)로 기존 IG 게시물의 댓글 본문을 게시물당 N개 수집 → `comments` 테이블 저장 → kuromoji 형태소 분석으로 명사 Top N + `FOCUS_KEYWORDS` 부분일치 카운트를 계산해 `comment_keywords` 테이블에 precompute → 웹 로더가 읽어 게시물 상세페이지 카드로 렌더. 모니터링 대상 브랜드는 K-뷰티 5개로 교체한다.

**Tech Stack:** TypeScript, Drizzle ORM(Postgres/Supabase), Apify, kuromoji(일본어 형태소 분석), React Router v7, Tailwind v3, Vitest + pglite.

## Global Constraints

- 모노레포 npm workspaces: `@celine/db`, `@celine/shared`, `@celine/collector`(apps/collector), `@celine/web`(apps/web).
- DB 쓰기는 전부 멱등(upsert/PK 기반). 같은 날 재실행해도 중복/오염 없어야 함.
- 어댑터/정규화는 방어적 파싱(`pick`/`num`/`str` 헬퍼 사용, raw 필드 없으면 null/skip).
- UI는 한국어. Tailwind 유틸 + 기존 `Card`/`~/components/ui` 컴포넌트 재사용.
- 대상 매체는 Instagram만(이번 범위). Meta 광고는 댓글 비공개 → 대상 아님.
- 집중 키워드 단일 설정 지점 = `packages/shared`의 `FOCUS_KEYWORDS`.
- 마이그레이션은 `drizzle-kit generate`로 생성하고, `packages/db/src/testing.ts`가 마이그레이션 SQL을 pglite에 적용하므로 신규 테이블은 자동으로 테스트 DB에 반영됨.
- 테스트: `npm test -w @celine/collector` (vitest + pglite). 기존 18 tests 그린 유지.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` 붙임.

---

## File Structure

- `packages/db/src/schema.ts` — 신규 테이블 `comments`, `commentKeywords` 추가 + `schema` export에 등록.
- `packages/db/migrations/0001_*.sql` — drizzle-kit 생성 마이그레이션.
- `packages/shared/src/index.ts` — `FOCUS_KEYWORDS` 상수 + `NormalizedComment` 타입.
- `apps/collector/src/keywords.ts` — kuromoji 토크나이저 + `extractTopKeywords` + `countFocusKeywords`(순수).
- `apps/collector/src/comments.ts` — `buildCommentInput` + `normalizeComments`(Apify raw → NormalizedComment).
- `apps/collector/src/ingest-comments.ts` — `ingestComments` + `recomputeCommentKeywords`(DB 적재/재계산).
- `apps/collector/src/collect-comments.ts` — 러너(기존 IG posts 순회 → 액터 실행 → 적재).
- `apps/collector/src/seed.ts` — SEED_BRANDS를 K-뷰티 5개로 교체.
- `apps/collector/package.json` — `collect:comments` 스크립트 추가.
- `apps/collector/test/keywords.test.ts` — 키워드 추출 단위 테스트.
- `apps/collector/test/comments.test.ts` — 정규화 + 적재/재계산 통합 테스트.
- `apps/web/app/lib/queries.server.ts` — `getItemDetail` post 분기에 댓글 키워드 조회 추가.
- `apps/web/app/routes/item.tsx` — 게시물 상세에 "댓글 키워드" 카드 추가.

---

### Task 1: DB 스키마 — comments · comment_keywords 테이블

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/migrations/0001_comments_keywords.sql` (drizzle-kit generate)

**Interfaces:**
- Produces: 테이블 `comments`(id, postId, platformCommentId, text, likeCount, authorHandle, postedAt, raw, createdAt), `commentKeywords`(postId, keyword, kind, count). Drizzle 객체명: `comments`, `commentKeywords`. `schema` export에 등록.

- [ ] **Step 1: 스키마에 두 테이블 추가**

`packages/db/src/schema.ts`의 `contentTags` 정의 바로 위(또는 `postMetricsDaily` 다음)에 추가:

```typescript
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
```

- [ ] **Step 2: schema export에 등록**

같은 파일 하단 `export const schema = { ... }` 객체에 두 줄 추가:

```typescript
  postMetricsDaily,
  comments,
  commentKeywords,
  contentTags,
```

- [ ] **Step 3: 마이그레이션 생성**

Run: `npm run generate -w @celine/db`
Expected: `packages/db/migrations/0001_*.sql` 생성. 파일에 `CREATE TABLE "comments"` 와 `CREATE TABLE "comment_keywords"` 포함.

- [ ] **Step 4: 마이그레이션 SQL 확인**

Run: `ls packages/db/migrations && grep -l "comment_keywords" packages/db/migrations/*.sql`
Expected: 신규 .sql 파일이 매칭됨. (파일명이 `0001_comments_keywords.sql`가 아니어도 무방 — drizzle-kit 자동 명명.)

- [ ] **Step 5: pglite 로 스키마 적용 확인**

Run: `npm test -w @celine/collector`
Expected: 기존 테스트 전부 PASS (신규 테이블이 마이그레이션에 포함돼도 기존 테스트 깨지지 않음).

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema.ts packages/db/migrations
git commit -m "feat(db): comments·comment_keywords 테이블 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: shared — FOCUS_KEYWORDS + NormalizedComment

**Files:**
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `FOCUS_KEYWORDS: string[]`, `NormalizedComment` 인터페이스(`platformCommentId, text, likeCount?, authorHandle?, postedAt?, raw`).

- [ ] **Step 1: 상수와 타입 추가**

`packages/shared/src/index.ts` 하단(`landingDomainOf` 아래)에 추가:

```typescript
// 댓글에서 주시할 집중 키워드 — 단일 설정 지점. 부분일치(substring)로 카운트.
export const FOCUS_KEYWORDS: string[] = [
  "韓国コスメ",
  "スキンケア",
  "うるおい",
  "水分ケア",
  "毛穴",
  "化粧水",
  "化粧ノリ",
];

// 어댑터가 Apify 댓글 raw 를 정규화한 결과.
export interface NormalizedComment {
  platformCommentId: string;
  text: string | null;
  likeCount?: number;
  authorHandle?: string | null;
  postedAt?: string | null; // ISO
  raw: unknown;
}
```

- [ ] **Step 2: 타입체크**

Run: `npm run build -w @celine/shared 2>/dev/null || npx tsc --noEmit -p packages/shared`
Expected: 에러 없음. (shared에 build 스크립트 없으면 tsc 직접 실행.)

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): FOCUS_KEYWORDS + NormalizedComment

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 키워드 추출 모듈 (kuromoji)

**Files:**
- Create: `apps/collector/src/keywords.ts`
- Create: `apps/collector/test/keywords.test.ts`
- Modify: `apps/collector/package.json` (kuromoji 의존성)

**Interfaces:**
- Consumes: `FOCUS_KEYWORDS`(@celine/shared).
- Produces:
  - `createTokenizer(): Promise<Tokenizer>` (kuromoji tokenizer 싱글턴)
  - `extractTopKeywords(tokenizer: Tokenizer, texts: string[], opts?: { topN?: number; exclude?: string[] }): { keyword: string; count: number }[]`
  - `countFocusKeywords(texts: string[], focus: string[]): { keyword: string; count: number }[]`
  - `type Tokenizer = kuromoji.Tokenizer<kuromoji.IpadicFeatures>`

- [ ] **Step 1: kuromoji 설치**

Run: `npm i kuromoji -w @celine/collector && npm i -D @types/kuromoji -w @celine/collector`
Expected: `apps/collector/package.json` dependencies에 `kuromoji` 추가.

- [ ] **Step 2: countFocusKeywords 실패 테스트 작성**

`apps/collector/test/keywords.test.ts`:

```typescript
import { describe, expect, it, beforeAll } from "vitest";
import { countFocusKeywords, createTokenizer, extractTopKeywords, type Tokenizer } from "../src/keywords";

describe("countFocusKeywords", () => {
  it("부분일치로 포함 댓글 수를 센다(복합어·정규화 포함)", () => {
    const texts = [
      "水分ケアが最高です",
      "毛穴が気になる…水分ケアしたい",
      "ＫＯＲＥＡ 韓国コスメ大好き", // 전각/영문 섞임
      "普通のコメント",
    ];
    const res = countFocusKeywords(texts, ["水分ケア", "毛穴", "韓国コスメ", "化粧水"]);
    const map = Object.fromEntries(res.map((r) => [r.keyword, r.count]));
    expect(map["水分ケア"]).toBe(2);
    expect(map["毛穴"]).toBe(1);
    expect(map["韓国コスメ"]).toBe(1);
    expect(map["化粧水"]).toBeUndefined(); // 0 은 제외
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npm test -w @celine/collector -- keywords`
Expected: FAIL ("countFocusKeywords" not exported / module not found).

- [ ] **Step 4: keywords.ts 구현**

`apps/collector/src/keywords.ts`:

```typescript
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import kuromoji from "kuromoji";

export type Tokenizer = kuromoji.Tokenizer<kuromoji.IpadicFeatures>;

const require = createRequire(import.meta.url);
// node_modules/kuromoji/build/kuromoji.js → ../dict
const DIC_PATH = join(dirname(require.resolve("kuromoji")), "..", "dict");

let tokenizerPromise: Promise<Tokenizer> | null = null;

export function createTokenizer(): Promise<Tokenizer> {
  if (!tokenizerPromise) {
    tokenizerPromise = new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath: DIC_PATH }).build((err, tokenizer) => {
        if (err) reject(err);
        else resolve(tokenizer);
      });
    });
  }
  return tokenizerPromise;
}

// 노이즈 명사(불용어). 의미 없는 일반 명사 + 자주 나오는 잡음.
const STOPWORDS = new Set([
  "こと", "もの", "ため", "これ", "それ", "あれ", "ここ", "そこ", "どこ",
  "さん", "ちゃん", "方", "人", "私", "僕", "今", "気", "的", "中", "感",
  "よう", "の", "笑", "件", "点", "所", "様", "君", "者",
]);

const KEEP = /[぀-ゟ゠-ヿ一-鿿A-Za-z]/; // 히라가나/가타카나/한자/영문 1자 이상 포함
const POS_NOUN = "名詞";
const POS_DETAIL_SKIP = new Set(["非自立", "代名詞", "数", "接尾", "副詞可能"]);

function normalize(s: string): string {
  return s.normalize("NFKC").toLowerCase();
}

export function extractTopKeywords(
  tokenizer: Tokenizer,
  texts: string[],
  opts?: { topN?: number; exclude?: string[] },
): { keyword: string; count: number }[] {
  const topN = opts?.topN ?? 10;
  const exclude = new Set((opts?.exclude ?? []).map(normalize));
  const counts = new Map<string, number>();

  for (const text of texts) {
    if (!text) continue;
    for (const tok of tokenizer.tokenize(text)) {
      if (tok.pos !== POS_NOUN) continue;
      if (POS_DETAIL_SKIP.has(tok.pos_detail_1)) continue;
      const surface = tok.surface_form;
      if (surface.length < 2) continue;
      if (!KEEP.test(surface)) continue; // 이모지·기호·숫자만인 토큰 제외
      const key = surface;
      if (STOPWORDS.has(key)) continue;
      if (exclude.has(normalize(key))) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword))
    .slice(0, topN);
}

export function countFocusKeywords(
  texts: string[],
  focus: string[],
): { keyword: string; count: number }[] {
  const normTexts = texts.map(normalize);
  const out: { keyword: string; count: number }[] = [];
  for (const kw of focus) {
    const needle = normalize(kw);
    let count = 0;
    for (const t of normTexts) if (t.includes(needle)) count++;
    if (count > 0) out.push({ keyword: kw, count });
  }
  return out.sort((a, b) => b.count - a.count);
}
```

- [ ] **Step 5: countFocusKeywords 테스트 통과 확인**

Run: `npm test -w @celine/collector -- keywords`
Expected: countFocusKeywords 테스트 PASS.

- [ ] **Step 6: extractTopKeywords 테스트 추가**

`keywords.test.ts`에 append:

```typescript
describe("extractTopKeywords", () => {
  let tokenizer: Tokenizer;
  beforeAll(async () => {
    tokenizer = await createTokenizer();
  }, 30_000);

  it("명사만 추출하고 조사·불용어·브랜드명을 제거해 빈도순 정렬한다", () => {
    const texts = [
      "毛穴が本当に気になるので化粧水を買いました",
      "毛穴に効く化粧水ですね",
      "アヌアの化粧水は毛穴によい", // 아래 exclude 로 アヌア 제거
    ];
    const res = extractTopKeywords(tokenizer, texts, { topN: 5, exclude: ["アヌア"] });
    const words = res.map((r) => r.keyword);
    expect(words).toContain("毛穴");
    expect(words).toContain("化粧水");
    expect(words).not.toContain("アヌア"); // exclude
    expect(words).not.toContain("が"); // 조사 제외
    // 毛穴(3) 가 化粧水(3) 와 함께 상위. count 검증
    const map = Object.fromEntries(res.map((r) => [r.keyword, r.count]));
    expect(map["毛穴"]).toBe(3);
    expect(map["化粧水"]).toBe(3);
  });
});
```

- [ ] **Step 7: extractTopKeywords 테스트 통과 확인**

Run: `npm test -w @celine/collector -- keywords`
Expected: 모든 keywords 테스트 PASS. (kuromoji 사전 로딩으로 첫 실행이 다소 느릴 수 있음 — beforeAll timeout 30s.)

- [ ] **Step 8: Commit**

```bash
git add apps/collector/src/keywords.ts apps/collector/test/keywords.test.ts apps/collector/package.json package-lock.json
git commit -m "feat(collector): 일본어 키워드 추출(kuromoji) + 집중 키워드 카운트

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 댓글 정규화 (comments.ts)

**Files:**
- Create: `apps/collector/src/comments.ts`
- Modify: `apps/collector/test/comments.test.ts` (Task 5에서 확장, 여기선 생성)

**Interfaces:**
- Consumes: `NormalizedComment`(@celine/shared), `pick`/`num`/`str`(./adapters/types).
- Produces:
  - `buildCommentInput(postUrl: string, maxItems: number): Record<string, unknown>`
  - `normalizeComments(rawItems: unknown[]): NormalizedComment[]`
  - `COMMENT_ACTOR = "apify~instagram-comment-scraper"`

- [ ] **Step 1: normalizeComments 실패 테스트 작성**

`apps/collector/test/comments.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { buildCommentInput, normalizeComments } from "../src/comments";

describe("normalizeComments", () => {
  it("Apify 댓글 raw 를 방어적으로 정규화한다", () => {
    const raw = [
      { id: "c1", text: "毛穴によい", ownerUsername: "user_a", timestamp: "2026-06-01T00:00:00.000Z", likesCount: 3 },
      { id: "c2", text: "", ownerUsername: "user_b", likesCount: "5" },
      { text: "id 없는 댓글은 버림" },
      "garbage",
    ];
    const res = normalizeComments(raw);
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({ platformCommentId: "c1", text: "毛穴によい", likeCount: 3, authorHandle: "user_a" });
    expect(res[1]).toMatchObject({ platformCommentId: "c2", likeCount: 5 });
  });

  it("buildCommentInput 은 게시물 URL 과 limit 을 넣는다", () => {
    const input = buildCommentInput("https://www.instagram.com/p/ABC/", 50);
    expect(input).toMatchObject({ directUrls: ["https://www.instagram.com/p/ABC/"], resultsLimit: 50 });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -w @celine/collector -- comments`
Expected: FAIL (module not found).

- [ ] **Step 3: comments.ts 구현**

`apps/collector/src/comments.ts`:

```typescript
import type { NormalizedComment } from "@celine/shared";
import { num, pick, str } from "./adapters/types";

// Instagram 댓글 스크래퍼 (apify/instagram-comment-scraper).
export const COMMENT_ACTOR = "apify~instagram-comment-scraper";

export function buildCommentInput(postUrl: string, maxItems: number): Record<string, unknown> {
  return {
    directUrls: [postUrl],
    resultsLimit: maxItems,
  };
}

export function normalizeComments(rawItems: unknown[]): NormalizedComment[] {
  const out: NormalizedComment[] = [];
  for (const item of rawItems) {
    const platformCommentId = str(pick(item, "id", "commentId"));
    if (!platformCommentId) continue; // id 없으면 버림
    out.push({
      platformCommentId,
      text: str(pick(item, "text", "comment")) ?? null,
      likeCount: num(pick(item, "likesCount", "likeCount", "likes")),
      authorHandle: str(pick(item, "ownerUsername", "username", "owner")) ?? null,
      postedAt: str(pick(item, "timestamp", "createdAt")) ?? null,
      raw: item,
    });
  }
  return out;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -w @celine/collector -- comments`
Expected: normalizeComments·buildCommentInput 테스트 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/collector/src/comments.ts apps/collector/test/comments.test.ts
git commit -m "feat(collector): 댓글 정규화 + 댓글 액터 입력

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: 댓글 적재 + 키워드 재계산 (ingest-comments.ts)

**Files:**
- Create: `apps/collector/src/ingest-comments.ts`
- Modify: `apps/collector/test/comments.test.ts` (통합 테스트 추가)

**Interfaces:**
- Consumes: `comments`/`commentKeywords`/`Database`(@celine/db), `NormalizedComment`/`FOCUS_KEYWORDS`(@celine/shared), `Tokenizer`/`extractTopKeywords`/`countFocusKeywords`(./keywords).
- Produces:
  - `ingestComments(db: Database, postId: string, comments: NormalizedComment[]): Promise<number>`
  - `recomputeCommentKeywords(db: Database, tokenizer: Tokenizer, postId: string, opts?: { exclude?: string[]; topN?: number }): Promise<{ top: number; focus: number }>`

- [ ] **Step 1: 통합 테스트 작성**

`apps/collector/test/comments.test.ts`에 append:

```typescript
import { comments as commentsT, commentKeywords, brandAccounts, brands, posts as postsT } from "@celine/db";
import { createTestDb } from "@celine/db/testing";
import { eq } from "drizzle-orm";
import { createTokenizer, type Tokenizer } from "../src/keywords";
import { ingestComments, recomputeCommentKeywords } from "../src/ingest-comments";
import { beforeAll } from "vitest";

describe("댓글 적재 + 키워드 재계산", () => {
  let tokenizer: Tokenizer;
  beforeAll(async () => {
    tokenizer = await createTokenizer();
  }, 30_000);

  async function seedPost() {
    const { db } = await createTestDb();
    const [brand] = await db.insert(brands).values({ name: "アヌア", slug: "anua" }).returning();
    const [acct] = await db
      .insert(brandAccounts)
      .values({ brandId: brand.id, platform: "instagram", handle: "@anua_jp" })
      .returning();
    const [post] = await db
      .insert(postsT)
      .values({ brandAccountId: acct.id, platformPostId: "P1", caption: "c" })
      .returning();
    return { db, postId: post.id };
  }

  it("댓글을 멱등 upsert 하고 top/focus 키워드를 재계산한다", async () => {
    const { db, postId } = await seedPost();
    const c = [
      { platformCommentId: "c1", text: "毛穴に水分ケア最高", raw: {} },
      { platformCommentId: "c2", text: "毛穴が気になる化粧水", raw: {} },
    ];
    const n1 = await ingestComments(db, postId, c);
    expect(n1).toBe(2);
    // 같은 댓글 재적재 → 중복 없음
    const n2 = await ingestComments(db, postId, c);
    expect(n2).toBe(0);
    const rows = await db.select().from(commentsT).where(eq(commentsT.postId, postId));
    expect(rows).toHaveLength(2);

    const res = await recomputeCommentKeywords(db, tokenizer, postId);
    expect(res.top).toBeGreaterThan(0);
    expect(res.focus).toBeGreaterThan(0);

    const kw = await db.select().from(commentKeywords).where(eq(commentKeywords.postId, postId));
    const focus = kw.filter((k) => k.kind === "focus").map((k) => k.keyword);
    expect(focus).toContain("毛穴");
    expect(focus).toContain("水分ケア");
    const top = kw.filter((k) => k.kind === "top").map((k) => k.keyword);
    expect(top).toContain("毛穴");

    // 재계산 멱등: 다시 돌려도 행 수 동일
    await recomputeCommentKeywords(db, tokenizer, postId);
    const kw2 = await db.select().from(commentKeywords).where(eq(commentKeywords.postId, postId));
    expect(kw2.length).toBe(kw.length);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -w @celine/collector -- comments`
Expected: FAIL (ingest-comments 모듈 없음).

- [ ] **Step 3: ingest-comments.ts 구현**

`apps/collector/src/ingest-comments.ts`:

```typescript
import { comments as commentsT, commentKeywords, type Database } from "@celine/db";
import { FOCUS_KEYWORDS, type NormalizedComment } from "@celine/shared";
import { and, eq } from "drizzle-orm";
import { countFocusKeywords, extractTopKeywords, type Tokenizer } from "./keywords";

export async function ingestComments(
  db: Database,
  postId: string,
  items: NormalizedComment[],
): Promise<number> {
  let inserted = 0;
  for (const c of items) {
    const res = await db
      .insert(commentsT)
      .values({
        postId,
        platformCommentId: c.platformCommentId,
        text: c.text,
        likeCount: c.likeCount,
        authorHandle: c.authorHandle,
        postedAt: c.postedAt ? new Date(c.postedAt) : null,
        raw: c.raw,
      })
      .onConflictDoNothing({ target: [commentsT.postId, commentsT.platformCommentId] })
      .returning({ id: commentsT.id });
    inserted += res.length;
  }
  return inserted;
}

export async function recomputeCommentKeywords(
  db: Database,
  tokenizer: Tokenizer,
  postId: string,
  opts?: { exclude?: string[]; topN?: number },
): Promise<{ top: number; focus: number }> {
  const rows = await db
    .select({ text: commentsT.text })
    .from(commentsT)
    .where(eq(commentsT.postId, postId));
  const texts = rows.map((r) => r.text ?? "").filter(Boolean);

  const top = extractTopKeywords(tokenizer, texts, { topN: opts?.topN ?? 10, exclude: opts?.exclude });
  const focus = countFocusKeywords(texts, FOCUS_KEYWORDS);

  // 멱등: 해당 post 의 기존 키워드 전부 삭제 후 재삽입
  await db.delete(commentKeywords).where(eq(commentKeywords.postId, postId));

  const values = [
    ...top.map((k) => ({ postId, keyword: k.keyword, kind: "top", count: k.count })),
    ...focus.map((k) => ({ postId, keyword: k.keyword, kind: "focus", count: k.count })),
  ];
  if (values.length > 0) await db.insert(commentKeywords).values(values);

  return { top: top.length, focus: focus.length };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -w @celine/collector -- comments`
Expected: 모든 comments 테스트 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/collector/src/ingest-comments.ts apps/collector/test/comments.test.ts
git commit -m "feat(collector): 댓글 적재 + top/focus 키워드 재계산(멱등)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: 댓글 수집 러너 (collect-comments.ts)

**Files:**
- Create: `apps/collector/src/collect-comments.ts`
- Modify: `apps/collector/package.json` (scripts에 `collect:comments`)

**Interfaces:**
- Consumes: `createDb`/`posts`/`brandAccounts`/`brands`(@celine/db), `ApifyClient`(./apify), `COMMENT_ACTOR`/`buildCommentInput`/`normalizeComments`(./comments), `createTokenizer`(./keywords), `ingestComments`/`recomputeCommentKeywords`(./ingest-comments).
- Produces: 실행 스크립트(엔트리포인트). export 없음.

- [ ] **Step 1: package.json 스크립트 추가**

`apps/collector/package.json`의 `scripts`에 추가:

```json
    "collect:comments": "tsx src/collect-comments.ts",
```

- [ ] **Step 2: collect-comments.ts 구현**

`apps/collector/src/collect-comments.ts`:

```typescript
// IG 댓글 수집 러너: 기존 instagram posts 를 순회하며 댓글 본문 수집 → 적재 → 키워드 재계산.
//   DATABASE_URL=... APIFY_TOKEN=... npm run collect:comments -w @celine/collector [-- --brand=anua --max=50]
import { brandAccounts, brands, createDb, posts as postsT } from "@celine/db";
import { and, eq } from "drizzle-orm";
import { ApifyClient } from "./apify";
import { buildCommentInput, COMMENT_ACTOR, normalizeComments } from "./comments";
import { ingestComments, recomputeCommentKeywords } from "./ingest-comments";
import { createTokenizer } from "./keywords";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=").slice(1).join("=");
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const apifyToken = process.env.APIFY_TOKEN;
  if (!databaseUrl) throw new Error("DATABASE_URL 환경변수가 필요합니다.");
  if (!apifyToken) throw new Error("APIFY_TOKEN 환경변수가 필요합니다.");

  const db = createDb(databaseUrl);
  const apify = new ApifyClient(apifyToken);
  const actor = process.env.APIFY_ACTOR_INSTAGRAM_COMMENTS ?? COMMENT_ACTOR;
  const max = Number(arg("max") ?? 50);
  const brandSlug = arg("brand");

  // 인스타 게시물 + 브랜드명(브랜드명은 키워드 제외어로 사용) 조회
  const rows = await db
    .select({
      postId: postsT.id,
      permalink: postsT.permalink,
      platformPostId: postsT.platformPostId,
      brandName: brands.name,
      brandSlug: brands.slug,
    })
    .from(postsT)
    .innerJoin(brandAccounts, eq(postsT.brandAccountId, brandAccounts.id))
    .innerJoin(brands, eq(brandAccounts.brandId, brands.id))
    .where(eq(brandAccounts.platform, "instagram"));

  const targets = rows.filter((r) => !brandSlug || r.brandSlug === brandSlug);
  if (targets.length === 0) {
    console.log("댓글 수집할 IG 게시물이 없습니다. 먼저 'npm run collect' 로 게시물을 수집하세요.");
    return;
  }

  const tokenizer = await createTokenizer();
  console.log(`댓글 수집 시작: ${targets.length}개 게시물 (게시물당 최대 ${max}개)\n`);

  for (const t of targets) {
    const url = t.permalink ?? `https://www.instagram.com/p/${t.platformPostId}/`;
    process.stdout.write(`• ${t.brandName} / ${t.platformPostId} … `);
    try {
      const raw = await apify.runSyncGetItems(actor, buildCommentInput(url, max));
      const normalized = normalizeComments(raw);
      const n = await ingestComments(db, t.postId, normalized);
      const kw = await recomputeCommentKeywords(db, tokenizer, t.postId, { exclude: [t.brandName] });
      console.log(`댓글 ${normalized.length}건(신규 ${n}) · top ${kw.top} · focus ${kw.focus}`);
    } catch (err) {
      console.log(`실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log("\n끝. 게시물 상세페이지에서 댓글 키워드를 확인하세요.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit -p apps/collector`
Expected: 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add apps/collector/src/collect-comments.ts apps/collector/package.json
git commit -m "feat(collector): IG 댓글 수집 러너(collect:comments)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: 모니터링 대상 교체 — K-뷰티 5개 브랜드

**Files:**
- Modify: `apps/collector/src/seed.ts`

**Interfaces:**
- Consumes: 없음(seed 상수 교체).
- Produces: 없음. DB `brands`/`brand_accounts` 시드 데이터 교체.

주의: seed는 `onConflictDoNothing`(계정) / `onConflictDoUpdate`(브랜드)라 **기존 일본 브랜드 행을 삭제하지 않는다.** 신규 K-뷰티 브랜드를 추가할 뿐. 기존 일본 브랜드를 수집 대상에서 빼는 것은 러너가 `brand_accounts.isActive`로 거르므로, 필요 시 실행 단계에서 `--brand=<slug>`로 K-뷰티만 수집한다. (기존 데이터 보존 요구사항과 일치.)

- [ ] **Step 1: SEED_BRANDS 교체**

`apps/collector/src/seed.ts`의 `SEED_BRANDS` 배열을 아래로 교체(핸들은 Task 준비 단계에서 리서치 확정):

```typescript
// 일본 시장 K-뷰티 경쟁사 (2026-07-03 대상 교체). 일본 공식 IG 계정(웹 리서치 검증, high confidence).
// 이번 범위는 Instagram(댓글 수집 대상)만. TikTok/X 핸들은 후속 확장 시 검증 후 추가.
const SEED_BRANDS: SeedBrand[] = [
  {
    name: "Anua アヌア",
    slug: "anua",
    accounts: [
      { platform: "instagram", handle: "@anua.jp" }, // Anua JAPAN OFFICIAL
    ],
  },
  {
    name: "VT Cosmetics VTコスメティックス",
    slug: "vt-cosmetics",
    accounts: [
      { platform: "instagram", handle: "@vtcosmetics_japan" }, // VT JAPAN OFFICIAL
    ],
  },
  {
    name: "medicube メディキューブ",
    slug: "medicube",
    accounts: [
      { platform: "instagram", handle: "@medicube_officialjapan" }, // メディキューブ 公式
    ],
  },
  {
    name: "manyo マニョ",
    slug: "manyo",
    accounts: [
      { platform: "instagram", handle: "@manyo.japan" }, // manyo 日本公式
    ],
  },
  {
    name: "aestura エストラ",
    slug: "aestura",
    accounts: [
      { platform: "instagram", handle: "@aestura_jp" }, // AESTURA JAPAN Official
    ],
  },
];
```

검증된 일본 공식 IG 핸들(2026-07-03 웹 리서치, high confidence):
Anua `@anua.jp` · VT `@vtcosmetics_japan` · medicube `@medicube_officialjapan` · manyo `@manyo.japan` · aestura `@aestura_jp`.

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit -p apps/collector`
Expected: 에러 없음.

- [ ] **Step 3: (선택) 시드 실행 — 실제 DB 필요**

Run: `set -a && . apps/collector/.dev.vars && set +a && npm run seed -w @celine/collector`
Expected: "시드 완료: 브랜드 5개 …" 출력. (DATABASE_URL 필요. 실 DB 없으면 이 스텝은 실행 단계에서.)

- [ ] **Step 4: Commit**

```bash
git add apps/collector/src/seed.ts
git commit -m "feat(collector): 모니터링 대상 K-뷰티 5개 브랜드로 교체

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: 웹 — 게시물 상세에 댓글 키워드 카드

**Files:**
- Modify: `apps/web/app/lib/queries.server.ts`
- Modify: `apps/web/app/routes/item.tsx`

**Interfaces:**
- Consumes: `commentKeywords`(@celine/db), `FOCUS_KEYWORDS`(@celine/shared).
- Produces: `getItemDetail` post 반환 객체에 `commentKeywords: { top: {keyword,count}[]; focus: {keyword,count}[]; totalComments: number } | null` 추가.

- [ ] **Step 1: queries.server.ts import 추가**

`apps/web/app/lib/queries.server.ts` 상단 db import 블록에 `comments`, `commentKeywords` 추가:

```typescript
import {
  accountMetricsDaily,
  ads as adsT,
  brandAccounts,
  brands as brandsT,
  collectionRuns,
  comments as commentsT,
  commentKeywords,
  mediaAssets,
  postMetricsDaily,
  posts as postsT,
} from "@celine/db";
import { FOCUS_KEYWORDS, type Platform } from "@celine/shared";
```

(기존 `import type { Platform } from "@celine/shared";` 줄을 위처럼 값+타입 혼합 import로 교체.)

- [ ] **Step 2: post 분기에 댓글 키워드 조회 추가**

`getItemDetail`의 `if (kind === "post") { ... }` 블록에서 `metrics` 조회 다음, `return {` 직전에 삽입:

```typescript
    const kwRows = await db
      .select({ keyword: commentKeywords.keyword, kind: commentKeywords.kind, count: commentKeywords.count })
      .from(commentKeywords)
      .where(eq(commentKeywords.postId, id));
    const [{ total } = { total: 0 }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(commentsT)
      .where(eq(commentsT.postId, id));
    const top = kwRows
      .filter((k) => k.kind === "top")
      .sort((a, b) => b.count - a.count)
      .map((k) => ({ keyword: k.keyword, count: k.count }));
    const focusStored = new Map(kwRows.filter((k) => k.kind === "focus").map((k) => [k.keyword, k.count]));
    // FOCUS_KEYWORDS 전체를 노출(미언급=0), 언급 많은 순
    const focus = FOCUS_KEYWORDS.map((kw) => ({ keyword: kw, count: focusStored.get(kw) ?? 0 })).sort(
      (a, b) => b.count - a.count,
    );
    const commentKw =
      top.length > 0 || total > 0 ? { top, focus, totalComments: total } : null;
```

- [ ] **Step 3: post 반환 객체에 필드 추가**

같은 블록의 `return { ... ad: null };` 에 `commentKeywords: commentKw,` 추가(예: `metricsHistory: metrics,` 다음 줄):

```typescript
      metricsHistory: metrics,
      commentKeywords: commentKw,
      ad: null,
```

- [ ] **Step 4: ad 반환 객체에도 필드 추가(타입 일치)**

ad 분기 `return { ... }` 에도 `commentKeywords: null,` 추가(예: `metricsHistory: [],` 다음):

```typescript
    metricsHistory: [],
    commentKeywords: null,
    ad: {
```

- [ ] **Step 5: 타입체크**

Run: `npx tsc --noEmit -p apps/web 2>/dev/null || npm run typecheck -w @celine/web`
Expected: 에러 없음.

- [ ] **Step 6: item.tsx 카드 추가**

`apps/web/app/routes/item.tsx`에서 "현재 지표" Card(`{latest && ( ... )}`) 블록 **다음**에 삽입:

```tsx
          {/* 댓글 키워드 (게시물만) */}
          {detail.commentKeywords && (
            <Card className="p-container-padding">
              <h3 className="font-headline-sm text-headline-sm mb-1">댓글 키워드</h3>
              <p className="font-label-muted text-label-muted text-on-surface-variant mb-3">
                수집 댓글 {fmt(detail.commentKeywords.totalComments)}건 기준
              </p>

              {detail.commentKeywords.top.length > 0 && (
                <div className="mb-4">
                  <span className="font-label-muted text-label-muted text-on-surface-variant">최다 등장 Top 10</span>
                  <div className="mt-2 space-y-1.5">
                    {detail.commentKeywords.top.map((k) => {
                      const maxCount = detail.commentKeywords!.top[0].count || 1;
                      return (
                        <div key={k.keyword} className="flex items-center gap-2">
                          <span className="font-body-sm text-body-sm w-24 shrink-0 truncate">{k.keyword}</span>
                          <div className="flex-1 h-2 rounded bg-surface-variant overflow-hidden">
                            <div className="h-full bg-primary rounded" style={{ width: `${(k.count / maxCount) * 100}%` }} />
                          </div>
                          <span className="font-label-muted text-label-muted text-on-surface-variant w-8 text-right">{k.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <span className="font-label-muted text-label-muted text-on-surface-variant">집중 키워드 언급</span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {detail.commentKeywords.focus.map((k) => (
                    <span
                      key={k.keyword}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-label-muted text-[11px] font-medium ${
                        k.count > 0 ? "bg-primary-container/15 text-primary" : "bg-surface-variant text-on-surface-variant"
                      }`}
                    >
                      {k.keyword}
                      <b>{k.count}</b>
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          )}
```

(참고: `fmt`는 item.tsx에 이미 정의돼 있음 — 광고 인텔리전스 카드에서 사용 중.)

- [ ] **Step 7: 타입체크**

Run: `npm run typecheck -w @celine/web 2>/dev/null || npx tsc --noEmit -p apps/web`
Expected: 에러 없음.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/lib/queries.server.ts apps/web/app/routes/item.tsx
git commit -m "feat(web): 게시물 상세에 댓글 키워드 카드(Top 10 + 집중 키워드)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 실행(수집) — 플랜 완료 후 별도

코드/테스트 완료 후 실제 데이터 수집(Apify 유료, $29 한도):

```bash
set -a && . apps/collector/.dev.vars && set +a
npm run seed -w @celine/collector                              # K-뷰티 5개 브랜드 등록
npm run collect -w @celine/collector -- --platform=instagram --max=30   # IG 게시물 수집
npm run collect:comments -w @celine/collector -- --max=50               # 댓글 수집 + 키워드
```

`fmt` 확인: item.tsx에 이미 있음. 없다면 숫자 포맷 헬퍼(`n.toLocaleString()`)로 대체.

## Self-Review 메모

- 스펙 커버리지: comments 저장(Task1,4,5) / top 키워드(Task3,5) / focus 키워드(Task2,3,5) / 일본어 형태소(Task3) / 게시물당 precompute(Task5) / IG 수집 러너 게시물당 50(Task6) / 브랜드 교체(Task7) / 상세 카드 Top10+집중(Task8) — 전부 매핑됨.
- 타입 일관성: `getItemDetail` post/ad 두 분기 모두 `commentKeywords` 필드 포함(Task8 Step3,4)로 union 타입 일치.
- `fmt` 의존성: item.tsx 기존 정의 재사용(광고 인텔리전스 카드가 이미 사용) — Task8 Step6 주석에 명시.
- 멱등성: comments = onConflictDoNothing, commentKeywords = delete+insert(Task5).
