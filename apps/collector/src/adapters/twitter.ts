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

      const media = pick<unknown[]>(item, "media", "extendedEntities") ?? [];
      const mediaUrls: string[] = [];
      let hasVideo = false;
      for (const m of Array.isArray(media) ? media : []) {
        const t = str(pick(m, "type"));
        if (t === "video" || t === "animated_gif") hasVideo = true;
        const u = str(pick(m, "media_url_https", "media_url", "url"));
        if (u) mediaUrls.push(u);
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
