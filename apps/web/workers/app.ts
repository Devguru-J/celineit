// Cloudflare Workers 엔트리 (React Router SSR).
// 매 요청마다 Hyperdrive 연결 문자열로 요청별 DB 컨텍스트를 연 뒤 RR 핸들러에 위임한다.
import { createRequestHandler } from "react-router";
import { runWithSupabaseAuth } from "../app/lib/auth.server";
import { runWithCollector } from "../app/lib/collector.server";
import { runWithDb } from "../app/lib/db.server";
import { runWithWebshare } from "../app/lib/radar/proxy.server";
import { authGate } from "./auth-gate";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env) {
    // Supabase Auth 세션 게이트. RR 핸들러보다 먼저 — 미인증 요청은 DB 컨텍스트도
    // 열지 않고 끊는다. (SUPABASE_URL/SERVICE_KEY 미설정 시 게이트 off)
    const { block, setCookies } = await authGate(request, env);
    if (block) return block;
    // DB 와 수집기 바인딩을 요청 컨텍스트(AsyncLocalStorage)로 전달.
    // Service Binding(COLLECTOR)은 string 이 아니라 process.env 로는 못 읽으므로 여기서 넘긴다.
    let response = await runWithDb(env.HYPERDRIVE.connectionString, () =>
      runWithCollector(env.COLLECTOR, () =>
        runWithWebshare(env.WEBSHARE_API_KEY, () =>
          runWithSupabaseAuth(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, env.SIGNUP_CODE, () =>
            requestHandler(request),
          ),
        ),
      ),
    );
    // 게이트가 access token 을 재발급했으면 새 세션 쿠키를 응답에 부착한다.
    if (setCookies?.length) {
      response = new Response(response.body, response);
      for (const c of setCookies) response.headers.append("set-cookie", c);
    }
    return response;
  },
} satisfies ExportedHandler<Env>;
