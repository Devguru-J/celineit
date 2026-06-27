# 수집 파이프라인 런북 (PoC → 운영)

Celine 수집기를 실제 데이터에 연결하는 단계별 가이드.
수집 로직(어댑터·적재)은 이미 구현·테스트 완료(18 tests). **이제 외부 계정/키만 연결하면 실제 데이터가 들어옵니다.**

핵심 구조: 어댑터·적재는 환경 비종속 순수 TS → **로컬 Node 러너(PoC)** 와 **Cloudflare Worker(운영)** 두 진입점이 같은 로직을 공유.

---

## A. PoC (로컬에서 실제 데이터 1회 수집) — 먼저 이것부터

### 1. Supabase 프로젝트 + 스키마
1. https://supabase.com → New project 생성
2. Project Settings → Database → Connection string(URI) 복사 → `DATABASE_URL`
3. 스키마 적용:
   ```bash
   DATABASE_URL="postgresql://postgres:[PW]@db.[REF].supabase.co:5432/postgres" \
     npm run push -w @celine/db
   ```
   (또는 `npm run migrate -w @celine/db` — 생성된 `packages/db/migrations` 적용)

### 2. Apify 계정 + 토큰
1. https://apify.com 가입 (무료 크레딧 있음)
2. Console → Settings → Integrations → **API token** 복사 → `APIFY_TOKEN`
3. 사용할 actor 확인(기본값, 필요시 `.dev.vars`에서 override):
   | 플랫폼 | 기본 actor |
   |---|---|
   | Meta 광고 | `curious_coder~facebook-ads-library-scraper` |
   | Instagram | `apify~instagram-scraper` |
   | Twitter/X | `apidojo~tweet-scraper` |
   | TikTok | `clockworks~tiktok-scraper` |
   > actor 단가·입력 스키마는 Apify Store 페이지에서 확인. 유료 actor는 첫 실행 전 단가 확인 권장.

### 3. 환경변수
```bash
cd apps/collector
cp .dev.vars.example .dev.vars   # DATABASE_URL, APIFY_TOKEN 채우기
```
러너는 `.dev.vars` 가 아닌 셸 환경변수를 읽으므로, 아래처럼 export 하거나 `dotenv`로 로드:
```bash
export $(grep -v '^#' apps/collector/.dev.vars | xargs)
```

### 4. 브랜드 등록(시드)
`apps/collector/src/seed.ts` 상단의 `BRAND`·`ACCOUNTS`를 원하는 경쟁사로 편집 후:
```bash
npm run seed -w @celine/collector
```
- Meta 광고지면은 `profileUrl`에 **Ad Library 페이지 URL**(`view_all_page_id=...`)을 넣는 게 가장 정확.

### 5. 수집 실행 🚀
```bash
npm run collect -w @celine/collector
# 특정 브랜드/플랫폼만: -- --brand=jacquemus --platform=instagram --max=30
```
→ `brands / brand_accounts / ads / posts / *_metrics_daily / collection_runs` 에 실제 행이 쌓입니다.

### 6. 확인
Supabase Table editor 또는 SQL로 `ads`, `posts`, `account_metrics_daily` 확인.
다음 단계: 웹 대시보드의 목 데이터를 이 테이블 loader로 교체(아래 C).

---

## B. 운영 (Cloudflare Worker 자동 수집)

매일 03:00 UTC Cron → Queue → 계정별 수집.

```bash
cd apps/collector
# 1) Hyperdrive: Workers에서 Supabase Postgres 접속
npx wrangler hyperdrive create celine-db \
  --connection-string="postgresql://postgres:[PW]@db.[REF].supabase.co:5432/postgres"
#   → 출력된 id 를 wrangler.toml 의 HYPERDRIVE id 에 입력

# 2) Queue 생성
npx wrangler queues create celine-collect
npx wrangler queues create celine-collect-dlq

# 3) 시크릿 주입
npx wrangler secret put APIFY_TOKEN

# 4) 배포
npm run deploy -w @celine/collector
```
- Cron 주기는 `wrangler.toml` `[triggers].crons` 에서 조정.
- 격일 플랫폼은 `brand_accounts.collect_cadence='every_2d'` (현재 worker는 짝수일 수집; 추후 정교화).

---

## C. 웹 대시보드 → 실데이터 연결 (다음 작업)

`apps/web` 의 각 route loader에서 `@celine/db` 의 `createDb(env.DATABASE_URL)` 로
`ads`/`posts`/`account_metrics_daily` 를 조회해 `app/mock/data.ts` 를 대체.
스키마 형태가 목 데이터와 일치하도록 설계되어 있어 교체 비용이 작음.

---

## 주의 / 비용
- 소셜 스크래퍼는 보통 **결과 건당 과금**. 브랜드 ~20개 매일 기준 월 $80~250 추정(스펙 §8).
- 플랫폼 ToS·로봇 정책 변동 가능 → actor 출력 포맷이 바뀌면 `test/fixtures` 갱신 후 어댑터 수정.
- **BeReal**: 데이터 소스 부재로 1차 제외(`bereal` 어댑터는 자리만 존재). 소스 생기면 `buildInput/normalize`만 채우면 됨.
