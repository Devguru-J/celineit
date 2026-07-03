import type { NormalizedComment } from "@celine/shared";
import { num, pick, str } from "./adapters/types";

// Instagram 댓글 스크래퍼 (apify/instagram-comment-scraper).
export const COMMENT_ACTOR = "apify~instagram-comment-scraper";

export function buildCommentInput(postUrl: string, maxItems: number): Record<string, unknown> {
  return {
    directUrls: [postUrl],
    resultsLimit: maxItems,
  };
}

export function normalizeComments(rawItems: unknown[]): NormalizedComment[] {
  const out: NormalizedComment[] = [];
  for (const item of rawItems) {
    const platformCommentId = str(pick(item, "id", "commentId"));
    if (!platformCommentId) continue; // id 없으면 버림
    out.push({
      platformCommentId,
      text: str(pick(item, "text", "comment")) ?? null,
      likeCount: num(pick(item, "likesCount", "likeCount", "likes")),
      authorHandle: str(pick(item, "ownerUsername", "username", "owner")) ?? null,
      postedAt: str(pick(item, "timestamp", "createdAt")) ?? null,
      raw: item,
    });
  }
  return out;
}
