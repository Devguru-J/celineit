// 서버 전용 DB 접근 (.server.ts → 클라이언트 번들에서 제외).
import "dotenv/config";
import { createDb, type Database } from "@celine/db";

let _db: Database | null = null;

export function getDb(): Database {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 이 설정되지 않았습니다 (apps/web/.env).");
  _db = createDb(url);
  return _db;
}
