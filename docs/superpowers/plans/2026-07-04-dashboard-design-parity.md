# 대시보드 디자인 패리티 Implementation Plan

> **For agentic workers:** 화면별 Phase 로 실행. 각 Task 는 독립 검증 가능(typecheck+build). Steps 는 체크박스.

**Goal:** Stitch 디자인의 빠진 위젯을 기존 DB 데이터로 실제 동작하게 구현한다.

**Architecture:** `queries.server.ts` 에 신규 집계 쿼리 추가(스키마 변경 없음), 라우트 `.tsx` 확장, 신규 프리젠테이션 컴포넌트는 `components/` 에 분리. 한국어 UI + 기존 토큰 유지.

**Tech Stack:** React Router v7 SSR, Drizzle/Postgres, Tailwind, SVG 차트(자체).

## Global Constraints

- 스키마/마이그레이션 없음. 전부 기존 테이블.
- 데이터 없는 위젯(감성/광고비/도달/캠페인/투표/콘텐츠분류)은 **구현/노출 안 함**.
- 반응형: 모바일 390px 가로 오버플로 금지. 오프셋은 `lg:` 스코프. 아이콘 span 은 `notranslate` + `material-symbols-outlined`.
- 빈 데이터 graceful(차트/표 empty-state).
- 각 Phase 끝에서 `npm run typecheck -w @celine/web && npm run build -w @celine/web` 통과 후 커밋.
- 벤치마크 백분위: 카테고리(전 브랜드) `engagementRate30d` 분포 내 대상 계정 백분위 → 상위10% High / 10–50% Mid / else Low, 계정<3 이면 N/A.
- VIRAL/STABLE: 포스트 인게이지먼트(likes+comments+views) ≥ 계정 중앙값×3 → VIRAL, else STABLE. 임계값 상수.

---

## Phase 1 — Summary

**Files:**
- Modify: `apps/web/app/lib/queries.server.ts` (getSummary 확장 + 신규 쿼리)
- Modify: `apps/web/app/routes/summary.tsx`
- Modify: `apps/web/app/components/ui.tsx` (KpiDelta 배지, BarChart)

### Task 1.1: KPI 증감 배지

**Interfaces:**
- Produces: `getSummary()` 의 각 kpi 에 `delta?: { dir: "up"|"down"|"flat"; pct: number; label: string }` 추가.

- [ ] getSummary 에서 전주/전일 비교값 계산: 활성광고(어제 대비 adPresenceDaily), 7일 신규게시물(직전 7일 대비), 브랜드(전주 대비), 오늘수집(어제 대비). 각 kpi 에 `delta` 부여. 값 없으면 delta 생략.
- [ ] `ui.tsx` 에 `KpiDelta({ dir, pct, label })` — 화살표 아이콘(trending_up/down) + 색(emerald/rose/neutral) 배지.
- [ ] summary.tsx KPI 카드에 delta 렌더(디자인처럼 값 아래/옆).
- [ ] typecheck+build → 커밋 `feat(web): summary KPI delta badges`.

### Task 1.2: 팔로워 성장 카드

**Interfaces:**
- Produces: `getFollowerGrowth(): Promise<{ series: { date: string; total: number }[]; byPlatform: { platform: Platform; followers: number }[]; deltaPct: number | null }>`.

- [ ] `getFollowerGrowth()` 신규: `accountMetricsDaily.followers` 를 date 별 계정 합산(최근 N일) → series; 최신 date 의 플랫폼별 합 → byPlatform; (최신-최초)/최초 → deltaPct. 데이터 없으면 빈 series.
- [ ] `ui.tsx` 에 `BarChart({ data, height })` — LineChart 패턴의 SVG 막대 차트.
- [ ] summary.tsx 우측 패널의 "오늘의 흐름" 카드를 **팔로워 성장 카드**로 교체: BarChart(series) + 플랫폼별 팔로워 리스트 + 집계 델타 배지. series 비면 empty-state.
- [ ] loader 가 getFollowerGrowth 결과 포함하도록 summary loader 확장(getSummary 반환에 병합 또는 Promise.all).
- [ ] typecheck+build → 커밋 `feat(web): summary follower growth chart`.

### Task 1.3: 최근 변경 이벤트 타입화

**Interfaces:**
- Produces: `getRecentChanges(): Promise<{ id: string; kind: "new_ad"|"ad_inactive"|"follower_spike"|"new_post"; brand: string; platform: Platform; text: string|null; when: string; imageUrl: string|null; linkTo: string }[]>`.

- [ ] `getRecentChanges()` 신규: (a) 최근 firstSeen 신규 광고 → new_ad; (b) 최근 isActive=false 전환 광고(adPresenceDaily wasActive=false 최신) → ad_inactive; (c) accountMetricsDaily 팔로워 24h 급증(임계% 상수) → follower_spike; (d) 부족하면 최신 포스트 new_post 로 보충. 최신순 정렬 상위 6. 각 이벤트에 첫 미디어(firstMediaByOwner) 썸네일.
- [ ] summary.tsx 타임라인을 kind 별 아이콘/색 + 썸네일 + 링크로 렌더. kind→(아이콘,색,라벨) 매핑 상수.
- [ ] typecheck+build → 커밋 `feat(web): summary typed recent-changes timeline`.

