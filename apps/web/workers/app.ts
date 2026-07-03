// Cloudflare Workers 엔트리 (React Router SSR).
// 매 요청마다 Hyperdrive 연결 문자열로 DB 를 초기화(멱등)한 뒤 RR 핸들러에 위임한다.
import { createRequestHandler } from "react-router";
import { initDb } from "../app/lib/db.server";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env) {
    // Hyperdrive 바인딩의 연결 문자열은 배포 단위로 고정 → initDb 는 최초 1회만 실제 연결 생성.
    // 로더는 db.server 의 모듈 싱글턴(getDb)을 쓰므로 RR load context 는 넘기지 않는다.
    initDb(env.HYPERDRIVE.connectionString);
    return requestHandler(request);
  },
} satisfies ExportedHandler<Env>;
