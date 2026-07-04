# TikTok Ad Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 경쟁사의 TikTok 유료 광고를 meta_ads 와 동일 경로로 수집→정규화→적재→웹 노출까지 실제 동작시킨다.

**Architecture:** meta_ads 패턴을 그대로 복제한다. 새 매체 키 `tiktok_ads` 를 도입하고, TikTok Ad Library Apify actor 출력을 `NormalizedAd` 로 정규화하는 `tiktok-ads` 어댑터를 추가한다. DB `posts` 계열이 아니라 `ads`/`ad_presence_daily` 로 흐른다. 오가닉 `tiktok`/`twitter` 어댑터는 건드리지 않는다.

**Tech Stack:** TypeScript, Drizzle ORM(Postgres), Apify REST, Vitest, React Router v7(web).

## Global Constraints

- 대상 국가: `TARGET_COUNTRY = "JP"` (일본). 광고 검색 region 기본값.
- 매체 키 네이밍: 광고 매체는 `<platform>_ads` (meta_ads 와 동일 규칙) → 신규 키 `tiktok_ads`.
- normalize 는 **방어적 파싱**: 필드는 여러 후보 키를 순서대로 시도(`pick(...)`), 누락/빈/null 에도 throw 하지 않는다.
- DB 스키마 신규 테이블 없음. 기존 `ads`/`ad_presence_daily` 재사용.
- Apify actor 실제 실행은 크레딧 소비 → **실행 단계는 사용자 승인 후**. 그 전까지 fixture 기반으로 진행.
- 커밋은 각 Task 끝에서. TDD: 실패 테스트 → 최소 구현 → 통과 → 커밋.
- `@celine/shared` 의 `PLATFORMS` 가 실제 대상의 단일 소스. DB enum 은 이를 포함해야 함.

---

## File Structure

- `packages/db/src/schema.ts` — `platform` enum 에 `tiktok_ads` 추가 (+ 생성된 마이그레이션 파일).
- `packages/shared/src/index.ts` — `PLATFORMS`/`ACTIVE_PLATFORMS`/`DEFAULT_APIFY_ACTORS` 반영.
- `apps/collector/src/adapters/tiktok-ads.ts` — 신규 광고 어댑터.
- `apps/collector/src/adapters/index.ts` — 어댑터 등록.
- `apps/collector/src/seed.ts` — TikTok 광고주 seed.
- `apps/collector/test/fixtures/tiktok-ads.json` — 정규화 테스트 입력(실제 샘플로 교체 예정).
- `apps/collector/test/adapters.test.ts` — `tiktok_ads` 정규화 검증.
- `apps/web/app/mock/data.ts` — `PLATFORM_META` 라벨/아이콘/색.
- `apps/web/app/routes/feed.tsx` — 매체 필터 리스트.
- `apps/web/app/routes/item.tsx` — `platformLabel()`.

---

### Task 1: `tiktok_ads` 매체 키를 shared + DB enum 에 추가

**Files:**
- Modify: `packages/shared/src/index.ts:3-22`
- Modify: `packages/db/src/schema.ts:19-24`
- Create: `packages/db/migrations/<generated>_*.sql` (drizzle-kit 생성)

**Interfaces:**
- Produces: `Platform` 유니온에 `"tiktok_ads"` 추가. `DEFAULT_APIFY_ACTORS["tiktok_ads"]` 존재.

- [ ] **Step 1: shared 상수에 `tiktok_ads` 추가**

`packages/shared/src/index.ts` 를 아래처럼 수정:

```ts
export const PLATFORMS = ["meta_ads", "instagram", "twitter", "tiktok", "tiktok_ads"] as const;
export type Platform = (typeof PLATFORMS)[number];

// 실수집 대상 매체 — 여기가 "원하는 매체" 단일 설정 지점.
export const ACTIVE_PLATFORMS: Platform[] = ["meta_ads", "instagram", "twitter", "tiktok", "tiktok_ads"];
```

그리고 `DEFAULT_APIFY_ACTORS` 에 항목 추가 (slug 는 구현 검증 단계에서 확정, 우선 후보값):

