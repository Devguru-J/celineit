// Cloudflare Workers 엔트리 (React Router SSR).
// 매 요청마다 Hyperdrive 연결 문자열로 요청별 DB 컨텍스트를 연 뒤 RR 핸들러에 위임한다.
import { createRequestHandler } from "react-router";
import { runWithCollector } from "../app/lib/collector.server";
import { runWithDb } from "../app/lib/db.server";
import { runWithWebshare } from "../app/lib/radar/proxy.server";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env) {
    // DB 와 수집기 바인딩을 요청 컨텍스트(AsyncLocalStorage)로 전달.
    // Service Binding(COLLECTOR)은 string 이 아니라 process.env 로는 못 읽으므로 여기서 넘긴다.
    return runWithDb(env.HYPERDRIVE.connectionString, () =>
      runWithCollector(env.COLLECTOR, () =>
        runWithWebshare(env.WEBSHARE_API_KEY, () => requestHandler(request)),
      ),
    );
  },
} satisfies ExportedHandler<Env>;
