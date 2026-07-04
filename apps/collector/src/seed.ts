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
// 일본 시장 K-뷰티 경쟁사 (2026-07-03 대상 교체). 일본 공식 IG 계정(웹 리서치 검증, high confidence).
// 이번 범위는 Instagram(댓글 수집 대상)만. TikTok/X 핸들은 후속 확장 시 검증 후 추가.
const SEED_BRANDS: SeedBrand[] = [
  {
    name: "Anua アヌア",
    slug: "anua",
    accounts: [
      { platform: "meta_ads", handle: "Anua" }, // Meta Ad Library keyword search
      { platform: "instagram", handle: "@anua.jp" }, // Anua JAPAN OFFICIAL
      { platform: "tiktok", handle: "@anua.jp" }, // TikTok 오가닉 (핸들 실측 검증 2026-07-04)
      { platform: "twitter", handle: "@anua_official" }, // X 오가닉 (실측 검증)
    ],
  },
  {
    name: "VT Cosmetics VTコスメティックス",
    slug: "vt-cosmetics",
    accounts: [
      { platform: "meta_ads", handle: "VT Cosmetics" }, // Meta Ad Library keyword search
      { platform: "instagram", handle: "@vtcosmetics_japan" }, // VT JAPAN OFFICIAL
      { platform: "tiktok", handle: "@vtcosmetics_jp_official" }, // TikTok 오가닉 (실측 검증)
      { platform: "twitter", handle: "@vtcosmetics_jp" }, // X 오가닉 (실측 검증)
    ],
  },
  {
    name: "medicube メディキューブ",
    slug: "medicube",
    accounts: [
      { platform: "meta_ads", handle: "medicube" }, // Meta Ad Library keyword search
      { platform: "instagram", handle: "@medicube_officialjapan" }, // メディキューブ 公式
      { platform: "tiktok", handle: "@medicube_japan" }, // TikTok 오가닉 (실측 검증)
      { platform: "twitter", handle: "@medicube_japan" }, // X 오가닉 (실측 검증)
    ],
  },
  {
    name: "manyo マニョ",
    slug: "manyo",
    accounts: [
      { platform: "meta_ads", handle: "manyo" }, // Meta Ad Library keyword search
      { platform: "instagram", handle: "@manyo.japan" }, // manyo 日本公式
      { platform: "tiktok", handle: "@manyo.japan" }, // TikTok 오가닉 (실측 검증)
      { platform: "twitter", handle: "@manyojapan" }, // X 오가닉 (실측 검증)
    ],
  },
  {
    name: "aestura エストラ",
    slug: "aestura",
    accounts: [
      { platform: "meta_ads", handle: "AESTURA" }, // Meta Ad Library keyword search
      { platform: "instagram", handle: "@aestura_jp" }, // AESTURA JAPAN Official
      // TikTok 제외: 일본 공식 TikTok 계정 없음(2026-07-04 후보 핸들 전부 미존재 확인).
      { platform: "twitter", handle: "@Aestura_jp" }, // X 오가닉 (실측 검증)
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
