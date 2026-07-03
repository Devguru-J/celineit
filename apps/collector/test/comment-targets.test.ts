import { brandAccounts, brands, posts as postsTable } from "@celine/db";
import { createTestDb } from "@celine/db/testing";
import { beforeEach, expect, it } from "vitest";
import { selectCommentTargets } from "../src/comment-targets";

let db: Awaited<ReturnType<typeof createTestDb>>["db"];

beforeEach(async () => {
  ({ db } = await createTestDb());
});

async function seedPost(opts: { slug: string; handle: string; isActive: boolean; postId: string }) {
  const [brand] = await db
    .insert(brands)
    .values({ name: opts.slug, slug: opts.slug })
    .returning();
  const [acct] = await db
    .insert(brandAccounts)
    .values({ brandId: brand.id, platform: "instagram", handle: opts.handle, isActive: opts.isActive })
    .returning();
  await db
    .insert(postsTable)
    .values({ brandAccountId: acct.id, platformPostId: opts.postId })
    .returning();
}

it("활성 계정의 게시물만 댓글 대상으로 선택한다 (비활성 계정 게시물 제외)", async () => {
  await seedPost({ slug: "active-brand", handle: "@active", isActive: true, postId: "P-ACTIVE" });
  await seedPost({ slug: "old-brand", handle: "@old", isActive: false, postId: "P-OLD" });

  const targets = await selectCommentTargets(db);

  expect(targets.map((t) => t.platformPostId)).toEqual(["P-ACTIVE"]);
});

it("brandSlug 필터가 지정되면 해당 브랜드만 선택한다", async () => {
  await seedPost({ slug: "anua", handle: "@anua", isActive: true, postId: "P-ANUA" });
  await seedPost({ slug: "manyo", handle: "@manyo", isActive: true, postId: "P-MANYO" });

  const targets = await selectCommentTargets(db, { brandSlug: "anua" });

  expect(targets.map((t) => t.platformPostId)).toEqual(["P-ANUA"]);
});
