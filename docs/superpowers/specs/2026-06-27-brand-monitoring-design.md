# Brand Insights Monitoring — 설계 문서

작성일: 2026-06-27
상태: 승인 대기 (구현 계획 작성 전 검토용)

## 1. 목적 / 범위

Snipit의 "Brand Insights Monitoring"을 벤치마킹한 **내부용 경쟁사 인텔리전스 툴**.
지정한 경쟁 브랜드들의 광고/콘텐츠를 플랫폼 전반에서 매일 수집·누적하고,
원본 포스트를 "전략 인사이트"로 가공한다.

- **사용자 유형**: A — 내부 툴. 외부 가입/과금/멀티테넌시 없음. 브랜드 목록은 내가 관리(5~50개).
- **관측 매체**: Meta 광고지면, Instagram, Twitter/X(필수), TikTok.
  - **BeReal 제외**: 공개/광고 표면이 없어 현실적 데이터 소스 부재. "추후 조사" 보류.
- **수집 방식**: 서드파티 스크래핑 API(**Apify**) 사용. 직접 브라우저/프록시 운영 안 함.
- **수집 주기**: 플랫폼별 차등.
  - Meta 광고지면, 계정 팔로워/지표: **매일** (longevity·추세 그래프에 일별 스냅샷 필수)
  - Twitter/TikTok 포스트: 매일~격일.

### 핵심 통찰
이 서비스의 정체는 "대시보드"가 아니라 **매일 도는 시계열 수집 파이프라인 + 스냅샷 누적 DB**다.
- "Winning Ads = longevity 기반" → 매일 광고지면 스냅샷으로 광고의 등장/소멸을 추적해야 활성일수 계산 가능.
- "팔로워 일별 추세 / 30일 평균 인게이지먼트" → 매일 지표 스냅샷 적재 필요.

UI는 그 위에 얹힌 얇은 층. 작업의 80%는 수집·적재·엔티티 통합에 있다.

## 2. MVP 기능 범위 (🟢)

수집 파이프라인이 깔리면 거의 공짜로 나오는 것들:
- 플랫폼별 **통합 피드** + 필터(게시일/활성상태/포맷/인게이지먼트)
- **팔로워 & 인게이지먼트 추세 그래프** (일별 스냅샷 → 라인차트)
- **포스팅 캘린더 / 운영 리듬**
- **광고 longevity = "Winning Ads"** (first_seen/last_seen/days_active)
- **운영 가시성** 화면: 최근 수집 성공/실패(`/admin/runs`)

### 차기 (스키마만 미리 준비)
- 🟡 2차: LLM 콘텐츠 자동 분류(메시지/포맷 유형), 유사 광고 클러스터링, 스폰서/인플루언서 탐지
- 🔴 3차: 랜딩페이지 버블차트, 제품별 광고 투자 분포

## 3. 아키텍처

```
Cloudflare Pages (React Router v7)  ── 읽기(Drizzle) ──▶ Supabase Postgres
        ▲                                                      ▲
        │                                                      │ 적재(upsert/append)
        │                                          Cloudflare Worker (collector)
        │                                            • Cron: 매일 Queue 발행
        │                                            • Queue Consumer: Apify 실행
        │                                            • Webhook: 결과 정규화·적재
        │                                            • 엔티티 통합/longevity 계산
   미디어 표시 ◀── Cloudflare R2 (미디어 사본) ◀── 미디어 복사
                                                       ▲ trigger / results
                                                    Apify (Meta/IG/Twitter/TikTok actors)
```

### 컴퓨트 결정
**Cloudflare Workers + Cron Triggers + Queues 채택.**
실제 스크래핑은 Apify가 수행하므로 Worker는 가벼운 트리거+적재만 담당 →
서버리스 실행시간 제한에 안 걸리고, 운영 서버 0대로 Cloudflare 풀스택 유지.

