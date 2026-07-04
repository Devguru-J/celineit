# Cloudflare 배포 런북 (apps/web)

React Router v7 SSR 앱을 **Cloudflare Workers** 로 배포한다.
DB(Supabase Postgres)는 **Hyperdrive** 로 커넥션 풀링한다.

> ⚠️ **Pages 아님.** 스크린샷의 "Pages 셋업 화면(celineit.pages.dev)"은 다른 제품이다.
> 이 리포는 `@cloudflare/vite-plugin`(=Workers)로 설정돼 있어, Pages 로 붙이면 SSR 이
> 동작하지 않고 정적 파일만 서빙된다. 아래 Workers 경로 중 하나를 쓴다.

---

## 0. 사전 준비 (1회)

```bash
npx wrangler login        # 브라우저로 CF 계정 인증
```

## 1. Hyperdrive 생성 (1회) — DB 커넥션 풀

Supabase 대시보드 → Project Settings → Database → Connection string →
**Direct connection (port 5432)** URI 를 복사한다. (비밀번호 특수문자는 URL 인코딩)

```bash
npx wrangler hyperdrive create celine-db \
  --connection-string="postgresql://postgres:<PASSWORD>@db.hwndnkallorbypiedowm.supabase.co:5432/postgres"
```

출력된 `id` 를 `apps/web/wrangler.jsonc` 의 `hyperdrive[0].id` 에 기입한다:

```jsonc
"hyperdrive": [{ "binding": "HYPERDRIVE", "id": "여기에-생성된-id" }]
```

> Hyperdrive 는 무료 플랜 가능. 연결 문자열은 CF 에 저장되므로 리포에 평문으로 남지 않는다.

## 2. 배포

### 방법 A — CLI (가장 간단, 권장 시작점)

```bash
cd apps/web
npm run deploy          # = npm run build && wrangler deploy
```

배포 후 `https://celineit.<계정>.workers.dev` 로 확인.

### 방법 B — Git 자동 배포 (push 하면 자동 배포)

Cloudflare 대시보드 → **Workers & Pages → Create → Workers → Import a repository**
(Pages 가 아니라 **Workers** 쪽 "Connect to Git"). 빌드 설정:

| 필드 | 값 |
|---|---|
| Repository | `Devguru-J/celineit` |
| Production branch | `main` |
| Build command | `npm install && npm run build -w @celine/web` |
| Deploy command | `npx wrangler deploy --config apps/web/build/server/wrangler.json` |
| Root directory | `/` (비움 — npm workspaces 가 루트에서 `@celine/db` 를 해석) |

`wrangler.jsonc` 의 `HYPERDRIVE` 바인딩은 자동 인식된다(대시보드에서 따로 추가 불필요).

---

## 3. 로컬 dev (workerd 로 프로덕션과 동일 런타임)

```bash
cp apps/web/.dev.vars.example apps/web/.dev.vars   # 값 채우기 (비밀번호)
npm run dev -w @celine/web
```

`.dev.vars` 의 `WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` 로
로컬에서 Supabase 에 직접 연결한다(로컬엔 Hyperdrive 풀 없음).

---

## 환경변수 / 시크릿 정리

| 이름 | 어디서 | 비고 |
|---|---|---|
| DB 연결 | **Hyperdrive 바인딩** | 웹은 `DATABASE_URL` 대신 `env.HYPERDRIVE.connectionString` 사용 |
| `COLLECTOR_URL` | 웹 Worker var | 관리 화면의 수동 수집 버튼이 호출할 collector worker URL |
| `COLLECTOR_SECRET` | 웹 Worker secret | collector의 `MANUAL_COLLECT_SECRET` 과 같은 값 |
| `SUPABASE_URL/SERVICE_KEY/BUCKET` | (웹 불필요) | collector 전용. 웹 배포엔 안 씀 |

웹 앱의 대시보드 조회는 Hyperdrive 만 있으면 된다. 다만 **관리 → 수집 실행 현황**에서
수동 Apify 수집을 시작하려면 collector 연동 값도 필요하다:

```bash
cd apps/web
npx wrangler secret put COLLECTOR_SECRET
# COLLECTOR_URL 은 비밀이 아니므로 Cloudflare dashboard Variables 또는 wrangler.jsonc vars 로 설정
```

collector 쪽에는 같은 값을 별도 secret 으로 넣는다:

```bash
cd apps/collector
npx wrangler secret put MANUAL_COLLECT_SECRET
```

---

## 함정 체크리스트

- [ ] `compatibility_flags: ["nodejs_compat"]` — postgres.js(Node 소켓) 때문에 필수
- [ ] Supabase 는 **Direct connection(5432)** 사용 (Hyperdrive 가 앞단 풀링)
- [ ] 모노레포: Root directory 는 `/`, 빌드는 `-w @celine/web`
- [ ] `db.server.ts` 에서 `dotenv`/`process.env` 제거됨 (Workers 엔 없음)
- [ ] 수동 수집 사용 시 웹 `COLLECTOR_URL/COLLECTOR_SECRET` 과 collector `MANUAL_COLLECT_SECRET` 설정
- [ ] 배포 후 `/img` 프록시(이미지/영상 Range)와 게시물 상세를 실제로 열어 확인
- [ ] Worker 번들 크기: 무료 플랜 gzip 후 1MB 제한 (현재 여유 있음)