```ts
export const DEFAULT_APIFY_ACTORS: Record<Platform, string | null> = {
  meta_ads: "apify~facebook-ads-scraper",
  instagram: "apify~instagram-scraper",
  twitter: "apidojo~tweet-scraper",
  tiktok: "clockworks~tiktok-scraper",
  tiktok_ads: "ivanvs~tiktok-ad-library-scraper",
};
```

- [ ] **Step 2: DB enum 에 `tiktok_ads` 추가**

`packages/db/src/schema.ts` 의 `platformEnum`:

```ts
export const platformEnum = pgEnum("platform", [
  "meta_ads",
  "instagram",
  "twitter",
  "tiktok",
  "tiktok_ads",
  "bereal", // 미사용(수집 대상 아님). enum 값 제거는 마이그레이션 필요해 남겨둠 — @celine/shared PLATFORMS 가 실제 대상.
]);
```

- [ ] **Step 3: 마이그레이션 생성**

Run: `npm run generate -w @celine/db`
Expected: `packages/db/migrations/` 에 `ALTER TYPE "platform" ADD VALUE 'tiktok_ads'` 를 담은 새 `.sql` + 스냅샷 갱신. 출력에 새 마이그레이션 파일명이 표시된다.

- [ ] **Step 4: 타입 검증**

Run: `npm run typecheck`
Expected: PASS. (신규 Platform 키가 `DEFAULT_APIFY_ACTORS` Record 를 만족하므로 통과. 아직 `ADAPTERS` 에는 미등록이라 collector 타입체크에서 `Record<Platform, PlatformAdapter>` 누락 에러가 날 수 있음 — 그 경우 Task 3 완료 전까지 예상된 실패이며, 이 Step 은 shared/db 워크스페이스 기준으로 확인한다: `npm run typecheck -w @celine/shared` PASS.)

- [ ] **Step 5: 커밋**

```bash
git add packages/shared/src/index.ts packages/db/src/schema.ts packages/db/migrations
git commit -m "feat(shared,db): add tiktok_ads platform key + enum migration"
```

---

### Task 2: `tiktok-ads` 어댑터 정규화 (fixture 기반 TDD)

**Files:**
- Create: `apps/collector/src/adapters/tiktok-ads.ts`
- Create: `apps/collector/test/fixtures/tiktok-ads.json`
- Modify: `apps/collector/test/adapters.test.ts`

**Interfaces:**
- Consumes: `PlatformAdapter`, `pick`, `str`, `AccountInput` (`./types`); `NormalizedAd`, `NormalizedResult`, `emptyResult`, `landingDomainOf`, `TARGET_COUNTRY` (`@celine/shared`).
- Produces: `export const tiktokAdsAdapter: PlatformAdapter`.

- [ ] **Step 1: fixture 작성**

`apps/collector/test/fixtures/tiktok-ads.json` 생성. (TikTok Ad Library actor 의 대표 출력 형태를 방어적 파싱 대상으로 삼는 합성 샘플. Task 4 에서 실제 actor 출력으로 교체·기대값 갱신.)

```json
[
  {
    "id": "tt-ad-0001",
    "advertiser_name": "Anua Japan",
    "ad_text": "毛穴ケアはこれ一本。ドクダミトナー新登場。",
    "video_url": "https://p16-ad.tiktokcdn.com/anua-0001.mp4",
    "cover_image_url": "https://p16-ad.tiktokcdn.com/anua-0001-cover.jpg",
    "landing_page_url": "https://anua.jp/products/heartleaf-toner?utm_source=tiktok",
    "first_shown_date": "2026-06-01",
    "last_shown_date": "2026-06-28",
    "is_active": true,
    "unique_users_seen": "100k-1M"
  },
  {
    "id": "tt-ad-0002",
    "advertiser_name": "Anua Japan",
    "ad_text": "限定セール実施中",
    "image_url": "https://p16-ad.tiktokcdn.com/anua-0002.jpg",
    "link": "https://anua.jp/sale",
    "start_date": "2026-05-20",
    "end_date": "2026-06-10",
    "is_active": false
  },
  {}
]
```

