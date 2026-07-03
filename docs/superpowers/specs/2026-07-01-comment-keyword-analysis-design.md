# 댓글 키워드 Top 10 분석 — 설계 문서

작성일: 2026-07-01
상태: 승인됨 (사용자 확인)

## 목적

경쟁사 게시물에 달린 댓글의 **본문 텍스트**를 수집하고, 게시물별로 **가장 많이 등장한 키워드 Top 10**을 추출해 상세페이지에 보여준다. "이 크리에이티브가 소비자에게서 어떤 반응(구매/선물/후기 등)을 이끌어내는가"를 파악하기 위함.

## 배경 / 현재 상태

- 현재 어댑터(instagram-scraper 등)는 댓글 **개수(count)** 만 수집한다(`postMetricsDaily.comments`). **댓글 본문은 저장하지 않는다.**
- 따라서 (1) 댓글 본문 수집 (2) 저장 (3) 키워드 추출 이 세 가지가 신규로 필요하다.
- 댓글 본문 수집은 별도 Apify 액터가 필요 → 추가 비용. 2026-07-01 기준 Apify 무료 $5 한도 초과 상태라 **실제 수집은 유료 전환 후** 가능. 코드·스키마·테스트·목데이터는 지금 완성한다.

## 확정된 요구사항 (사용자 결정)

- **분석 방식**: (1) 빈도 순위 Top 10(발견) + (2) 집중 키워드 추적(지정 키워드가 몇 번 나왔는지). 둘 다. (카테고리 사전/LLM 아님)
- **집계 단위**: 개별 광고/게시물마다.
- **대상 매체**: Instagram 먼저(단계적). Meta 광고는 댓글 비공개라 원천 제외. TikTok/X는 후속 확장.
- **모니터링 대상 전면 교체**(2026-07-03): 기존 일본 브랜드(시세이도/SK-II/KATE/CANMAKE/CEZANNE) → **일본에서 잘나가는 K-뷰티 5개 브랜드**로 교체. 기존 수집 데이터는 DB에 보존(삭제 안 함), 앞으로 수집 대상에서만 제외.

### 신규 모니터링 대상 (K-뷰티, 일본 진출)
| 한국명 | 브랜드 | 일본 표기 | 비고 |
|--------|--------|-----------|------|
| 아누아 | Anua | アヌア | 사용자 표기 アムア는 오타 |
| VT코스메틱스 | VT Cosmetics | VTコスメティックス | |
| 메디큐브 | Medicube | メディキューブ | |
| 마녀공장 | Manyo Factory | マニョ | |
| 에스트라 | aestura | エストラ(추정) | 사용자 표기 アストラ, 실제 JP 표기 리서치 확인 필요 |

⚠️ 각 브랜드의 **실제 일본 IG 핸들은 웹 리서치로 확인** 후 seed.ts + DB brand_accounts에 반영(이전 일본 브랜드 정비와 동일 방식). Apify 차단 중이라 수집은 유료 전환 후.

### 집중 키워드 리스트 (댓글에서 주시)
`韓国コスメ` / `スキンケア` / `うるおい` / `水分ケア` / `毛穴` / `化粧水` / `化粧ノリ`

- `packages/shared`의 `FOCUS_KEYWORDS` 상수로 단일 관리(추가/수정 한 곳).
- 水分けあ(사용자 표기)는 `水分ケア`로 정정.

## 아키텍처

```
[기존 IG posts] ── permalink/shortcode
       │
       ▼
[신규] 댓글 수집 (Apify: instagram-comment-scraper)   게시물당 상위 N개 댓글 본문
       │
       ▼
[신규 테이블 comments] ── 댓글 본문 저장
       │
       ▼
[신규] 일본어 키워드 추출 (kuromoji 형태소 분석)   명사 위주 + 불용어/이모지/브랜드명 제거
       │
       ▼
[신규 테이블 comment_keywords] ── postId별 (키워드, 빈도)
       │
       ▼
[웹] 게시물 상세페이지 "댓글 키워드 Top 10" 카드
```

**핵심 원칙**: 키워드 추출은 수집 시점에 **미리 계산해 저장**(precompute)한다. 웹 로더에서 매 요청마다 일본어 형태소 분석(무거움)을 돌리지 않기 위함. 웹은 `comment_keywords`를 빈도순으로 읽어 상위 10개만 표시.

## 데이터 모델 (신규 테이블 2개 — 마이그레이션 필요)

### comments
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | uuid PK | |
| post_id | uuid FK→posts(cascade) | |
| platform_comment_id | text NOT NULL | |
| text | text | 댓글 본문 |
| like_count | integer | |
| author_handle | text | |
| posted_at | timestamptz | |
| raw | jsonb | 원본 |
| created_at | timestamptz default now | |

