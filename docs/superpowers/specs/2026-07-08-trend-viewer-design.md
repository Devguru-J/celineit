# 트렌드 뷰어 (Trend Radar) — 이식 설계

작성일: 2026-07-08
경로: `/radar` · 사이드바 라벨 "트렌드 뷰어" · 아이콘 `radar`

## 1. 목적

`reference/trend-viewer`(누군가 AI로 만든 로컬 Python 서버 + 단일 HTML)의 기능을
우리 사이트(React Router 7 on Cloudflare Workers)에 **동작이 정확히 일치하도록** 이식한다.
디자인은 우리 톤앤매너(차콜 사이드바 + 골드 #C8A45D, Pretendard, Material Symbols,
`~/components/ui` 카드)로 재구성한다. 좌측 메뉴에 항목 1개, 페이지 1개.

## 2. 레퍼런스 동작 명세 (그대로 재현할 대상)

단일 페이지 안에서 7개 탭을 클라이언트 전환. 헤더에 유튜브 검색창 · 새로고침 버튼 ·
"업데이트: HH:MM:SS" 타임스탬프. 서버는 1시간 캐시, `?force=1`로 강제 갱신.

### 2.1 탭별 데이터 소스 (모두 API 키 없이 무인증 내부 API)

| 탭 | 엔드포인트 | 소스 & 로직 |
|---|---|---|
| ▶ 유튜브 | `/api/videos` | `youtubei/v1/search` POST. `params`=protobuf base64(정렬=조회수(3), 업로드날짜 필터 2/3/4, 동영상타입). `videoRenderer` 재귀 수집 → id 중복제거 → 기간 텍스트("N일 전") 필터. 카테고리=검색어 매핑, "전체"=6개 카테고리 병합, "AI"=AI 전용 쿼리 4개. 좋아요는 `enrich=1`일 때 영상별 `youtubei/v1/next` 정규식 파싱으로 보강(병렬 12) |
| ⚡ 쇼츠 | `/api/videos?shorts=1` | 위와 동일 + protobuf에 "4분 미만" 필터 추가 |
| 🤖 AI 영상 | `/api/ai` | HuggingFace `api/models?pipeline_tag=text-to-video\|image-to-video&sort=createdAt\|trendingScore` → latest/trending. + Google News RSS(국내 ko-KR, 해외 en-US) XML 파싱, pubDate 최신순 40개 |
| 📸 릴스 | `/api/reels` | Instagram `api/v1/users/web_profile_info/?username=` (헤더 `x-ig-app-id`). is_video만, 계정별 최근 12개. 조회수순 기본 |
| 𝕏 트위터 | `/api/x` | `syndication.twitter.com/srv/timeline-profile/screen-name/<u>` HTML에서 `__NEXT_DATA__` 파싱 → timeline entries. favorite/reply/retweet/views |
| 🧵 스레드 | `/api/threads` | 프로필 페이지에서 LSD 토큰 + IG API에서 user_id → `threads.com/api/graphql` `doc_id` 후보 순회. 실패 시 계정 바로가기 그리드 폴백 |
| 🎵 틱톡 | `/api/tiktok` | tikwm `feed/list?region=KR`(트렌딩) + `user/posts?unique_id=`(구독계정). id 중복제거 |

부가 엔드포인트: `/api/categories`(카테고리 목록), `/api/img`(CDN 프록시 — **우리 `/img`
라우트가 이미 존재**), `/api/oembed`(현재 UI에서 미사용 → 생략), `/api/{reels|x|threads|tiktok}/accounts`(POST 계정 추가/삭제).

### 2.2 프론트 동작

