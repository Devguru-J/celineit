// IG 댓글 수집 러너: 기존 instagram posts 를 순회하며 댓글 본문 수집 → 적재 → 키워드 재계산.
//   DATABASE_URL=... APIFY_TOKEN=... npm run collect:comments -w @celine/collector [-- --brand=anua --max=50]
import { brandAccounts, brands, createDb, posts as postsT } from "@celine/db";
import { eq } from "drizzle-orm";
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
