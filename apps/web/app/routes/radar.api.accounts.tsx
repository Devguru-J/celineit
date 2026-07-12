// 리소스 라우트: 구독 계정 추가/삭제(POST). 레퍼런스 /api/{reels|x|threads|tiktok}/accounts.
import { addAccount, removeAccount } from "~/lib/radar/accounts.server";
import type { RadarSource } from "~/lib/radar/constants";

const SOURCES: RadarSource[] = ["reels", "x", "threads", "tiktok"];

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return Response.json({ error: "method not allowed" }, { status: 405 });
  }
  let body: { source?: string; action?: string; username?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const source = body.source as RadarSource;
  if (!SOURCES.includes(source)) {
    return Response.json({ error: "unknown source" }, { status: 400 });
  }
  const username = body.username ?? "";
  try {
    const accounts =
      body.action === "add"
        ? await addAccount(source, username)
        : body.action === "remove"
          ? await removeAccount(source, username)
          : null;
    if (accounts === null) return Response.json({ error: "unknown action" }, { status: 400 });
    return Response.json({ accounts });
  } catch (err) {
    // addAccount 의 검증 실패(잘못된 사용자명/상한 초과)를 클라이언트에 전달
    return Response.json({ error: err instanceof Error ? err.message : "요청 실패" }, { status: 400 });
  }
}
