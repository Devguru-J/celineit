// 리소스 라우트: AI 영상 탭(HuggingFace 모델 + 뉴스). 레퍼런스 /api/ai.
import { getAiData } from "~/lib/radar/ai.server";
import { cached } from "~/lib/radar/http.server";

export async function loader({ request }: { request: Request }) {
  const force = new URL(request.url).searchParams.get("force") === "1";
  const { data, fetchedAt } = await cached("ai", force, getAiData);
  return Response.json({ ...data, fetchedAt });
}
