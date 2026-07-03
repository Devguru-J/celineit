// 댓글 수집 대상 게시물 선택: 활성(isActive) 인스타그램 계정의 게시물만.
import { type Database, brandAccounts, brands, posts as postsT } from "@celine/db";
import { and, eq } from "drizzle-orm";

export type CommentTarget = {
  postId: string;
  permalink: string | null;
  platformPostId: string;
  brandName: string;
  brandSlug: string;
};

export async function selectCommentTargets(
  db: Database,
  opts: { brandSlug?: string } = {},
): Promise<CommentTarget[]> {
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
    .where(and(eq(brandAccounts.platform, "instagram"), eq(brandAccounts.isActive, true)));

  return rows.filter((r) => !opts.brandSlug || r.brandSlug === opts.brandSlug);
}
