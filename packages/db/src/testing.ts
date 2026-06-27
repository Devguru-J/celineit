// 테스트 전용: pglite(인메모리 Postgres)에 실제 스키마를 올려 적재 로직을 검증한다.
// 외부 DB·크레덴셜 없이 upsert/스냅샷/longevity 의미를 그대로 확인할 수 있다.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { schema } from "./schema";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");

export async function createTestDb() {
  const pg = new PGlite();
  const db = drizzle(pg, { schema });
  // drizzle-kit 이 생성한 SQL 마이그레이션을 순서대로 적용.
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    const sql = readFileSync(join(migrationsDir, f), "utf8");
    // drizzle 마이그레이션의 statement-breakpoint 단위로 실행.
    for (const stmt of sql.split("--> statement-breakpoint")) {
      const trimmed = stmt.trim();
      if (trimmed) await pg.exec(trimmed);
    }
  }
  return { db, pg };
}
