// 유튜브 — InnerTube(youtubei/v1) 무인증 검색. 레퍼런스 server.py 유튜브 섹션 포팅.
import {
  ALL_MERGE,
  AI_YT_QUERIES,
  CATEGORIES,
  PERIOD_CODE,
  PERIOD_EXCLUDE,
} from "./constants";
import { postJson, httpRaw, mapLimit, safe } from "./http.server";

export type YtVideo = {
  id: string;
  title: string;
  channel: string;
  views: number;
  viewsText: string;
  length: string;
  published: string;
  thumbnail: string;
  likes?: number;
};

const CLIENT = { clientName: "WEB", clientVersion: "2.20250624.01.00", hl: "ko", gl: "KR" };

// 정렬=조회수(3) + 필터(업로드날짜, 동영상타입, [4분미만]) protobuf → base64url
function buildSearchParams(period: string, shorts: boolean): string {
  const filters = [0x08, PERIOD_CODE[period] ?? 3, 0x10, 0x01];
  if (shorts) filters.push(0x18, 0x01); // 길이: 4분 미만
  const raw = [0x08, 0x03, 0x12, filters.length, ...filters];
  let bin = "";
  for (const b of raw) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_");
}

function withinPeriod(published: string, period: string): boolean {
  if (!published) return true; // 게시일 없음(라이브 등) → 통과
  return !(PERIOD_EXCLUDE[period] ?? []).some((w) => published.includes(w));
}

function parseViewCount(text: string): number {
  const digits = (text || "").replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

// 응답 트리를 순회하며 videoRenderer 수집
function extractVideos(node: any, out: YtVideo[]): void {
  if (Array.isArray(node)) {
    for (const item of node) extractVideos(item, out);
    return;
  }
  if (node && typeof node === "object") {
    if (node.videoRenderer) {
      const v = node.videoRenderer;
      const title = (v.title?.runs ?? []).map((r: any) => r.text ?? "").join("");
      const viewsText = v.viewCountText?.simpleText ?? "";
      const thumbs = v.thumbnail?.thumbnails ?? [];
      out.push({
        id: v.videoId ?? "",
        title,
        channel: (v.ownerText?.runs ?? []).map((r: any) => r.text ?? "").join(""),
        views: parseViewCount(viewsText),
        viewsText,
        length: v.lengthText?.simpleText ?? "",
        published: v.publishedTimeText?.simpleText ?? "",
        thumbnail: thumbs.length ? thumbs[thumbs.length - 1].url : "",
      });
    }
    for (const key of Object.keys(node)) extractVideos(node[key], out);
  }
}

async function ytSearch(query: string, period: string, shorts: boolean): Promise<YtVideo[]> {
  return safe(async () => {
    const data = await postJson<any>("https://www.youtube.com/youtubei/v1/search", {
      context: { client: CLIENT },
      query,
      params: buildSearchParams(period, shorts),
    });
    const videos: YtVideo[] = [];
    extractVideos(data, videos);
    const seen = new Set<string>();
    const unique: YtVideo[] = [];
    for (const v of videos) {
      if (v.id && !seen.has(v.id) && withinPeriod(v.published, period)) {
        seen.add(v.id);
        unique.push(v);
      }
    }
    return unique;
  }, []);
}

// youtubei/v1/next 응답 텍스트에서 좋아요 수를 정규식으로 추출(검색 API엔 없음)
async function ytLikeCount(videoId: string): Promise<number> {
  return safe(async () => {
    const res = await httpRaw("https://www.youtube.com/youtubei/v1/next", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: { client: CLIENT }, videoId }),
      timeoutMs: 10000,
    });
    const s = await res.text();
    const m = s.match(/다른 사용자 ([0-9,]+)명/) || s.match(/along with ([0-9,]+) other/);
    return m ? parseInt(m[1].replace(/,/g, ""), 10) + 1 : 0;
  }, 0);
}

// 좋아요를 병렬로 보강(이미 채워진 항목/상위 limit개만).
// 동시 12개 제한(레퍼런스 max_workers=12): 무제한이면 검색 6 + next 45 = 51 서브리퀘스트로
// Worker 무료 플랜 한도(50)를 초과하고 YouTube rate-limit 도 유발한다.
async function enrichLikes(videos: YtVideo[], limit = 45): Promise<void> {
  const todo = videos.slice(0, limit).filter((v) => v.likes === undefined);
  if (!todo.length) return;
  const counts = await mapLimit(todo, 12, (v) => ytLikeCount(v.id));
  todo.forEach((v, i) => (v.likes = counts[i]));
}

async function mergeSearches(
  queries: string[],
  period: string,
  shorts: boolean,
): Promise<YtVideo[]> {
  const results = await Promise.all(queries.map((q) => ytSearch(q, period, shorts)));
  const merged: YtVideo[] = [];
  const seen = new Set<string>();
  for (const chunk of results)
    for (const v of chunk)
      if (!seen.has(v.id)) {
        seen.add(v.id);
        merged.push(v);
      }
  merged.sort((a, b) => b.views - a.views);
  return merged;
}

export async function getVideos(opts: {
  category: string;
  period: string;
  shorts: boolean;
  enrich: boolean;
  query: string;
}): Promise<YtVideo[]> {
  const { category, period, shorts, enrich, query } = opts;
  let queries: string[];
  if (query) queries = [query];
  else if (category === "전체") queries = ALL_MERGE.map((c) => CATEGORIES[c]);
  else if (category === "AI") queries = AI_YT_QUERIES;
  else queries = [CATEGORIES[category] ?? category];

  const vids = await mergeSearches(queries, period, shorts);
  if (enrich) await enrichLikes(vids);
  return vids;
}
