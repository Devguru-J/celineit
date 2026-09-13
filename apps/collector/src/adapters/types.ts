import type { NormalizedResult, Platform } from "@celine/shared";

export interface AccountInput {
  handle: string;
  profileUrl?: string | null;
  apifyInput?: Record<string, unknown> | null;
}

export interface PlatformAdapter {
  platform: Platform;
  /** 기본 Apify actor ID (환경변수로 override 가능). null 이면 데이터 소스 없음. */
  defaultActor: string | null;
  /** 계정 정보를 actor 입력으로 변환. */
  buildInput(account: AccountInput, opts: { maxItems: number }): Record<string, unknown>;
  /** Apify raw item 배열을 중립 엔티티로 정규화. 방어적으로 파싱. */
  normalize(rawItems: unknown[]): NormalizedResult;
}

// raw 객체에서 안전하게 값 꺼내기 위한 헬퍼
export function pick<T = unknown>(obj: unknown, ...keys: string[]): T | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const rec = obj as Record<string, unknown>;
  for (const k of keys) {
    if (rec[k] !== undefined && rec[k] !== null) return rec[k] as T;
  }
  return undefined;
}

// 지표(좋아요·댓글·조회·팔로워)는 항상 0 이상. Instagram 은 좋아요 숨김 게시물을 -1 로
// 내려주므로 음수는 "값 없음"으로 취급한다 — 그대로 저장하면 합계/정렬이 왜곡된다.
export function num(v: unknown): number | undefined {
  let n: number | undefined;
  if (typeof v === "number" && Number.isFinite(v)) n = v;
  else if (typeof v === "string") {
    const parsed = Number(v.replace(/[,\s]/g, ""));
    if (Number.isFinite(parsed)) n = parsed;
  }
  return n === undefined || n < 0 ? undefined : n;
}

export function str(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return undefined;
}

/** apify_input 의 resultsLimit 은 시스템 상한(maxItems)보다 작을 때만 존중한다. */
export function capResultsLimit(requested: unknown, maxItems: number): number {
  const r = typeof requested === "number" && Number.isFinite(requested) && requested >= 1 ? Math.floor(requested) : undefined;
  return r === undefined ? maxItems : Math.min(r, maxItems);
}
