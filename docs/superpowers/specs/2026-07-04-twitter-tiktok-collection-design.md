# TikTok 광고 수집 (+ X 타당성 spike) — 설계 문서

작성일: 2026-07-04
상태: 승인됨 (구현 플랜 대기)
비고: 최초 "twitter/tiktok 오가닉 활성화"로 시작했으나, 실제 목표가
**경쟁사 유료 광고 수집**임이 확인되어 광고 방향으로 전면 수정됨.

## 배경

Celine Intelligence 는 일본 뷰티 경쟁사를 매체별 어댑터로 수집한다. 현재 실제
"광고"를 가져오는 매체는 **meta_ads**(Facebook Ad Library) 하나뿐이다. Ad Library
는 경쟁사가 돌리는 유료 광고를 공개하는 투명성 DB라 가능하다.

`instagram`/`twitter`/`tiktok` 어댑터는 **오가닉(계정이 올린 일반 게시물)**을
가져오며, 광고가 아니다. 사용자의 목표는 "동일 회사들의 **다른 플랫폼 광고**"
수집이므로, 오가닉 어댑터는 이 목표에 맞지 않는다.

### 소스 리서치 결론 (2026-07-04)

- **TikTok**: 공개 Ad Library 존재. Apify 에 이를 긁는 actor 다수. **일본 포함
  50+ 개국** 지원, 광고주명/키워드/business ID 검색. 영상 URL·커버·노출
  buckets·spend·게재일 반환 → `NormalizedAd` 로 매핑 가능. **실현 가능.**
- **X(트위터)**: 광고 투명성 자료가 대부분 **EU DSA 규제 기반**이라 EU 타겟
  광고 위주. **일본 광고주 커버리지 불확실** — 일본 뷰티 브랜드 광고가 안 잡힐
  가능성이 큼. META 급의 안정 소스 없음.

## 목표

경쟁사의 **TikTok 유료 광고**를 meta_ads 와 동일하게 수집→정규화→적재→웹
노출까지 실제로 동작하게 만든다. X 광고는 타당성부터 확인한다.

## 방향 전환의 핵심

오가닉 어댑터(`tiktok.ts`/`twitter.ts`)가 아니라, **meta_ads 패턴을 따르는 광고
라이브러리 어댑터**를 만든다 — `normalize()` 가 `result.ads`(NormalizedAd)를
산출한다. 기존 오가닉 `tiktok`/`twitter` 어댑터는 제거하지 않고 그대로 두되
이번 범위에서 사용하지 않는다.

## 범위 (Phase 1) — TikTok 광고 어댑터

### 1. 새 매체 키 `tiktok_ads`

meta_ads 와 동일한 네이밍 규칙으로 광고 전용 매체 키를 신설한다. 오가닉
`tiktok` 키와 구분된다.

- `packages/db/schema.ts`: `platform` enum 에 `tiktok_ads` 추가 → 마이그레이션 생성.
- `packages/shared/index.ts`: `PLATFORMS`, `ACTIVE_PLATFORMS`,
  `DEFAULT_APIFY_ACTORS` 에 `tiktok_ads` 반영.

### 2. `adapters/tiktok-ads.ts` (신규)

- TikTok Ad Library Apify actor 사용 (기본 actor 는 `DEFAULT_APIFY_ACTORS`
  로 지정, 환경변수 override 가능). 구현 시 후보 actor 의 입력/출력 스키마를
  검증해 확정한다.
- `buildInput`: 일본 region + 브랜드 광고주명/키워드로 검색 (meta_ads 의
  `startUrls`/`q` 패턴 참고). `account.handle` 을 광고주/검색어로 사용.
- `normalize`: raw 광고 → `NormalizedAd`
  (`platformAdId`, `adCopy`, `format`, `destinationUrl`, `landingDomain`,
  `mediaUrls`, `seenActive`, `startDate`/`endDate`, `raw`). 방어적 파싱.
  노출/spend buckets 등 추가 지표는 당장 스키마에 없으므로 `raw` 에 보존한다.
- `adapters/index.ts` 에 등록.

### 3. seed 등록

- 5개 브랜드(Anua, VT Cosmetics, medicube, manyo, aestura)의 TikTok 광고주명을
  `seed.ts` 에 `tiktok_ads` 계정으로 추가. meta_ads 처럼 키워드 검색이면 핸들 =
  브랜드 검색어. 실제 광고주 표기는 리서치로 검증 후 확정, 사용자 확인.