---

## Phase 2 — Feed

**Files:** `queries.server.ts`(getFeed 확장 시 brand/format/date 지원), `routes/feed.tsx`, `components/feed-card.tsx`.

### Task 2.1: 필터 확장 (브랜드/포맷/기간)
- [ ] getFeed 가 brand(이름/slug), format, sinceDays 파라미터 없이도 전량 반환하되, FeedItem 에 `brand`,`format`,`date` 이미 존재 → **클라이언트 필터**로 브랜드/포맷/기간 추가(현재 platform/kind 방식과 동일 useMemo 확장).
- [ ] feed.tsx 필터바에 브랜드 select(브랜드 목록은 loader 에서 distinct), 포맷 토글(image/video/carousel), 기간 select(7/30/90일). 날짜 비교는 FeedItem.date.
- [ ] typecheck+build → 커밋.

### Task 2.2: 텍스트 인용 카드 + 캐러셀 인덱스
- [ ] feed-card.tsx: 미디어 없는 항목은 캡션 인용 스타일 카드. 캐러셀은 mediaAssets 개수 배지(1/N). 개수는 getFeed 에서 count 추가.
- [ ] typecheck+build → 커밋.

---

## Phase 3 — Trends

**Files:** `queries.server.ts`(getTrends 확장 + 벤치마크), `routes/trends.tsx`, `components/ui.tsx`(범위토글 라인차트, BarChart 재사용).

### Task 3.1: 평균 인게이지먼트% + 벤치마크
- [ ] getTrends 에 대상 계정 `engagementRate30d` 노출, 전 계정 분포로 백분위 계산(정의) → `{ engagementRate, percentile, band }`.
- [ ] trends.tsx 헤더에 평균 인게이지먼트% 카드 + 벤치마크 상태 카드(밴드+백분위 바).
- [ ] 커밋.

### Task 3.2: 범위 토글 라인차트 + 주간 바차트
- [ ] getTrends 가 7/30/90일 시계열 반환(또는 전량 후 클라 슬라이스) + 주간 인게이지먼트 집계(postMetricsDaily 주 단위).
- [ ] 라인차트에 7D/30D/90D 토글 + hover 툴팁(포인트 x좌표 기반). 주간 BarChart 추가.
- [ ] 커밋.

### Task 3.3: 성과 상위 포스트 테이블 + VIRAL/STABLE
- [ ] getTrends best posts 에 게시일/인게이지먼트/조회수 + status(VIRAL/STABLE 정의) 부여.
- [ ] trends.tsx 리스트를 테이블(게시일/인게이지먼트/조회수/상태 배지)로.
- [ ] 커밋.

---

## Phase 4 — Calendar

**Files:** `queries.server.ts`(getCalendar 확장), `routes/calendar.tsx`, `components/`(MonthHeatmap).

### Task 4.1: 월간 히트맵 그리드
- [ ] getCalendar 가 날짜→{count, platforms} 반환(기존) + 월 파라미터. 
- [ ] `MonthHeatmap` 컴포넌트: Mon–Sun 7열, 주 단위 행, 셀 강도(count), 플랫폼 점, Less→More 범례, 월 선택기.
- [ ] calendar.tsx 리스트를 히트맵으로 교체.
- [ ] 커밋.

### Task 4.2: 포맷 믹스 + 빈도 + 하단 벤토
- [ ] getCalendar 확장: posts.format 그룹 비율, 플랫폼별 주간 빈도, 총게시(MTD)/평균 일일 케이던스/피크시간(postedAt hour). 
- [ ] calendar.tsx 우측 포맷믹스 바 + 빈도 카드 + 하단 KPI 벤토(캠페인 제외) + 계산 기반 최적화 팁.
- [ ] 커밋.

---

## Phase 5 — Admin

**Files:** `routes/admin-runs.tsx`, `queries.server.ts`(getRuns 델타).

### Task 5.1: 자동 새로고침 + 델타 + 검색
- [ ] getRuns 에 전일 대비 런 수 델타 추가.
- [ ] admin-runs.tsx: `useRevalidator` + setInterval(45s) 폴링 + "N초 후" 표시; KPI 카드 델타/프로그레스바; 로그 검색 input(브랜드/플랫폼/에러 클라 필터).
- [ ] 커밋.

---

## Self-Review
- Spec 커버리지: 스펙 IN 항목 A~E 전부 Phase 1~5 에 매핑. OUT 항목은 미구현.
- 정의 필요한 지표(벤치마크/VIRAL)는 Global Constraints 에 상수 정의.
- 신규 인터페이스 시그니처는 각 Task Interfaces 에 명시.