- **카테고리 칩**(유튜브/쇼츠만): 전체·AI·먹방·뷰티/패션·브이로그·예능/코미디·영화/드라마·테크/IT·지식/교육·여행·동물.
- **기간 세그먼트**(유튜브/쇼츠): 오늘/이번 주/이번 달.
- **접이식 정렬 메뉴**: 유튜브/쇼츠=조회수·좋아요 / 릴스·틱톡=조회수·좋아요·댓글 / X=좋아요·댓글·리트윗·조회 / 스레드=좋아요·댓글·리포스트. 선택 항목에 골드 ✓. 문서 클릭 시 닫힘. 좋아요순 첫 선택 시 유튜브는 서버 재요청(enrich).
- **검색**: 헤더 검색창 → 유튜브 임의 키워드 조회수순. 다른 탭이면 유튜브 탭으로 전환, 카테고리 클릭 시 검색 해제.
- **카드 랭크 배지** "N위"(상위 3개 강조), 활성 정렬 지표 골드 강조.
- **포맷**: `fmt2` = 억(1e8)/만(1e4)/천(1e3), `timeAgo` = 분/시간/일 전.
- **모달**: 유튜브 카드 클릭 → `youtube.com/embed` iframe 자동재생(쇼츠는 세로 9:16). 릴스/X/스레드/틱톡 카드 클릭 → 원문 새 탭.
- **계정 관리**(릴스/X/스레드/틱톡): 제거 가능한 "@계정 ✕" 칩 + 계정 추가 입력. 변경 시 해당 탭 강제 재로드.
- **스레드 폴백**: 글 0개면 계정 바로가기 카드 그리드 + 안내 문구.

## 3. 이식 아키텍처

### 3.1 라우팅 (React Router 7)

`apps/web/app/routes.ts`에 추가:

```
route("radar", "routes/radar.tsx"),                    // 페이지(탭 UI). loader에서 categories 반환
route("radar/api/videos", "routes/radar.api.videos.tsx"),   // 리소스 라우트(loader→JSON)
route("radar/api/ai", "routes/radar.api.ai.tsx"),
route("radar/api/reels", "routes/radar.api.reels.tsx"),
route("radar/api/x", "routes/radar.api.x.tsx"),
route("radar/api/threads", "routes/radar.api.threads.tsx"),
route("radar/api/tiktok", "routes/radar.api.tiktok.tsx"),
route("radar/api/accounts", "routes/radar.api.accounts.tsx"),  // GET 목록 / POST add·remove
```

이미지 프록시는 기존 `/img`(`routes/img.tsx`) 재사용 — 허용 호스트에 `*.ytimg.com`,
`*.googleusercontent.com` 추가.

### 3.2 서버 로직 위치

플랫폼별 fetch/파서를 `apps/web/app/lib/radar/*.server.ts`로 모듈 분리(브레인스토밍
"단위 격리" 원칙 — 파일 하나가 한 플랫폼을 담당):

```
lib/radar/youtube.server.ts   — protobuf 빌더, InnerTube 검색, videoRenderer 재귀, likes 보강
lib/radar/instagram.server.ts — reels(web_profile_info)
lib/radar/x.server.ts         — syndication __NEXT_DATA__ 파서
lib/radar/threads.server.ts   — LSD+user_id, doc_id 순회
lib/radar/tiktok.server.ts    — tikwm 트렌딩+user
lib/radar/ai.server.ts        — HF models + Google News RSS(XML은 정규식/경량 파서)
lib/radar/cache.server.ts     — Cloudflare Cache API 래퍼(1h TTL, force 우회)
lib/radar/accounts.server.ts  — trend_accounts 테이블 CRUD + 기본 계정 시드
lib/radar/format.ts           — fmt2, timeAgo, 상수(카테고리/기본계정)  ※클라 공용
```

- **동시성**: Python `ThreadPoolExecutor` → `Promise.all` / `Promise.allSettled`.
- **HTTP**: `urllib` → 표준 `fetch` (Workers). UA 헤더 동일 유지.
- **XML(RSS)**: 파이썬 `ElementTree` 대신 정규식 기반 경량 파서(의존성 0). `<item>` 블록에서
  title/link/source/pubDate 추출.
- **protobuf**: 파이썬 `bytes([...])` → `Uint8Array` + base64url 인코딩(동일 바이트 시퀀스).

### 3.3 캐시

Cloudflare **Cache API**(`caches.default`) 사용. 키 = 정규화된 요청 URL(계정목록·필터 반영).
TTL 3600s. `?force=1`이면 캐시 무시하고 재요청 후 갱신. 응답 JSON에 `fetchedAt`(초 단위 epoch) 포함.
(모듈 전역 메모리 캐시는 isolate 재활용으로 신뢰 불가 → 사용 안 함.)

