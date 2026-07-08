// 트렌드 뷰어 구독 계정 CRUD (Postgres trend_accounts, 사용자 공유).
// 소스별 행이 0개면 기본 계정으로 시드 후 반환 → 최초에도 레퍼런스 기본값이 보인다.
import { trendAccounts } from "@celine/db";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../db.server";
import { DEFAULT_ACCOUNTS, type RadarSource } from "./constants";

// username 정규화: X는 대소문자 보존, 그 외 소문자. @/공백 트림.
export function normalizeUsername(source: RadarSource, raw: string): string {
  const trimmed = (raw || "").trim().replace(/^@+/, "");
  return source === "x" ? trimmed : trimmed.toLowerCase();
}

export async function listAccounts(source: RadarSource): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ username: trendAccounts.username })
    .from(trendAccounts)
    .where(eq(trendAccounts.source, source))
    .orderBy(asc(trendAccounts.createdAt));

  if (rows.length) return rows.map((r) => r.username);

  // 시드: 기본 계정 삽입 후 반환(경합 대비 onConflictDoNothing).
  const defaults = DEFAULT_ACCOUNTS[source];
  await db
    .insert(trendAccounts)
    .values(defaults.map((username) => ({ source, username })))
    .onConflictDoNothing();
  return [...defaults];
}

export async function addAccount(source: RadarSource, raw: string): Promise<string[]> {
  const username = normalizeUsername(source, raw);
  if (username) {
    await getDb()
      .insert(trendAccounts)
      .values({ source, username })
      .onConflictDoNothing();
  }
  return listAccounts(source);
}

export async function removeAccount(source: RadarSource, raw: string): Promise<string[]> {
  const username = normalizeUsername(source, raw);
  if (username) {
    await getDb()
      .delete(trendAccounts)
      .where(and(eq(trendAccounts.source, source), eq(trendAccounts.username, username)));
  }
  return listAccounts(source);
}
