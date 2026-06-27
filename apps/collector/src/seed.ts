// PoC 시드: 브랜드 1개 + 플랫폼 계정들을 등록한다.
// 아래 BRAND 를 원하는 경쟁사로 바꾼 뒤 실행:
//   DATABASE_URL=... npm run seed -w @celine/collector
import { brandAccounts, brands, createDb } from "@celine/db";
import type { Platform } from "@celine/shared";

// ── 여기를 편집하세요 ─────────────────────────────────
const BRAND = { name: "Jacquemus", slug: "jacquemus" };
const ACCOUNTS: { platform: Platform; handle: string; profileUrl?: string }[] = [
  { platform: "instagram", handle: "@jacquemus" },
  { platform: "twitter", handle: "@jacquemus" },
  { platform: "tiktok", handle: "@jacquemus" },
  // Meta 광고지면: Ad Library 페이지 URL 권장
  { platform: "meta_ads", handle: "Jacquemus", profileUrl: "https://www.facebook.com/ads/library/?view_all_page_id=PAGE_ID" },
];
// ──────────────────────────────────────────────────────

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL 환경변수가 필요합니다.");
  const db = createDb(databaseUrl);

  const [brand] = await db
    .insert(brands)
    .values(BRAND)
    .onConflictDoUpdate({ target: brands.slug, set: { name: BRAND.name } })
    .returning();

  for (const a of ACCOUNTS) {
    await db
      .insert(brandAccounts)
      .values({
        brandId: brand.id,
        platform: a.platform,
        handle: a.handle,
        profileUrl: a.profileUrl ?? null,
      })
      .onConflictDoNothing({
        target: [brandAccounts.brandId, brandAccounts.platform, brandAccounts.handle],
      });
  }

  console.log(`시드 완료: ${BRAND.name} (계정 ${ACCOUNTS.length}개). 이제 'npm run collect' 를 실행하세요.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