제약: `UNIQUE(post_id, platform_comment_id)` — 재수집 시 중복 방지(onConflictDoNothing 또는 update).

### comment_keywords
| 컬럼 | 타입 | 비고 |
|------|------|------|
| post_id | uuid FK→posts(cascade) | |
| keyword | text | 추출된 명사(top) 또는 집중 키워드(focus) |
| kind | text | `top` \| `focus` |
| count | integer | top=토큰 등장 횟수, focus=키워드 포함 댓글 수 |

제약: `PK(post_id, keyword, kind)`. 재계산 시 해당 post 행 **delete + insert**(멱등).

- `kind='top'`: kuromoji 토큰화 후 명사 빈도 상위 N개.
- `kind='focus'`: `FOCUS_KEYWORDS` 각각에 대해 **원문 부분일치(substring)** 로 카운트. 토크나이저에 의존하지 않음(`韓国コスメ`·`水分ケア` 같은 복합어가 토큰화로 쪼개져도 잡히도록). count=0인 focus 키워드도 저장(0 표시 위해) — 또는 0은 생략하고 웹에서 0 처리. → **0은 저장 생략, 웹에서 미언급 표시.**

`comments`에 본문 원본을 남겨 나중에 "특정 키워드 언급 게시물 검색"(검색 레이어 로드맵) 등 확장 가능.

## 일본어 키워드 추출

- **kuromoji**(JS 형태소 분석기, IPADIC 사전) 사용 → 품사 태깅으로 **명사(名詞)만** 추출. 조사·어미 자동 제거.
- 추가 필터:
  - 이모지·기호·URL·멘션(@)·해시태그 기호 제거
  - 1글자·숫자만 제거(최소 길이 2)
  - **불용어 사전**: こと/ため/これ/それ 등 일반 명사 + 대상 브랜드명 자체(시세이도/資生堂 등, 게시물이 속한 브랜드)
- 순수 함수로 분리: `extractKeywords(texts: string[], opts?): { keyword: string; count: number }[]` — 정렬은 count desc. 단위 테스트 대상.

### 집중 키워드 매칭
- 순수 함수 `countFocusKeywords(texts: string[], focus: string[]): { keyword: string; count: number }[]` — 각 focus 키워드에 대해 원문 부분일치(정규화: NFKC + 소문자)로 **포함 댓글 수** 카운트. 토크나이저 비의존.

## 수집 실행 (기존 흐름과 분리)

- 신규 커맨드: `npm run collect:comments -w @celine/collector [-- --brand=anua --max=50]`
- 동작: 대상 브랜드의 IG posts를 DB에서 읽음 → permalink로 instagram-comment-scraper 실행 → comments 적재 → 해당 post들 키워드 재계산 후 comment_keywords 갱신.
- 게시물당 댓글 수 기본 **50개**(비용 상수, 플래그로 조절).
- ⚠️ Apify 유료 전환 후 실행 가능. 전환 전에는 목데이터로 파이프라인 검증.

## 웹 UI

- 게시물 상세(`/item/post/:id`)에 카드 추가:
  - **"댓글 키워드 Top 10"**: 키워드 + 빈도(막대 시각화).
  - **"집중 키워드 언급"**: `FOCUS_KEYWORDS` 각각의 언급 댓글 수(0 포함 전체 리스트 표시, 언급된 것 강조). 발견(top)과 별개로 항상 고정 리스트로 노출.
- 데이터 없으면 카드 미표시(또는 "댓글 데이터 없음").
- 광고 상세(`/item/ad/:id`)는 댓글 비공개 → 카드 미표시.
- 한국어 UI 톤 유지.

## 테스트

- `extractKeywords` 단위 테스트: 일본어 샘플 댓글 → 명사 추출·조사/이모지/불용어 제거·브랜드명 제외·빈도 정렬 검증.
- `countFocusKeywords` 단위 테스트: `水分ケア`·`韓国コスメ` 등 복합어 부분일치, 정규화(전각/반각·대소문자), 미언급=0 검증.
- 댓글 ingest + 키워드 재계산 통합 테스트(pglite): comments 적재 → comment_keywords(top+focus) 멱등 재계산.
- 기존 collector 테스트 스위트 그린 유지.

## 범위 밖 (YAGNI)

- TikTok/X 댓글 수집(후속 확장 — 어댑터 인터페이스는 재사용 가능하게 하되 지금 구현 안 함).
- 감성분석/의도분류/LLM.
- 브랜드 단위 집계 뷰(개별 게시물 단위만).
- 키워드 추세(시계열) — 지금은 최신 스냅샷만.