- [ ] **Step 2: 실패 테스트 작성**

`apps/collector/test/adapters.test.ts` 상단 import 에 추가:

```ts
import ttAdsFixture from "./fixtures/tiktok-ads.json";
```

파일 하단(`방어적 파싱` describe 앞)에 describe 추가:

```ts
describe("tiktok-ads 어댑터", () => {
  const r = getAdapter("tiktok_ads").normalize(ttAdsFixture);

  it("광고 2건을 정규화한다 (빈 객체는 무시)", () => {
    expect(r.ads).toHaveLength(2);
    expect(r.posts).toHaveLength(0);
  });

  it("video/image 포맷을 추론한다", () => {
    const byId = Object.fromEntries(r.ads.map((a) => [a.platformAdId, a]));
    expect(byId["tt-ad-0001"].format).toBe("video");
    expect(byId["tt-ad-0002"].format).toBe("image");
  });

  it("landing domain 과 seenActive, 게재일을 추출한다", () => {
    const byId = Object.fromEntries(r.ads.map((a) => [a.platformAdId, a]));
    expect(byId["tt-ad-0001"].landingDomain).toBe("anua.jp");
    expect(byId["tt-ad-0001"].seenActive).toBe(true);
    expect(byId["tt-ad-0001"].startDate).toBe("2026-06-01");
    expect(byId["tt-ad-0002"].seenActive).toBe(false);
    expect(byId["tt-ad-0002"].endDate).toBe("2026-06-10");
    expect(byId["tt-ad-0001"].mediaUrls.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npm run test -w @celine/collector -- adapters`
Expected: FAIL — `getAdapter("tiktok_ads")` 가 `undefined` 이거나 (Task 3 미완) `ADAPTERS[tiktok_ads]` 없음으로 throw. 이 단계에서 실패가 맞다.

- [ ] **Step 4: 어댑터 구현**

`apps/collector/src/adapters/tiktok-ads.ts` 생성:

```ts
import {
  type NormalizedAd,
  type NormalizedResult,
  TARGET_COUNTRY,
  emptyResult,
  landingDomainOf,
} from "@celine/shared";
import { pick, str, type AccountInput, type PlatformAdapter } from "./types";

// TikTok Ad Library 스크래퍼.
// 입력: region + 광고주/키워드 검색. 출력: 광고별 텍스트/영상/커버/랜딩/게재일.
// 실제 actor 출력 필드명은 Task 4 에서 검증·보정한다(방어적 파싱).
export const tiktokAdsAdapter: PlatformAdapter = {
  platform: "tiktok_ads",
  defaultActor: "ivanvs~tiktok-ad-library-scraper",

  buildInput(account: AccountInput, opts) {
    const extra = (account.apifyInput ?? {}) as Record<string, unknown>;
    const region = (extra.region as string) ?? (extra.country as string) ?? TARGET_COUNTRY;
    return {
      // 광고주/브랜드명 검색. actor 마다 키가 다를 수 있어 흔한 후보를 함께 채운다.
      searchTerms: [account.handle],
      query: account.handle,
      region,
      countryCode: region,
      maxItems: opts.maxItems,
      count: opts.maxItems,
      ...extra,
    };
  },

  normalize(rawItems: unknown[]): NormalizedResult {
    const result = emptyResult();
    for (const item of rawItems) {
      const platformAdId = str(pick(item, "id", "ad_id", "adId", "adArchiveID"));
      if (!platformAdId) continue;

      const adCopy =
        str(pick(item, "ad_text", "adText", "caption", "text", "description")) ?? null;

      const linkUrl = str(pick(item, "landing_page_url", "landingPageUrl", "link", "url"));

      const mediaUrls: string[] = [];
      const cover = str(pick(item, "cover_image_url", "coverImageUrl", "cover", "image_url", "imageUrl"));
      if (cover) mediaUrls.push(cover);
      const video = str(pick(item, "video_url", "videoUrl"));
      if (video) mediaUrls.push(video);

      const format = video ? "video" : "image";

      const isActiveRaw = pick(item, "is_active", "isActive", "active");
      const seenActive = isActiveRaw === undefined ? true : Boolean(isActiveRaw);

      const startDate = isoDate(pick(item, "first_shown_date", "firstShownDate", "start_date", "startDate"));
      const endDate = isoDate(pick(item, "last_shown_date", "lastShownDate", "end_date", "endDate"));

      const ad: NormalizedAd = {
        platformAdId,
        adCopy,
        format,
        destinationUrl: linkUrl ?? null,
        landingDomain: landingDomainOf(linkUrl),
        mediaUrls,
        seenActive,
        startDate,
        endDate,
        raw: item,
      };
      result.ads.push(ad);
    }
    return result;
  },
};

function isoDate(v: unknown): string | null {
  return typeof v === "string" && v.length >= 10 ? v.slice(0, 10) : null;
}
```

