import { comments as commentsT, commentKeywords, type Database } from "@celine/db";
import { FOCUS_KEYWORDS, type NormalizedComment } from "@celine/shared";
import { eq } from "drizzle-orm";
import { countFocusKeywords, extractTopKeywords, type Tokenizer } from "./keywords";

export async function ingestComments(
  db: Database,
  postId: string,
  items: NormalizedComment[],
): Promise<number> {
  let inserted = 0;
  for (const c of items) {
    const res = await db
      .insert(commentsT)
      .values({
        postId,
        platformCommentId: c.platformCommentId,
        text: c.text,
        likeCount: c.likeCount,
        authorHandle: c.authorHandle,
        postedAt: c.postedAt ? new Date(c.postedAt) : null,
        raw: c.raw,
      })
      .onConflictDoNothing({ target: [commentsT.postId, commentsT.platformCommentId] })
      .returning({ id: commentsT.id });
    inserted += res.length;
  }
  return inserted;
}

export async function recomputeCommentKeywords(
  db: Database,
  tokenizer: Tokenizer,
  postId: string,
  opts?: { exclude?: string[]; topN?: number },
): Promise<{ top: number; focus: number }> {
  const rows = await db
    .select({ text: commentsT.text })
    .from(commentsT)
    .where(eq(commentsT.postId, postId));
  const texts = rows.map((r) => r.text ?? "").filter(Boolean);

  const top = extractTopKeywords(tokenizer, texts, { topN: opts?.topN ?? 10, exclude: opts?.exclude });
  const focus = countFocusKeywords(texts, FOCUS_KEYWORDS);

  // 멱등: 해당 post 의 기존 키워드 전부 삭제 후 재삽입
  await db.delete(commentKeywords).where(eq(commentKeywords.postId, postId));

  const values = [
    ...top.map((k) => ({ postId, keyword: k.keyword, kind: "top", count: k.count })),
    ...focus.map((k) => ({ postId, keyword: k.keyword, kind: "focus", count: k.count })),
  ];
  if (values.length > 0) await db.insert(commentKeywords).values(values);

  return { top: top.length, focus: focus.length };
}
