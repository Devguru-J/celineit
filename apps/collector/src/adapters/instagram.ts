import {
  type NormalizedPost,
  type NormalizedResult,
  emptyResult,
} from "@celine/shared";
import { num, pick, str, type AccountInput, type PlatformAdapter } from "./types";

// Instagram 스크래퍼 (예: apify/instagram-scraper).
// 오가닉 포스트 + 계정 지표(팔로워) 수집.
export const instagramAdapter: PlatformAdapter = {
  platform: "instagram",
  defaultActor: "apify~instagram-scraper",

  buildInput(account: AccountInput, opts) {
    const username = account.handle.replace(/^@/, "");
    return {
      directUrls: [account.profileUrl ?? `https://www.instagram.com/${username}/`],
      resultsType: "posts",
      resultsLimit: opts.maxItems,
      addParentData: true,
      ...(account.apifyInput ?? {}),
    };
  },

  normalize(rawItems: unknown[]): NormalizedResult {
    const result = emptyResult();
    for (const item of rawItems) {
      const platformPostId = str(pick(item, "id", "shortCode", "shortcode"));
      if (!platformPostId) continue;

      const type = str(pick(item, "type", "productType"));
      const childCount = (pick<unknown[]>(item, "childPosts", "sidecarItems") ?? []).length;
      const format =
        type?.toLowerCase().includes("video") || pick(item, "videoUrl")
          ? "video"
          : childCount > 0
            ? "carousel"
            : "image";

      const mediaUrls: string[] = [];
      const display = str(pick(item, "displayUrl", "imageUrl"));
      if (display) mediaUrls.push(display);
      const video = str(pick(item, "videoUrl"));
      if (video) mediaUrls.push(video);

      const post: NormalizedPost = {
        platformPostId,
        caption: str(pick(item, "caption", "text")) ?? null,
        format,
        permalink: str(pick(item, "url", "postUrl")) ?? `https://www.instagram.com/p/${platformPostId}/`,
        postedAt: str(pick(item, "timestamp", "takenAt")) ?? null,
        mediaUrls,
        metrics: {
          likes: num(pick(item, "likesCount", "likes")),
          comments: num(pick(item, "commentsCount", "comments")),
          views: num(pick(item, "videoViewCount", "videoPlayCount")),
        },
        raw: item,
      };
      result.posts.push(post);

      // 부모(계정) 데이터에서 팔로워 1회 추출
      if (!result.accountMetric) {
        const followers = num(pick(item, "ownerFollowersCount")) ?? num(pick(pick(item, "owner"), "followersCount"));
        if (followers !== undefined) {
          result.accountMetric = { followers };
        }
      }
    }
    return result;
  },
};