(주의: 이 Step 만으로는 `getAdapter("tiktok_ads")` 가 아직 등록 전이라 테스트가 통과하지 않는다. Task 3 의 index 등록까지 마쳐야 GREEN 이 된다. Task 2 와 Task 3 는 한 커밋으로 묶어도 되지만, 아래 Step 5 에서 index 등록 후 통과를 확인한다.)

- [ ] **Step 5: index 등록 + 테스트 통과 확인**

`apps/collector/src/adapters/index.ts` 수정:

```ts
import type { Platform } from "@celine/shared";
import { instagramAdapter } from "./instagram";
import { metaAdsAdapter } from "./meta-ads";
import { tiktokAdapter } from "./tiktok";
import { tiktokAdsAdapter } from "./tiktok-ads";
import { twitterAdapter } from "./twitter";
import type { PlatformAdapter } from "./types";

export const ADAPTERS: Record<Platform, PlatformAdapter> = {
  meta_ads: metaAdsAdapter,
  instagram: instagramAdapter,
  twitter: twitterAdapter,
  tiktok: tiktokAdapter,
  tiktok_ads: tiktokAdsAdapter,
};
```

Run: `npm run test -w @celine/collector -- adapters`
Expected: PASS (`tiktok-ads 어댑터` describe 3개 it 모두 통과).

- [ ] **Step 6: 타입 검증**

Run: `npm run typecheck`
Expected: PASS (이제 `ADAPTERS` 가 모든 `Platform` 키를 채움).

- [ ] **Step 7: 커밋**

```bash
git add apps/collector/src/adapters/tiktok-ads.ts apps/collector/src/adapters/index.ts apps/collector/test/fixtures/tiktok-ads.json apps/collector/test/adapters.test.ts
git commit -m "feat(collector): add tiktok-ads adapter with normalize + fixture tests"
```

---

### Task 3: TikTok 광고주 seed 등록

**Files:**
- Modify: `apps/collector/src/seed.ts:15-52`

**Interfaces:**
- Consumes: `SeedBrand` 타입, `Platform` (`tiktok_ads`).

- [ ] **Step 1: seed 에 `tiktok_ads` 계정 추가**

각 브랜드 `accounts` 배열에 검증된 광고주명을 `tiktok_ads` 로 추가. (광고주명/키워드는 실제로는 리서치·사용자 확인으로 확정. 아래는 브랜드명 검색 기준 예시.)

```ts
const SEED_BRANDS: SeedBrand[] = [
  {
    name: "Anua アヌア",
    slug: "anua",
    accounts: [
      { platform: "instagram", handle: "@anua.jp" },
      { platform: "tiktok_ads", handle: "Anua" },
    ],
  },
  {
    name: "VT Cosmetics VTコスメティックス",
    slug: "vt-cosmetics",
    accounts: [
      { platform: "instagram", handle: "@vtcosmetics_japan" },
      { platform: "tiktok_ads", handle: "VT Cosmetics" },
    ],
  },
  {
    name: "medicube メディキューブ",
    slug: "medicube",
    accounts: [
      { platform: "instagram", handle: "@medicube_officialjapan" },
      { platform: "tiktok_ads", handle: "medicube" },
    ],
  },
  {
    name: "manyo マニョ",
    slug: "manyo",
    accounts: [
      { platform: "instagram", handle: "@manyo.japan" },
      { platform: "tiktok_ads", handle: "manyo" },
    ],
  },
  {
    name: "aestura エストラ",
    slug: "aestura",
    accounts: [
      { platform: "instagram", handle: "@aestura_jp" },
      { platform: "tiktok_ads", handle: "aestura" },
    ],
  },
];
```