### 4. 실제 출력 검증 & normalize 보정

- TikTok Ad Library actor 실제 출력 1건 확보 → 필드 매핑 검증 → 보정 →
  `test/fixtures/tiktok-ads.json` 을 실제 샘플로 만들고 `test/adapters.test.ts`
  에 기대값 추가.
- actor 실제 실행은 크레딧을 소비하므로 **실행 전 사용자 승인**. 승인 전까지는
  actor 공개 문서/샘플 스키마에 맞춰 둔다.

### 5. 웹 노출

- `apps/web/app/routes/feed.tsx` `PLATFORMS` 리스트에 `tiktok_ads` 추가.
- `apps/web/app/mock/data.ts` `PLATFORM_META` 에 `tiktok_ads` 라벨/아이콘/색 추가.
- `apps/web/app/routes/item.tsx` `platformLabel()` 에 `tiktok_ads` 반영.

### 6. End-to-end 검증

- (승인 시) `npm run collect` 1회 → `collection_runs` done → `ads`/
  `ad_presence_daily` 에 `tiktok_ads` 행 적재 확인.
- 웹 `/feed` 매체 필터에서 TikTok 광고 노출, 미디어/카피/랜딩 정상 확인.

## 범위 (Phase 2) — X 광고 타당성 spike

- 코드가 아닌 **조사**. 타임박스로 진행.
- 일본 뷰티 브랜드 광고가 X Ads Transparency/Repository 에서 실제로 조회되는지
  확인 (수동 조회 + 가능하면 Apify actor 샘플).
- 산출물: **go/no-go 판단 메모**. 데이터가 유의미하면 그때 `x_ads` 어댑터를
  별도 설계한다.

## 범위 밖

- twitter/tiktok **오가닉** 수집 (이번엔 안 함, 기존 어댑터 유지).
- 광고 **댓글** 수집 및 키워드 추출.
- 오가닉 `tiktok`/`twitter` 어댑터 제거 (YAGNI — 그대로 둠).

## 변경하지 않는 것

- `PlatformAdapter` 인터페이스, `collect.ts` 오케스트레이션, `ingest.ts`
  파이프라인 — 그대로. meta_ads 와 동일 경로로 `tiktok_ads` 가 흐른다.
- `NormalizedAd` 형태 — 유지 (buckets 는 raw 보존).

## 변경 파일 footprint

| 파일 | 변경 |
|---|---|
| `packages/db/src/schema.ts` + 마이그레이션 | `platform` enum 에 `tiktok_ads` |
| `packages/shared/src/index.ts` | `PLATFORMS`/`ACTIVE_PLATFORMS`/`DEFAULT_APIFY_ACTORS` |
| `apps/collector/src/adapters/tiktok-ads.ts` (신규) | 광고 어댑터 |
| `apps/collector/src/adapters/index.ts` | 어댑터 등록 |
| `apps/collector/src/seed.ts` | TikTok 광고주 등록 |
| `apps/collector/test/adapters.test.ts` + `test/fixtures/tiktok-ads.json` | 정규화 검증 |
| `apps/web/app/routes/feed.tsx` | 필터에 `tiktok_ads` |
| `apps/web/app/mock/data.ts` (PLATFORM_META) | 라벨/아이콘/색 |
| `apps/web/app/routes/item.tsx` | `platformLabel()` |

## 검증 기준 (Definition of Done)

- [ ] `platform` enum 마이그레이션 생성·적용.
- [ ] `tiktok-ads` 어댑터가 실제 샘플 fixture 기준 `npm run test -w @celine/collector` 통과.
- [ ] `seed.ts` 에 검증된 TikTok 광고주 등록, 사용자 확인.
- [ ] (승인 시) 실제 collect 1회에서 `tiktok_ads` run done, `ads` 적재 확인.
- [ ] 웹 `/feed` 에서 TikTok 광고 노출·필터 동작 확인.
- [ ] `npm run typecheck` 통과.
- [ ] X 광고 타당성 spike go/no-go 메모 작성.

## 열린 결정 (기본값 채택, 변경 가능)

1. TikTok 광고 우선, **X 는 spike 만** (기본값).
2. 매체 키 = **신규 `tiktok_ads`** (DB 마이그레이션, meta_ads 와 일관).
3. TikTok 광고주 핸들 → **에이전트 리서치 제안, 사용자 최종 확인**.
4. Apify 실제 실행 → **실행 전 사용자 승인**.
