// 트렌드 뷰어 표시용 포맷터 (클라이언트 공용). 레퍼런스 index.html fmt2/timeAgo 동일.

// 억/만/천 단위 축약
export function fmt2(n: number): string {
  n = n || 0;
  if (n >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, "") + "억";
  if (n >= 1e4) return (n / 1e4).toFixed(1).replace(/\.0$/, "") + "만";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "천";
  return n.toLocaleString("ko-KR");
}

// epoch(초) → "N분/시간/일 전". nowMs는 SSR 안정성을 위해 주입 가능.
export function timeAgo(ts: number, nowMs: number = Date.now()): string {
  if (!ts) return "";
  const s = nowMs / 1000 - ts;
  if (s < 3600) return Math.max(1, Math.floor(s / 60)) + "분 전";
  if (s < 86400) return Math.floor(s / 3600) + "시간 전";
  return Math.floor(s / 86400) + "일 전";
}

// epoch(초) → HH:MM:SS (ko-KR)
export function updatedAt(fetchedAt: number): string {
  return new Date(fetchedAt * 1000).toLocaleTimeString("ko-KR");
}

// 스크래핑 데이터 방어적 코어싱 — 무인증 API가 예기치 않게 객체를 줄 수 있어
// (예: tikwm의 author.unique_id가 {6,12} 객체) React 렌더 크래시를 막는다.
export function str(x: unknown): string {
  return typeof x === "string" ? x : "";
}
export function num(x: unknown): number {
  return typeof x === "number" && Number.isFinite(x) ? x : 0;
}