- [ ] **Step 2: 타입 검증**

Run: `npm run typecheck -w @celine/collector`
Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
git add apps/collector/src/seed.ts
git commit -m "feat(collector): seed tiktok_ads advertisers for 5 brands"
```

---

### Task 4: 실제 Apify 출력 검증 & normalize 보정 (사용자 승인 필요)

**Files:**
- Modify: `apps/collector/test/fixtures/tiktok-ads.json` (실제 샘플로 교체)
- Modify: `apps/collector/src/adapters/tiktok-ads.ts` (필드 매핑 보정, 필요 시)
- Modify: `apps/collector/test/adapters.test.ts` (기대값 갱신, 필요 시)
- Modify: `packages/shared/src/index.ts` (actor slug 확정, 필요 시)

**Interfaces:** 변경 없음(내부 매핑 보정만).

- [ ] **Step 1: actor 확정 & 소액 실행 승인 요청**

사용자에게: 사용할 TikTok Ad Library actor slug 와 소액 크레딧 1회 실행 승인 확인. 승인 전에는 이 Task 를 진행하지 않는다.

- [ ] **Step 2: 실제 출력 1건 확보**

승인 후, 한 브랜드로 소량 실행하여 raw dataset 아이템을 저장:

```bash
set -a; . apps/collector/.dev.vars; set +a
curl -sS -X POST \
  "https://api.apify.com/v2/acts/ivanvs~tiktok-ad-library-scraper/run-sync-get-dataset-items?token=$APIFY_TOKEN&timeout=120" \
  -H "content-type: application/json" \
  -d '{"searchTerms":["Anua"],"region":"JP","maxItems":5}' \
  -o apps/collector/test/fixtures/tiktok-ads.raw.json
```

Expected: 광고 아이템 배열 JSON. (actor 마다 입력 키가 다르면 에러 메시지에 맞춰 입력 조정.)

- [ ] **Step 3: 필드 매핑 대조 & 보정**

`tiktok-ads.raw.json` 의 실제 키(광고 id/텍스트/영상/커버/랜딩/게재일/활성여부)를 확인하고, `tiktok-ads.ts` 의 `pick(...)` 후보 키 목록에 실제 키를 추가/정정한다. 대표 아이템 2~3건을 `test/fixtures/tiktok-ads.json` 으로 정리(민감정보/토큰 제거).

- [ ] **Step 4: 테스트 기대값 갱신 & 통과**

`adapters.test.ts` 의 `tiktok-ads` 기대값을 실제 샘플에 맞게 수정.

Run: `npm run test -w @celine/collector -- adapters`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git rm -f apps/collector/test/fixtures/tiktok-ads.raw.json 2>/dev/null || true
git add apps/collector/src/adapters/tiktok-ads.ts apps/collector/test/fixtures/tiktok-ads.json apps/collector/test/adapters.test.ts packages/shared/src/index.ts
git commit -m "fix(collector): align tiktok-ads normalize to real Apify output"
```

---

### Task 5: 웹 노출 (라벨·필터)

**Files:**
- Modify: `apps/web/app/mock/data.ts:11` (PLATFORM_META)
- Modify: `apps/web/app/routes/feed.tsx:17`
- Modify: `apps/web/app/routes/item.tsx:237` (platformLabel)

**Interfaces:** 없음(표시 계층).

- [ ] **Step 1: PLATFORM_META 에 `tiktok_ads` 추가**

`apps/web/app/mock/data.ts` 의 `PLATFORM_META` 객체에 항목 추가:

```ts
tiktok_ads: { label: "틱톡 광고", short: "TikTok Ads", icon: "ad_units", dot: "bg-[#000000]" },
```

