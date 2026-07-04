# X + TikTok 광고 수집 타당성 Spike — go/no-go 메모

- **작성일:** 2026-07-04
- **범위:** 일본 K-뷰티 경쟁사 5개(Anua / VT Cosmetics / medicube / manyo / aestura)의 유료 광고를 meta_ads 와 동일 경로(수집→정규화→적재→웹)로 수집 가능한지.
- **결론: X 광고·TikTok 광고 둘 다 NO-GO (일본 대상).** 근본 원인 동일 — 두 플랫폼의 광고 투명성 라이브러리가 **EEA(EU) 한정**이라 일본 게재 광고가 존재하지 않음. 일본 유료광고는 **Meta Ad Library 가 유일한 소스.**

## ⚠️ TikTok 광고 = EEA 한정 (2026-07-04 실측 확인)

`ivanvs~tiktok-ad-library-scraper` actor 로 실제 소액 실행하여 확인:

| region | adv_name | 결과 |
|---|---|---|
| JP | (없음, 넓게) | **0건** |
| JP | Anua / medicube | **0건** |
| DE (EEA) | (없음, 넓게) | 5건 |
| DE (EEA) | Anua | 5건 (단, 반환된 광고주는 "Shopify (USA) Inc." — adv_name 필터 부정확) |

- TikTok Ad Library(`library.tiktok.com`)는 사실상 **Commercial Content Library** = EEA DSA 대응. 일본 미포함.
- actor 자체는 정상 동작하며 출력은 풍부(`id`, `firstShownDate`/`lastShownDate`{date,timestamp}, `videos[].videoUrl`, `imageUrls[]`, `estimatedAudience`, `impression`, `advertiser{name,advBizId,registryLocation}`, `targeting`). 단 EEA 게재 광고에 한함.
- actor 입력은 플랜 가정과 다름: `{maxRecords, urls:[{url: "https://library.tiktok.com/ads?region=..&start_time=..&end_time=..&adv_name=..&sort_type=impression,desc"}]}`.
- adv_name 필터 부정확 → 정확 특정하려면 `adv_biz_ids`(advBizId) 필요.

**→ 일본 TikTok 경쟁정보는 "유료광고"가 아니라 "오가닉 게시글"로 수집한다.** 기존 오가닉 `tiktok` 어댑터(`clockworks~tiktok-scraper`, 글로벌 커버리지) 사용. `tiktok_ads` 스캐폴딩은 EEA 확장 시에만 의미.

---

## X 광고 (동일 결론)

- **결론: NO-GO (현시점).**

---

## 조사 결과

### 1. X 공식 광고 투명성 데이터

두 갈래가 있고 둘 다 우리 용도에 제약이 크다.

- **구 Ads Transparency Center** (`ads.twitter.com/transparency`)
  - 핸들 검색 → 해당 계정의 광고 크리에이티브 조회.
  - **최근 7일** 노출 광고만. 초기 US 정치/이슈 광고 중심, 국제 확장은 "검토 중"으로 명시된 채 남음.
  - 7일 롤링 윈도우는 우리 핵심 지표(광고 longevity = daysActive, firstSeen/lastSeen)를 만들 수 없음. Meta Ad Library 가 전체 게재 이력을 주는 것과 대조적.

- **현행 ads-repository** (`ads.twitter.com/ads-repository`, DSA 대응)
  - UI/API 로 계정·국가·기간 검색 → 비동기 **CSV export**.
  - API 흐름: `CreateExportReportMutation`(userId, geoLocation=국가코드, 기간) → `exportId` → `GetExportReportStatusQuery` 폴링 → CSV 다운로드.
  - **EU 게재 광고 중심**(DSA 의무). 일본(JP) 게재 광고가 포함되는지는 **미검증 · 낮은 신뢰도**. 우리 대상이 일본 시장이라 이게 결정적 리스크.

### 2. Apify actor 가용성

- X/Twitter 계열 actor 는 대부분 **키워드 기반 트윗 스크레이퍼**(예: `apidojo/tweet-scraper`, `fastcrawler/twitter-ads-scraper`).
- `fastcrawler/twitter-ads-scraper` 는 이름과 달리 입력이 **키워드+기간+인게이지먼트 필터**뿐 — 광고주/국가 필터 없음, 출력에 **랜딩 URL·게재일·활성여부·노출수 없음**. 광고 라이브러리가 아니라 트윗 검색기.
- 즉 TikTok Ad Library actor(`ivanvs~tiktok-ad-library-scraper`) 같은 **턴키 광고 라이브러리 actor 가 없다.**

### 3. 아키텍처 적합성

- 우리 어댑터 패턴은 "계정 1건 → Apify 동기 실행 → NormalizedAd[]" 다. X 공식 repository 는 **비동기 export(생성→폴링→다운로드)** 라 이 패턴에 바로 안 맞고, 게다가 인증(로그인 세션) 게이트가 있어 unofficial API 직접 호출은 취약.

---

## 판단

| 기준 | 상태 |
|---|---|
| 일본 게재 광고 커버리지 | ✗ 미검증/낮음 (7일 윈도우 또는 EU 한정) |
| longevity 지표(게재일·활성) 확보 | ✗ 7일 윈도우로 불가 |
| 턴키 수집 도구(Apify actor) | ✗ 광고 라이브러리 actor 부재 |
| 기존 어댑터 패턴 적합성 | ✗ 비동기 export + 인증 게이트 |

4개 기준 모두 부정적 → **NO-GO.** 투입 대비 데이터 가치(일본 뷰티 광고 실측 가능성)가 현저히 낮다.

## 재검토 트리거 (아래 중 하나라도 충족 시 재평가)

1. **수동 검증**: `ads.twitter.com/ads-repository` UI 에서 5개 브랜드 핸들 + region=JP 로 실제 광고 row 가 나오는지 1회 확인 → 나오면 커버리지 리스크 해소, 커스텀 CSV-export 클라이언트 착수 검토. (본 spike 는 headless 환경 제약으로 이 로그인/JS 게이트 UI 조회를 수행하지 못함 — 사용자 세션에서 확인 필요.)
2. TikTok Ad Library actor 처럼 **X 광고를 국가·광고주로 조회하는 Apify actor 가 등장**.
3. X 가 ads-repository 를 **비-EU(일본 포함)로 확장**하고 게재 이력(기간) 필드를 제공.

## 다음 액션 제안

- 지금은 X 를 백로그로 내리고 **TikTok 광고 수집 Task 4/6(실 수집 검증)** 에 크레딧/리소스를 집중.
- 트리거 1(수동 UI 확인)은 저비용이므로, 사용자가 로그인 세션에서 브랜드 1~2개만 조회해 커버리지를 한 번 찍어보는 것을 권장.
