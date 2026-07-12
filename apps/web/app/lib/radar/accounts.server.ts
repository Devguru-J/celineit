// 트렌드 뷰어 구독 계정 CRUD (Postgres trend_accounts, 사용자 공유).
// 소스별 행이 0개면 기본 계정으로 시드 후 반환 → 최초에도 레퍼런스 기본값이 보인다.
import { trendAccounts } from "@celine/db";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../db.server";
import { DEFAULT_ACCOUNTS, type RadarSource } from "./constants";

// username 정규화: X는 대소문자 보존, 그 외 소문자. @/공백 트림.
// 플랫폼 공통으로 안전한 문자만 허용(영숫자/._-, 최대 40자) — URL 에 그대로 삽입되고
// 캐시 키에도 들어가므로 임의 문자열이 저장되면 안 된다. 불합격이면 "" 반환.
export function normalizeUsername(source: RadarSource, raw: string): string {
  const trimmed = (raw || "").trim().replace(/^@+/, "");
  const name = source === "x" ? trimmed : trimmed.toLowerCase();
  return /^[a-zA-Z0-9._-]{1,40}$/.test(name) ? name : "";
}

// 소스당 구독 계정 상한. 릴스는 계정당 순차 수집(900ms 간격)이라 무제한이면
// 요청 시간·프록시 대역폭이 계정 수에 비례해 폭증한다.
export const MAX_ACCOUNTS_PER_SOURCE = 30;

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
  if (!username) throw new Error("사용자명이 올바르지 않습니다 (영숫자/._- 최대 40자)");
  const existing = await listAccounts(source);
  if (!existing.includes(username) && existing.length >= MAX_ACCOUNTS_PER_SOURCE) {
    throw new Error(`소스당 계정은 최대 ${MAX_ACCOUNTS_PER_SOURCE}개까지 등록할 수 있습니다`);
  }
  await getDb()
    .insert(trendAccounts)
    .values({ source, username })
    .onConflictDoNothing();
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