### 기술 스택
| 계층 | 선택 | 비고 |
|---|---|---|
| 프론트 호스팅 | Cloudflare Pages | 지정 |
| 프론트 프레임워크 | React Router v7 (Remix) | Cloudflare 네이티브 fit, loader에서 Drizzle 직접 호출 |
| DB | Supabase Postgres | 시계열·관계형 |
| ORM | Drizzle | 타입세이프, 서버리스 친화 |
| 수집 컴퓨트 | Cloudflare Workers (Cron+Queues) | |
| 미디어 저장 | Cloudflare R2 | egress 무료, Worker 직결 |
| 스크래핑 | Apify | 4개 플랫폼 actor + webhook |
| 차트 | Recharts (또는 visx) | 추세·캘린더 |
| 검증 | Zod | Apify 응답 파싱 |
| 디자인 | Google Stitch | 템플릿 → 컴포넌트 |
| 패키지 | pnpm workspace (모노레포) | |

## 4. 데이터 모델 (Drizzle/Postgres)

엔티티(본체, 잘 안 변함)와 스냅샷(매일 append, 시계열)을 분리한다.

```
brands                  id, name, slug, notes, created_at
brand_accounts          id, brand_id, platform(enum: meta_ads|instagram|twitter|tiktok),
                        handle, profile_url, apify_input(jsonb), is_active,
                        collect_cadence(enum: daily|every_2d)
collection_runs         id, brand_account_id, platform, apify_run_id,
                        status(running|done|error), item_count, started_at, finished_at, error

-- 엔티티 (upsert) --
ads                     id, brand_account_id, platform_ad_id(uniq), ad_copy,
                        format(image|video|carousel), destination_url, landing_domain,
                        first_seen, last_seen, is_active, days_active, raw(jsonb)
posts                   id, brand_account_id, platform_post_id(uniq), caption,
                        format, permalink, posted_at, raw(jsonb)
media_assets            id, owner_type(ad|post), owner_id, r2_key, original_url,
                        kind(image|video), sha256, width, height

-- 스냅샷 (append, 시계열) --
ad_presence_daily       ad_id, date, was_active                    PK(ad_id,date)
account_metrics_daily   brand_account_id, date, followers, following,
                        posts_count, engagement_rate_30d           PK(brand_account_id,date)
post_metrics_daily      post_id, date, likes, comments, views, shares, saves  PK(post_id,date)

-- 분류 (🟡 2차, MVP엔 비움) --
content_tags            id, owner_type, owner_id, message_type, format_type,
                        is_sponsored, confidence
```

### 기능 → 쿼리 매핑
| 기능 | 쿼리 |
|---|---|
| 통합 피드 + 필터 | `ads`/`posts` 조인 + 필터 컬럼 |
| Winning Ads | `ads.days_active` 정렬 / `ad_presence_daily` 집계 |
| 팔로워 추세 | `account_metrics_daily` 시계열 |
| 인게이지먼트 추세 | `post_metrics_daily` |
| 포스팅 캘린더 | `posts.posted_at` 날짜 집계 |

### 적재 로직 (Worker, 매일)
1. Apify 결과 수신 → 광고/포스트를 `platform_*_id`로 **upsert** (있으면 `last_seen` 갱신, 없으면 insert + `first_seen` 설정)
2. 오늘 본 광고 → `ad_presence_daily(was_active=true)` append, 안 보인 활성 광고 → `is_active=false`
3. `days_active` 재계산
4. 계정 지표 → `account_metrics_daily` append, 포스트 지표 → `post_metrics_daily` append
5. 새 미디어 URL → R2 복사 후 `media_assets` 기록 (sha256 dedup)

## 5. 수집 파이프라인 흐름

```
[매일 03:00 UTC] Cron Trigger
  └▶ 활성 brand_accounts 조회(오늘 주기 해당분) → Queue에 계정별 메시지 발행
Queue Consumer (계정 1개)
  ├ collection_runs insert(running)
  └ Apify actor 실행 (플랫폼 actor + webhook URL)
[Apify 스크래핑]
  └▶ 완료 시 우리 Webhook 호출
Webhook Handler
  ├ Apify dataset 결과 fetch → Zod 검증
  ├ 정규화(adapter) → upsert ads/posts
  ├ 스냅샷 append (presence/metrics)
  ├ days_active 재계산
  ├ 미디어 → R2 복사 → media_assets
  └ collection_runs update(done, item_count)
```

