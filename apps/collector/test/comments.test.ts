import { describe, expect, it } from "vitest";
import { buildCommentInput, normalizeComments } from "../src/comments";

describe("normalizeComments", () => {
  it("Apify 댓글 raw 를 방어적으로 정규화한다", () => {
    const raw = [
      { id: "c1", text: "毛穴によい", ownerUsername: "user_a", timestamp: "2026-06-01T00:00:00.000Z", likesCount: 3 },
      { id: "c2", text: "", ownerUsername: "user_b", likesCount: "5" },
      { text: "id 없는 댓글은 버림" },
      "garbage",
    ];
    const res = normalizeComments(raw);
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({ platformCommentId: "c1", text: "毛穴によい", likeCount: 3, authorHandle: "user_a" });
    expect(res[1]).toMatchObject({ platformCommentId: "c2", likeCount: 5 });
  });

  it("buildCommentInput 은 게시물 URL 과 limit 을 넣는다", () => {
    const input = buildCommentInput("https://www.instagram.com/p/ABC/", 50);
    expect(input).toMatchObject({ directUrls: ["https://www.instagram.com/p/ABC/"], resultsLimit: 50 });
  });
});