- [ ] **Step 2: feed 필터 리스트에 추가**

`apps/web/app/routes/feed.tsx:17`:

```ts
const PLATFORMS: ("all" | Platform)[] = ["all", "meta_ads", "instagram", "twitter", "tiktok", "tiktok_ads"];
```

- [ ] **Step 3: platformLabel 반영**

`apps/web/app/routes/item.tsx` 의 `platformLabel()` 함수에 `tiktok_ads` 케이스 추가(기존 함수 구조에 맞춰 한 줄 매핑). 예:

```ts
function platformLabel(p: string): string {
  const map: Record<string, string> = {
    meta_ads: "메타 광고",
    instagram: "인스타그램",
    twitter: "X (트위터)",
    tiktok: "틱톡",
    tiktok_ads: "틱톡 광고",
  };
  return map[p] ?? p;
}
```

(실제 파일의 기존 구현이 switch/map 등 다른 형태면 그 형태를 유지한 채 `tiktok_ads` 케이스만 추가한다.)

- [ ] **Step 4: 타입 + 빌드 검증**

Run: `npm run typecheck -w @celine/web && npm run build -w @celine/web`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/app/mock/data.ts apps/web/app/routes/feed.tsx apps/web/app/routes/item.tsx
git commit -m "feat(web): surface tiktok_ads in feed filter and labels"
```

---

### Task 6: End-to-end 수집 검증 (사용자 승인 필요)

**Files:** 없음(런타임 검증). 매핑 문제 발견 시 Task 4 로 회귀.

- [ ] **Step 1: 마이그레이션 적용**

Run: `npm run migrate -w @celine/db` (DATABASE_URL 필요)
Expected: `tiktok_ads` enum 값이 DB 에 적용됨.

- [ ] **Step 2: seed 반영**

Run: `DATABASE_URL=... npm run seed -w @celine/collector`
Expected: `tiktok_ads` 계정이 brand_accounts 에 등록.

- [ ] **Step 3: collect 실행 (소액, 승인 후)**

Run: `npm run collect -w @celine/collector`
Expected: `collection_runs` 에 `platform=tiktok_ads`, `status=done` 행. `ads` 테이블에 tiktok_ads 광고 적재.

- [ ] **Step 4: 웹 확인**

Run: `npm run dev` → 브라우저 `/feed` 에서 "틱톡 광고" 필터 선택 → 광고 카드(카피/미디어/랜딩) 정상 노출 확인.

- [ ] **Step 5: 최종 typecheck**

Run: `npm run typecheck`
Expected: PASS.

---

### Task 7: X 광고 타당성 spike (코드 아님)

**Files:**
- Create: `docs/superpowers/specs/2026-07-04-x-ads-feasibility.md` (go/no-go 메모)

- [ ] **Step 1: 수동 조회**

X Ads Transparency/Repository 및 후보 Apify actor 로 일본 뷰티 브랜드(위 5개) 광고가 실제 조회되는지 확인.

- [ ] **Step 2: 판단 메모 작성**

데이터 유무·품질·커버리지를 요약하고 go/no-go 결론과 (go 시) 다음 설계 방향을 `docs/superpowers/specs/2026-07-04-x-ads-feasibility.md` 에 기록.

- [ ] **Step 3: 커밋**

```bash
git add docs/superpowers/specs/2026-07-04-x-ads-feasibility.md
git commit -m "docs: X ads feasibility spike go/no-go memo"
```

---

## Self-Review 결과

- **Spec coverage:** 매체 키(Task1), 어댑터+정규화(Task2), seed(Task3), 실출력 검증(Task4), 웹 노출(Task5), E2E(Task6), X spike(Task7) — 스펙 DoD 전 항목 매핑됨.
- **Placeholder scan:** 코드 스텝 모두 실제 코드 포함. actor slug/광고주명/실필드는 Task4 검증 스텝에서 확정하도록 명시(플레이스홀더 아님, 검증 절차).
- **Type consistency:** `tiktokAdsAdapter`, `getAdapter("tiktok_ads")`, `Platform` 유니온, `NormalizedAd` 필드명 일관.
