import { beforeAll, describe, expect, it } from "vitest";
import { comments as commentsT, commentKeywords, brandAccounts, brands, posts as postsT } from "@celine/db";
import { createTestDb } from "@celine/db/testing";
import { eq } from "drizzle-orm";
import { buildCommentInput, normalizeComments } from "../src/comments";
import { createTokenizer, type Tokenizer } from "../src/keywords";
import { ingestComments, recomputeCommentKeywords } from "../src/ingest-comments";

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