### 3.4 계정 저장 — Postgres (공유)

`@celine/db` 스키마에 테이블 추가 + 마이그레이션 생성(`drizzle-kit generate`) + RLS 활성화:

```ts
export const trendAccountSourceEnum = pgEnum("trend_account_source",
  ["reels", "x", "threads", "tiktok"]);

export const trendAccounts = pgTable("trend_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: trendAccountSourceEnum("source").notNull(),
  username: text("username").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("trend_accounts_source_username_uniq").on(t.source, t.username)]);
```

- 조회 시 해당 source 행이 0개면 코드의 **기본 계정 목록으로 시드**(레퍼런스 DEFAULT_* 동일)
  후 반환 → 최초에도 레퍼런스와 동일한 기본값이 보인다.
- username 정규화: X는 대소문자 보존, 나머지는 소문자. `@`/공백 트림.
- 새 마이그레이션 SQL에 `ALTER TABLE "trend_accounts" ENABLE ROW LEVEL SECURITY;` 포함(기존 정책 준수).

### 3.5 프론트 컴포넌트

`routes/radar.tsx` 한 파일 + 하위 프레젠테이션 컴포넌트(`app/components/radar/*`):

```
components/radar/RadarTabs.tsx      — 7탭 바
components/radar/VideoGrid.tsx      — 16:9 카드(유튜브) / 9:16(쇼츠)
components/radar/VerticalGrid.tsx   — 릴스/틱톡 9:16 카드
components/radar/PostList.tsx       — X/스레드 포스트 카드
components/radar/AiPanel.tsx        — 모델 로우 2개 + 뉴스 리스트
components/radar/AccountManager.tsx — 계정 칩 + 추가 입력
components/radar/SortMenu.tsx       — 접이식 정렬 드롭다운
components/radar/PlayerModal.tsx    — 유튜브 임베드 모달
```

- 탭/필터/정렬 상태는 클라이언트 `useState`(레퍼런스와 동일한 UX). 데이터는 각 탭 진입 시
  `fetch('/radar/api/...')`로 지연 로드(레퍼런스와 동일). SSR loader는 페이지 셸 + categories만.
- 우리 디자인 토큰(Card, PlatformChip, MediaImage 등 `~/components/ui`)과 골드 액센트 사용.
- 이미지 `src`는 `/img?u=<encoded>`(기존 프록시).

## 4. Cloudflare 엣지 IP 리스크 (알려진 제약)

레퍼런스는 사용자 주거용 IP에서 실행된다. 우리는 CF 엣지에서 fetch → **인스타그램·틱톡이
데이터센터 IP를 차단/레이트리밋할 수 있다.** YouTube InnerTube / X syndication / HuggingFace /
Google News RSS는 대체로 정상 동작 예상. 대응: (1) 우선 그대로 포팅, (2) 실측 후 막히는
플랫폼은 캐시 TTL 상향·빈응답 시 명확한 안내 문구(레퍼런스도 동일한 "일시 제한" 문구 보유)로
graceful degrade. 스레드는 레퍼런스도 기본 폴백 상태이므로 동일하게 폴백 UI 제공.

## 5. 범위 밖 (YAGNI)

- `/api/oembed` — 현재 UI에서 미사용, 이식 안 함.
- 서버측 자동 새로고침 크론 — 레퍼런스에 없음(수동 새로고침 + 1h 캐시만).
- 인증/권한 — 기존 사이트가 내부 전용이라 페이지 레벨 인증 없음(동일 유지).

## 6. 검증 기준 (완료 정의)

1. `/radar` 진입 시 7탭 표시, 유튜브 탭 기본 로드.
2. 각 탭이 레퍼런스와 동일한 필드(조회수/좋아요/댓글 등)와 정렬 옵션으로 카드 렌더.
3. 카테고리·기간·정렬·검색·새로고침·계정 추가삭제가 레퍼런스와 동일하게 동작.
4. 계정 목록이 Postgres에 저장되어 새로고침/다른 브라우저에서도 공유됨.
5. 유튜브 모달 재생, 릴스/틱톡 썸네일이 `/img` 프록시로 표시됨.
6. `typecheck` / build 통과, 사이드바에 "트렌드 뷰어" 항목 노출.
