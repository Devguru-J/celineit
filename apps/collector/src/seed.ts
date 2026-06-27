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
      { platform: "twitter", handle: "@shiseido_corp" },
      { platform: "tiktok", handle: "@shiseido" },
    ],
  },
  {
    name: "SK-II",
    slug: "sk-ii",
    accounts: [
      { platform: "instagram", handle: "@skii" },
      { platform: "tiktok", handle: "@skii" },
    ],
  },
  {
    name: "KATE TOKYO",
    slug: "kate-tokyo",
    accounts: [
      { platform: "instagram", handle: "@kate.tokyo.official" },
      { platform: "tiktok", handle: "@kate.tokyo.official" },
    ],
  },
  {
    name: "CANMAKE TOKYO",
    slug: "canmake",
    accounts: [
      { platform: "instagram", handle: "@canmaketokyo" },
      { platform: "tiktok", handle: "@canmaketokyo" },
    ],
  },
  {
    name: "CEZANNE",
    slug: "cezanne",
    accounts: [{ platform: "instagram", handle: "@cezanne_official" }],
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
