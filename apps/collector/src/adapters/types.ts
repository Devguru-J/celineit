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

export function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[,\s]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function str(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return undefined;
}
