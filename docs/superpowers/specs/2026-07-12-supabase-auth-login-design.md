# Supabase Auth 로그인 설계 (2026-07-12)

## 목적
접근 코드 게이트(단일 공유 코드)를 실제 계정 기반 로그인(이메일+비밀번호)으로 교체한다.
계정 관리 화면은 만들지 않는다 — Supabase 대시보드(Authentication)가 그 역할을 한다.

## 결정 사항 (사용자 확정)
- 인증 백엔드 = **Supabase Auth** (자체 users 테이블/해시 없음)
- 로그인 ID = **실제 이메일**
- 역할 구분 없음(전원 동일 권한). 필요 시 user metadata 로 확장.
- 로그인 화면 = 스플릿 레이아웃 (왼쪽 사진 패널 + 오른쪽 다크 폼 패널, HellermannTyton CRM 로그인 참조)

## 아키텍처

### 인증 플로우
1. `/login` (React Router 라우트) — 이메일+비밀번호 폼. action 이
   `POST {SUPABASE_URL}/auth/v1/token?grant_type=password` 를 호출(fetch, SDK 없음).
2. 성공 시 쿠키 2개 발급 (HttpOnly·Secure·SameSite=Lax·Path=/):
   - `sb_at` = access token(JWT, 1시간)
   - `sb_rt` = refresh token(30일)
3. 워커 게이트 `workers/auth-gate.ts` (기존 access-gate.ts 대체):
   - 매 요청 `sb_at` 를 **jose + 원격 JWKS**(`/auth/v1/.well-known/jwks.json`, ES256,
     isolate 캐시)로 로컬 검증. 네트워크 호출 없음.
   - 만료/부재 + `sb_rt` 있으면 `grant_type=refresh_token` 으로 조용히 재발급 →
     요청 통과 + 응답에 Set-Cookie 부착 (게이트가 `{block?, setCookies?}` 반환,
     app.ts 가 RR 응답에 append).
   - 미인증: HTML 내비게이션 → `/login?next=` 리다이렉트, fetch/API → 401.
   - 제외 경로: `/login`, `/logout`.
   - `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` 미설정 시 게이트 off (로컬 dev 편의).
4. `/logout` — 쿠키 삭제 후 `/login` 리다이렉트. 사이드바에 로그아웃 링크.

### 키/시크릿
- 웹 워커 secret: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (collector 와 동일 값).
  anon key 가 로컬에 없어 service key 를 서버 전용 apikey 로 사용 — 클라이언트에
  절대 노출되지 않음(워커 내부에서만 사용). 웹 워커는 이미 Hyperdrive 로 전체 DB
  접근 권한을 갖고 있어 위험 증가는 제한적.
- JWT 검증은 공개 JWKS 만 사용(시크릿 불필요). 프로젝트가 ES256 서명 키 사용 확인됨.
- 기존 `SITE_ACCESS_CODE` secret 및 access-gate.ts 는 제거.

### 계정 프로비저닝
- Supabase 대시보드 → Authentication → Add user (auto-confirm).
- 초기 계정은 Admin API(`POST /auth/v1/admin/users`, service key)로 생성 가능.
- ⚠️ **필수 설정: 대시보드에서 "Allow new users to sign up" OFF** — 켜져 있으면
  anon/publishable key 로 아무나 가입 가능. 코드에는 signup 경로를 만들지 않지만
  API 차원 차단은 이 설정이 담당.

## 로그인 화면 (스플릿 레이아웃)
- 좌측(≥lg 에서만 표시): K-뷰티 무드 사진 + 다크 오버레이, 골드 포인트의 헤드라인
  ("일본 K-뷰티 경쟁 인텔리전스"), 하단 캡션. 이미지는 `/public/login-hero.jpg`,
  없으면 차콜 그라디언트 폴백.
- 우측: 차콜(#171719) 패널, 로고 워드마크(Celine=골드), "로그인" 헤딩, 안내문,
  이메일/비밀번호 필드, 골드 CTA 버튼, 에러 문구, "계정 문의는 관리자에게" 헬프 박스.
- 디자인 토큰은 기존 앱(차콜+골드 #C8A45D, Pretendard) 재사용.

## 에러 처리
- 잘못된 자격증명(400 invalid_grant) → "이메일 또는 비밀번호가 올바르지 않습니다."
- Supabase 응답 실패/네트워크 → "로그인 처리에 실패했습니다. 잠시 후 다시 시도해 주세요."
- 무차별 대입은 Supabase Auth 자체 rate limit 에 위임.
- refresh 실패(만료/회수) → 쿠키 삭제 + /login 리다이렉트.

## 검증 계획 (배포 후 curl)
1. 미인증 `/` → 302 `/login`, 미인증 `/radar/api/*` → 401
2. 틀린 비밀번호 → 에러 문구 (401/400)
3. 정상 로그인 → 303 + sb_at/sb_rt 쿠키 → 쿠키로 `/` 200
4. sb_at 삭제 + sb_rt 만 → 자동 재발급(Set-Cookie) + 200
5. `/logout` → 쿠키 삭제 → `/` 다시 302

## 비범위 (YAGNI)
- 자가 가입, 비밀번호 재설정 메일 플로우(대시보드에서 수동 초기화), 역할/권한,
  세션 서버 저장, MFA.
