import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { schema } from "./schema";

export * from "./schema";
export { schema };

// 드라이버 비종속 타입 — postgres-js(운영/러너)와 pglite(테스트) 모두 만족한다.
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

// 운영/로컬 Node 러너용 Postgres 클라이언트 (Supabase 연결 문자열).
export function createDb(connectionString: string): Database {
  const client = postgres(connectionString, { prepare: false, max: 5 });
  return drizzle(client, { schema });
}
