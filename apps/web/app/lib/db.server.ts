// 서버 전용 DB 접근 (.server.ts → 클라이언트 번들에서 제외).
// Workers 런타임에서는 요청별 I/O 객체를 다른 요청에서 재사용할 수 없으므로,
// Worker fetch 핸들러가 요청마다 DB 컨텍스트를 열어 loader 쪽으로 전달한다.
import { AsyncLocalStorage } from "node:async_hooks";
import { createDb, createDbWithClient, type Database } from "@celine/db";

const dbContext = new AsyncLocalStorage<Database>();
let localDb: { connectionString: string; db: Database } | null = null;

// 콜백이 끝나면 close() 로 연결을 반납한다. 호출측(워커)은 반환된 close 를
// ctx.waitUntil 에 넘겨 응답 전송을 막지 않고 정리한다.
export function runWithDb<T>(
  connectionString: string,
  callback: () => T,
): { result: T; close: () => Promise<void> } {
  const { db, close } = createDbWithClient(connectionString);
  return { result: dbContext.run(db, callback), close };
}

export function getDb(): Database {
  const requestDb = dbContext.getStore();
  if (requestDb) return requestDb;

  const localConnectionString =
    typeof process !== "undefined"
      ? process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE ??
        process.env.WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE
      : undefined;

  // 로컬 dev(요청 컨텍스트 없음)에서는 호출마다 새 풀을 만들지 않고 모듈 범위에 하나만 둔다.
  if (localConnectionString) {
    if (!localDb || localDb.connectionString !== localConnectionString) {
      localDb = { connectionString: localConnectionString, db: createDb(localConnectionString) };
    }
    return localDb.db;
  }

  throw new Error("DB 미초기화 — worker fetch 핸들러에서 runWithDb() 로 요청 컨텍스트를 먼저 열어야 합니다.");
}
