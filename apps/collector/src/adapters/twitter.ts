import { type NormalizedPost, type NormalizedResult, emptyResult } from "@celine/shared";
import { num, pick, str, type AccountInput, type PlatformAdapter } from "./types";

// Twitter/X 스크래퍼 (예: apidojo/tweet-scraper).
export const twitterAdapter: PlatformAdapter = {
  platform: "twitter",
  defaultActor: "apidojo~tweet-scraper",

  buildInput(account: AccountInput, opts) {
    const handle = account.handle.replace(/^@/, "");
    return {
      searchTerms: [`from:${handle}`],
      maxItems: opts.maxItems,
      sort: "Latest",
      ...(account.apifyInput ?? {}),
    };
  },

  normalize(rawItems: unknown[]): NormalizedResult {
    const result = emptyResult();
    for (const item of rawItems) {
      const platformPostId = str(pick(item, "id", "id_str", "tweetId"));
      if (!platformPostId) continue;

      // apidojo~tweet-scraper: 최상위 `media` 는 URL 문자열 배열(핵심),
      // `extendedEntities.media` 는 {type, media_url_https,...} 객체 배열(영상 판별·폴백).
      const flatMedia = Array.isArray(pick<unknown[]>(item, "media")) ? (pick<unknown[]>(item, "media") as unknown[]) : [];
      const extendedMedia = Array.isArray(pick<unknown[]>(pick(item, "extendedEntities"), "media"))
        ? (pick<unknown[]>(pick(item, "extendedEntities"), "media") as unknown[])
        : [];

      // 영상 판별: 평면 media 객체 또는 extendedEntities 어느 쪽의 type 이든 인정.
      let hasVideo = false;
      for (const m of [...flatMedia, ...extendedMedia]) {
        const t = str(pick(m, "type"));
        if (t === "video" || t === "animated_gif") hasVideo = true;
      }

      // URL 추출: 문자열 배열이면 그대로, 객체면 media_url_https 등. 비면 extendedEntities 로 폴백.
      const mediaUrls: string[] = [];
      for (const m of flatMedia) {
        const u = typeof m === "string" ? m : str(pick(m, "media_url_https", "media_url", "url"));
        if (u) mediaUrls.push(u);
      }
      if (mediaUrls.length === 0) {
        for (const m of extendedMedia) {
          const u = str(pick(m, "media_url_https", "media_url", "url"));
          if (u) mediaUrls.push(u);
        }
      }

      const author = pick(item, "author", "user");
      const post: NormalizedPost = {
        platformPostId,
        caption: str(pick(item, "text", "full_text", "fullText")) ?? null,
        format: hasVideo ? "video" : mediaUrls.length > 1 ? "carousel" : mediaUrls.length ? "image" : "image",
        permalink: str(pick(item, "url", "twitterUrl")) ?? null,
        postedAt: str(pick(item, "createdAt", "created_at")) ?? null,
        mediaUrls,
        metrics: {
          likes: num(pick(item, "likeCount", "favorite_count", "likes")),
          comments: num(pick(item, "replyCount", "reply_count")),
          views: num(pick(item, "viewCount", "view_count")),
          shares: num(pick(item, "retweetCount", "retweet_count")),
        },
        raw: item,
      };
      result.posts.push(post);

      if (!result.accountMetric) {
        const followers = num(pick(author, "followers", "followersCount", "followers_count"));
        if (followers !== undefined) result.accountMetric = { followers };
      }
    }
    return result;
  },
};
