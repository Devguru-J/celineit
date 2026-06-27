import { type NormalizedResult, emptyResult } from "@celine/shared";
import type { AccountInput, PlatformAdapter } from "./types";

// BeReal: 공개 광고/콘텐츠 표면이 없고 공식/실용 API 부재.
// 어댑터 자리만 둠 — 데이터 소스가 생기면 buildInput/normalize 채우면 됨.
export const berealAdapter: PlatformAdapter = {
  platform: "bereal",
  defaultActor: null,

  buildInput(_account: AccountInput): Record<string, unknown> {
    throw new Error("BeReal 은 현재 지원하는 데이터 소스가 없습니다.");
  },

  normalize(_rawItems: unknown[]): NormalizedResult {
    return emptyResult();
  },
};
