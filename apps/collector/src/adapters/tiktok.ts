import { type NormalizedPost, type NormalizedResult, emptyResult } from "@celine/shared";
import { num, pick, str, type AccountInput, type PlatformAdapter } from "./types";

// TikTok 스크래퍼 (예: clockworks/tiktok-scraper).
export const tiktokAdapter: PlatformAdapter = {
  platform: "tiktok",
  defaultActor: "clockworks~tiktok-scraper",

  buildInput(account: AccountInput, opts) {
    const username = account.handle.replace(/^@/, "");
    return {
      profiles: [username],
      resultsPerPage: opts.maxItems,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      ...(account.apifyInput ?? {}),
    };
  },

  normalize(rawItems: unknown[]): NormalizedResult {
    const result = emptyResult();
    for (const item of rawItems) {
      const platformPostId = str(pick(item, "id", "videoId", "awemeId"));
      if (!platformPostId) continue;

      // covers 는 보통 문자열 배열이라 str() 이 그냥 버린다 → 첫 요소를 꺼내 폴백한다.
      const covers = pick(item, "covers");
      const coverFallback = Array.isArray(covers) ? str(covers[0]) : str(covers);
      const cover = str(pick(pick(item, "videoMeta"), "coverUrl")) ?? coverFallback;
      const mediaUrls = cover ? [cover] : [];

      const authorMeta = pick(item, "authorMeta", "author");
      const post: NormalizedPost = {
        platformPostId,
        caption: str(pick(item, "text", "desc", "description")) ?? null,
        format: "video",
        permalink: str(pick(item, "webVideoUrl", "url")) ?? null,
        postedAt: tiktokDate(pick(item, "createTimeISO", "createTime")),
        mediaUrls,
        metrics: {
          likes: num(pick(item, "diggCount", "likes")),
          comments: num(pick(item, "commentCount", "comments")),
          views: num(pick(item, "playCount", "views")),
          shares: num(pick(item, "shareCount", "shares")),
        },
        raw: item,
      };
      result.posts.push(post);

      if (!result.accountMetric) {
        const followers = num(pick(authorMeta, "fans", "followers", "followerCount"));
        if (followers !== undefined) result.accountMetric = { followers };
      }
    }
    return result;
  },
};

function tiktokDate(v: unknown): string | null {
  if (typeof v === "string") return v;
  // createTime 이 epoch seconds 인 경우
  if (typeof v === "number") return new Date(v * 1000).toISOString();
  return null;
}
