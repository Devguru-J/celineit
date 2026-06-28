// PoC 시드: L'Oréal 이 참고할 화장품(뷰티) 경쟁 브랜드 + 플랫폼 계정 등록.
//   DATABASE_URL=... npm run seed -w @celine/collector
import { brandAccounts, brands, createDb } from "@celine/db";
import type { Platform } from "@celine/shared";

// ── 모니터링할 뷰티 경쟁사 (편집 가능) ────────────────
type SeedBrand = {
  name: string;
  slug: string;
  accounts: { platform: Platform; handle: string; profileUrl?: string }[];
};

// 일본 시장 화장품 경쟁사 (L'Oréal Japan 기준). 핸들은 필요시 교체.
const SEED_BRANDS: SeedBrand[] = [
  {
    name: "資生堂 Shiseido",
    slug: "shiseido",
    accounts: [
      { platform: "instagram", handle: "@shiseido" },
      { platform: "twitter", handle: "@SHISEIDO_brand" },
      { platform: "tiktok", handle: "@shiseido" },
      {
        platform: "meta_ads",
        handle: "Shiseido",
        // Shiseido Group 資生堂 공식 페이지 ID (Meta Ad Library)
        profileUrl:
          "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=JP&view_all_page_id=548424035180811&media_type=all",
      },
    ],
  },
  {
    name: "SK-II",
    slug: "sk-ii",
    accounts: [
      { platform: "instagram", handle: "@skii" },
      { platform: "twitter", handle: "@SKII_Japan" },
      { platform: "tiktok", handle: "@skii_official_jp" },
      {
        platform: "meta_ads",
        handle: "SK-II",
        profileUrl:
          "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=JP&view_all_page_id=210782685643962&media_type=all",
      },
    ],
  },
  {
    name: "KATE TOKYO",
    slug: "kate-tokyo",
    accounts: [
      { platform: "instagram", handle: "@kate.tokyo.official_jp" },
      { platform: "twitter", handle: "@KATETOKYO_PR" },
      { platform: "tiktok", handle: "@kate.tokyo" },
    ],
  },
  {
    name: "CANMAKE TOKYO",
    slug: "canmake",
    accounts: [
      { platform: "instagram", handle: "@canmaketokyo" },
      { platform: "twitter", handle: "@CanmakeTokyo" },
      { platform: "tiktok", handle: "@canmaketokyo_official" },
      {
        platform: "meta_ads",
        handle: "CANMAKE",
        profileUrl:
          "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=JP&view_all_page_id=157974871060271&media_type=all",
      },
    ],
  },
  {
    name: "CEZANNE",
    slug: "cezanne",
    accounts: [
      { platform: "instagram", handle: "@cezannecosmetics" },
      { platform: "twitter", handle: "@cezannecosme" },
    ],
  },
];
// ──────────────────────────────────────────────────────

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL 환경변수가 필요합니다.");
  const db = createDb(databaseUrl);

  let accountCount = 0;
  for (const sb of SEED_BRANDS) {
    const [brand] = await db
      .insert(brands)
      .values({ name: sb.name, slug: sb.slug })
      .onConflictDoUpdate({ target: brands.slug, set: { name: sb.name } })
      .returning();

    for (const a of sb.accounts) {
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
      accountCount++;
    }
  }

  console.log(`시드 완료: 브랜드 ${SEED_BRANDS.length}개 / 계정 ${accountCount}개. 이제 'npm run collect' 를 실행하세요.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
