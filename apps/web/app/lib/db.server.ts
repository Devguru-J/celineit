// 서버 전용 DB 접근 (.server.ts → 클라이언트 번들에서 제외).
// Workers 런타임에는 process.env·파일시스템이 없으므로, worker fetch 핸들러가
// 요청 시 Hyperdrive 연결 문자열로 initDb() 를 호출해 초기화한다.
import { createDb, type Database } from "@celine/db";

let _db: Database | null = null;

// worker 엔트리에서 호출 (멱등). 연결 문자열은 배포 단위로 고정.
export function initDb(connectionString: string): Database {
  if (!_db) _db = createDb(connectionString);
  return _db;
}

export function getDb(): Database {
  if (!_db) {
    const localConnectionString =
      typeof process !== "undefined"
        ? process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE ??
          process.env.WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE
        : undefined;

    if (localConnectionString) return initDb(localConnectionString);

    throw new Error("DB 미초기화 — worker fetch 핸들러에서 initDb() 를 먼저 호출해야 합니다.");
  }
  return _db;
}
