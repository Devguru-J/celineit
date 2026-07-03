// Cloudflare Workers 엔트리 (React Router SSR).
// 매 요청마다 Hyperdrive 연결 문자열로 요청별 DB 컨텍스트를 연 뒤 RR 핸들러에 위임한다.
import { createRequestHandler } from "react-router";
import { runWithDb } from "../app/lib/db.server";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env) {
    return runWithDb(env.HYPERDRIVE.connectionString, () => requestHandler(request));
  },
} satisfies ExportedHandler<Env>;
