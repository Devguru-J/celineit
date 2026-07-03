// 서버 전용 DB 접근 (.server.ts → 클라이언트 번들에서 제외).
// Workers 런타임에서는 요청별 I/O 객체를 다른 요청에서 재사용할 수 없으므로,
// Worker fetch 핸들러가 요청마다 DB 컨텍스트를 열어 loader 쪽으로 전달한다.
import { AsyncLocalStorage } from "node:async_hooks";
import { createDb, type Database } from "@celine/db";

const dbContext = new AsyncLocalStorage<Database>();

export function runWithDb<T>(connectionString: string, callback: () => T): T {
  return dbContext.run(createDb(connectionString), callback);
}

export function getDb(): Database {
  const requestDb = dbContext.getStore();
  if (requestDb) return requestDb;

  const localConnectionString =
    typeof process !== "undefined"
      ? process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE ??
        process.env.WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE
      : undefined;

  if (localConnectionString) return createDb(localConnectionString);

  throw new Error("DB 미초기화 — worker fetch 핸들러에서 runWithDb() 로 요청 컨텍스트를 먼저 열어야 합니다.");
}
