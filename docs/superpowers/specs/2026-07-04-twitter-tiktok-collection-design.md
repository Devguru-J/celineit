# Twitter/TikTok 실수집 활성화 — 설계 문서

작성일: 2026-07-04
상태: 승인됨 (구현 플랜 대기)

## 배경

Celine Intelligence 콜렉터는 일본 뷰티 경쟁사 광고/콘텐츠를 매체별 어댑터로
수집한다. 현재 실제로 검증되어 돌아가는 매체는 **meta_ads**(Ad Library 키워드
검색)와 **instagram**(오가닉 포스트 + 댓글 + 일본어 키워드 추출)뿐이다.

`twitter`, `tiktok` 어댑터는 **코드와 유닛테스트가 이미 존재**하지만:

- `apps/collector/src/seed.ts` 에 계정 핸들이 하나도 없다 — 한 번도 실행된 적 없음.
- 유닛테스트(`test/adapters.test.ts`)는 **손으로 만든 합성 fixture**
  (`test/fixtures/twitter.json`, `tiktok.json`)에 대해서만 통과 —
  실제 Apify actor 출력과 대조 검증이 안 됨.

seed.ts 주석이 이 확장을 예고해 둠:
> `// 이번 범위는 Instagram(댓글 수집 대상)만. TikTok/X 핸들은 후속 확장 시 검증 후 추가.`

이 작업은 그 "후속 확장"을 수행한다.

## 목표

twitter/tiktok을 IG/META와 동일하게 **수집 → 정규화 → 적재 → 웹 노출**까지
실제로 동작하게 만든다.

## 범위 (Phase 1)

### 1. 핸들 확보 & seed

- 기존 5개 브랜드(Anua, VT Cosmetics, medicube, manyo, aestura)의 **일본 공식
  X(트위터) / TikTok 계정**을 웹 리서치로 검증.
- 존재하지 않는 브랜드/플랫폼 조합은 건너뛴다(일부 브랜드는 X 또는 TikTok
  공식 계정이 없을 수 있음). 억지로 채우지 않는다.
- 검증된 핸들을 `seed.ts` 의 각 브랜드 `accounts` 배열에 추가.
- 핸들은 최종적으로 사용자 확인을 받는다.

### 2. 실제 출력 검증 & normalize 보정

- 각 어댑터의 `normalize()` 가 **진짜 Apify actor 출력**을 올바르게 파싱하는지
  검증한다. 대상 actor:
  - twitter: `apidojo~tweet-scraper`
  - tiktok: `clockworks~tiktok-scraper`
- 검증 방법: 실제 actor raw 출력 1건 확보 → 필드 매핑 점검 → 어긋나는 필드
  보정 → `test/fixtures/*.json` 을 **실제 샘플**로 교체하고 테스트 기대값 갱신.
- Apify actor 실제 실행은 크레딧을 소비하므로 **실행 전 사용자 승인**을 받는다.
  승인 전까지는 actor 공개 문서/샘플 출력 스키마에 최대한 맞춰 둔다.

### 3. End-to-end 검증

- `npm run collect` 실행 → `collection_runs` 가 `done` 으로 기록되는지 확인.
- `posts` / `post_metrics_daily` / `account_metrics_daily` 에 twitter/tiktok
  행이 적재되는지 확인.
- 웹 `/feed` 에서 매체 필터로 X/TikTok 콘텐츠가 노출되고 미디어/지표가
  깨지지 않는지 확인.

## 범위 밖 (Phase 2 — 나중에)

- twitter/tiktok **댓글 수집 + 일본어 키워드 추출**. 현재는 포스트 본문 + 지표
  (좋아요/댓글수/조회/공유/팔로워)만 수집한다. 댓글 파이프라인(IG의
  `collect-comments`, `comment-targets`, kuromoji 키워드)은 이번 범위 제외.

## 변경하지 않는 것

- **DB 스키마 변경 없음.** `platform` enum 에 `twitter`/`tiktok` 이 이미 존재하고,
  두 어댑터는 IG와 동일한 `NormalizedPost` 를 산출하므로 기존 `posts` 계열
  테이블을 그대로 재사용한다. 마이그레이션 불필요.
- `PlatformAdapter` 인터페이스, `collect.ts` 오케스트레이션, `ingest.ts`
  파이프라인은 그대로 둔다.
- `ACTIVE_PLATFORMS`, `PLATFORMS`, `DEFAULT_APIFY_ACTORS` 는 이미 4개 매체를
  포함하므로 수정 없음.

## 컴포넌트별 영향

| 유닛 | 역할 | 이번 변경 |
|---|---|---|
| `seed.ts` | 브랜드×계정 시드 | X/TikTok 핸들 추가 |
| `adapters/twitter.ts` | 트윗 raw→NormalizedPost | 실제 출력 대조 후 필드 매핑 보정(필요시) |
| `adapters/tiktok.ts` | 틱톡 raw→NormalizedPost | 위와 동일 |
| `test/fixtures/twitter.json`, `tiktok.json` | 테스트 입력 | 합성→실제 샘플로 교체 |
| `test/adapters.test.ts` | 정규화 검증 | 실제 샘플 기준으로 기대값 갱신 |

## 검증 기준 (Definition of Done)

- [ ] `seed.ts` 에 검증된 X/TikTok 핸들이 들어가고 사용자 확인 완료.
- [ ] `npm run test -w @celine/collector` 가 실제 샘플 fixture 기준으로 통과.
- [ ] (승인 시) 실제 collect 1회 실행에서 twitter/tiktok run 이 `done`,
      posts 적재 확인.
- [ ] 웹 `/feed` 에서 X/TikTok 콘텐츠 노출 확인.
- [ ] `npm run typecheck` 통과.

## 열린 결정 (기본값 채택, 변경 가능)

1. 댓글 수집 → **Phase 2로 후순위** (기본값).
2. 핸들 확보 → **에이전트가 리서치 제안, 사용자 최종 확인** (기본값).
3. Apify 실제 실행 → **실행 전 사용자 승인** (기본값).