### 신뢰성
- **멱등성**: upsert + 스냅샷 (PK=대상+date) → 같은 날 재실행해도 중복/오염 없음.
- **부분 실패 격리**: 계정 단위 run → 1개 실패가 전체 차단 안 함.
- **Queue 재시도**: 지수 백오프, 최종 실패는 dead-letter.
- **누락 감지**: 어제 보였으나 오늘 안 보인 광고 → `is_active=false` (longevity 종료).
- **미디어 보존**: 원본 URL 만료 대비 R2 사본 필수, sha256 중복 방지.

### 어댑터 패턴
```ts
interface PlatformAdapter {
  apifyActorId: string
  buildInput(account): ApifyInput
  normalize(rawItems): { ads?, posts?, metrics? }
}
```
새 플랫폼(BeReal 등) 추가 = 어댑터 1개만 추가, 파이프라인 불변.

## 6. 프로젝트 구조 (pnpm 모노레포)

```
celineit/
├ apps/
│  ├ web/                  React Router v7 (Cloudflare Pages)
│  │  ├ app/routes/        대시보드, 피드, 브랜드별, 차트, /admin/runs
│  │  ├ app/components/    (Stitch 디자인 → 여기로)
│  │  ├ app/lib/
│  │  └ wrangler.toml
│  └ collector/           Cloudflare Worker
│     ├ src/cron.ts        매일 트리거 → Queue 발행
│     ├ src/consumer.ts    Queue 소비 → Apify 실행
│     ├ src/webhook.ts     Apify 완료 수신 → 적재
│     ├ src/adapters/      meta-ads.ts, instagram.ts, twitter.ts, tiktok.ts
│     ├ src/ingest.ts      upsert + 스냅샷 + longevity
│     ├ src/media.ts       R2 복사
│     └ wrangler.toml
├ packages/
│  ├ db/                   ⭐ 공유 Drizzle 스키마/마이그레이션/쿼리
│  └ shared/               타입, 플랫폼 enum, 상수
├ package.json             pnpm workspace
└ drizzle.config.ts
```

`packages/db`를 web·collector가 공유 → 스키마/쿼리 단일 관리.

## 7. 에러처리 / 테스트 전략

### 에러처리
- 계정 단위 격리 + `collection_runs.error` 기록.
- Queue 자동 재시도(백오프) → 최종 실패만 dead-letter.
- Apify 실패(차단/타임아웃): 실패 상태 webhook도 정상 처리, 다음 주기 자연 복구.
- `/admin/runs`에서 최근 수집 성공/실패 가시화.
- Apify 결과 Zod 파싱 후 적재 → 포맷 변경 조기 감지.

### 테스트 (TDD)
- **어댑터 단위 테스트**(최우선): Apify 응답 JSON 픽스처 → `normalize()` → 기대 엔티티.
- **적재 멱등성 테스트**: 2회 적재 → 중복 없음, `days_active` 정확.
- **longevity 테스트**: 등장→유지→소멸 시나리오로 first/last/days_active 검증.
- **통합 테스트**: 로컬/브랜치 Postgres 마이그레이션 → 가짜 webhook → DB 상태 확인.

## 8. 비용 (참고)

내부 툴, 브랜드 ~20개 기준 (Apify, 소셜 스크래퍼 결과 건당 대략 $0.5~$2/1,000건):
- 매일 수집: 월 약 $50 구독 + $150~$400 사용료
- 플랫폼별 차등(광고/팔로워만 매일)으로 절감 가능. 현실적 운영비 **월 $80~250 선**.
- 정확한 단가는 actor 선택 시점에 확정.

## 9. 후속 단계 (계획 이후)
- Google Stitch에서 디자인 템플릿 생성 → `apps/web/app/components`로 통합하는 프로젝트 맞춤 스크립트 작성.
