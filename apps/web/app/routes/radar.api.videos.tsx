// 리소스 라우트: 유튜브/쇼츠 영상. 레퍼런스 /api/videos.
import { CATEGORIES } from "~/lib/radar/constants";
import { cached } from "~/lib/radar/http.server";
import { getVideos } from "~/lib/radar/youtube.server";

export async function loader({ request }: { request: Request }) {
  const qs = new URL(request.url).searchParams;
  const category = qs.get("category") ?? "전체";
  const period = qs.get("period") ?? "week";
  const shorts = qs.get("shorts") === "1";
  const enrich = qs.get("enrich") === "1";
  const query = (qs.get("q") ?? "").trim();
  const force = qs.get("force") === "1";

  if (!query && category !== "전체" && category !== "AI" && !(category in CATEGORIES)) {
    return Response.json({ error: "unknown category" }, { status: 400 });
  }

  const key = `yt:${query || category}:${period}:${shorts ? 1 : 0}:${enrich ? 1 : 0}`;
  const { data, fetchedAt } = await cached(key, force, () =>
    getVideos({ category, period, shorts, enrich, query }),
  );
  return Response.json({ videos: data.slice(0, 60), fetchedAt });
}
