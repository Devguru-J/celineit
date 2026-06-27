// 로컬 Node 러너 (PoC): Supabase 에 등록된 활성 계정을 수집한다.
//
// 사용:
//   DATABASE_URL=... APIFY_TOKEN=... npm run collect -w @celine/collector
//   옵션: --brand=<slug>  특정 브랜드만   --platform=<p>  특정 플랫폼만   --max=50
//
// actor override (선택): APIFY_ACTOR_META_ADS / _INSTAGRAM / _TWITTER / _TIKTOK
import { brandAccounts, brands, createDb } from "@celine/db";
import { ACTIVE_PLATFORMS, type Platform } from "@celine/shared";
import { and, eq } from "drizzle-orm";
import { ApifyClient } from "./apify";
import { collectAccount } from "./collect";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=").slice(1).join("=");
}

function actorOverride(platform: Platform): string | undefined {
  return process.env[`APIFY_ACTOR_${platform.toUpperCase()}`];
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const apifyToken = process.env.APIFY_TOKEN;
  if (!databaseUrl) throw new Error("DATABASE_URL 환경변수가 필요합니다.");
  if (!apifyToken) throw new Error("APIFY_TOKEN 환경변수가 필요합니다.");

  const db = createDb(databaseUrl);
  const apify = new ApifyClient(apifyToken);
  const today = new Date().toISOString().slice(0, 10);
  const max = Number(arg("max") ?? 50);

  const brandSlug = arg("brand");
  const onlyPlatform = arg("platform") as Platform | undefined;

  // 활성 계정 조회 (1차 대상 플랫폼만)
  const rows = await db
    .select({
      id: brandAccounts.id,
      platform: brandAccounts.platform,
      handle: brandAccounts.handle,
      profileUrl: brandAccounts.profileUrl,
      apifyInput: brandAccounts.apifyInput,
      brandSlug: brands.slug,
      brandName: brands.name,
    })
    .from(brandAccounts)
    .innerJoin(brands, eq(brandAccounts.brandId, brands.id))
    .where(eq(brandAccounts.isActive, true));

  const targets = rows.filter(
    (r) =>
      ACTIVE_PLATFORMS.includes(r.platform as Platform) &&
      (!brandSlug || r.brandSlug === brandSlug) &&
      (!onlyPlatform || r.platform === onlyPlatform),
  );

  if (targets.length === 0) {
    console.log("수집할 활성 계정이 없습니다. brand_accounts 에 행을 추가했는지 확인하세요.");
    return;
  }

  console.log(`수집 시작: ${targets.length}개 계정 (기준일 ${today})\n`);
  for (const t of targets) {
    process.stdout.write(`• ${t.brandName} / ${t.platform} (${t.handle}) … `);
    const res = await collectAccount(
      db,
      apify,
      {
        id: t.id,
        platform: t.platform as Platform,
        handle: t.handle,
        profileUrl: t.profileUrl,
        apifyInput: t.apifyInput as Record<string, unknown> | null,
      },
      { date: today, maxItems: max, actorOverride: actorOverride(t.platform as Platform) },
    );
    if (res.error) console.log(`실패: ${res.error}`);
    else
      console.log(
        `완료 (광고 ${res.stats?.adsUpserted ?? 0} · 포스트 ${res.stats?.postsUpserted ?? 0} · 비활성 ${res.stats?.adsInactivated ?? 0})`,
      );
  }
  console.log("\n끝. Celine 대시보드에서 결과를 확인하세요.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
