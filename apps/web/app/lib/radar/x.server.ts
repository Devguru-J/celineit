// X(트위터) — syndication(임베드용) API의 __NEXT_DATA__ 파싱. 레퍼런스 fetch_x_posts 포팅.
import { num, str } from "./format";
import { httpText, mapLimit, safe } from "./http.server";

export type XPost = {
  account: string;
  name: string;
  text: string;
  likes: number;
  replies: number;
  retweets: number;
  views: number;
  media: string;
  url: string;
  createdAt: string;
};

// __NEXT_DATA__ 트리에서 timeline.entries 배열을 찾음
function findTimelineEntries(node: any): any[] | null {
  if (Array.isArray(node)) {
    for (const v of node) {
      const r = findTimelineEntries(v);
      if (r) return r;
    }
    return null;
  }
  if (node && typeof node === "object") {
    const tl = node.timeline;
    if (tl && typeof tl === "object" && Array.isArray(tl.entries)) return tl.entries;
    for (const key of Object.keys(node)) {
      const r = findTimelineEntries(node[key]);
      if (r) return r;
    }
  }
  return null;
}

async function fetchAccountPosts(username: string): Promise<XPost[]> {
  return safe(async () => {
    const url =
      "https://syndication.twitter.com/srv/timeline-profile/screen-name/" +
      encodeURIComponent(username);
    const html = await httpText(url, { headers: { Accept: "text/html" }, timeoutMs: 12000 });
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return [];
    const data = JSON.parse(m[1]);
    const entries = findTimelineEntries(data) ?? [];
    const posts: XPost[] = [];
    for (const e of entries) {
      const content = e && typeof e === "object" ? e.content ?? {} : {};
      let t = content.tweet;
      if (!t || typeof t !== "object") {
        const tr = content.tweetResult ?? {};
        t = tr && typeof tr === "object" ? tr.result : null;
      }
      if (!t || typeof t !== "object" || t.favorite_count == null) continue;
      const user = t.user && typeof t.user === "object" ? t.user : {};
      let media = "";
      for (const mm of t.mediaDetails ?? []) {
        if (mm.media_url_https) {
          media = mm.media_url_https;
          break;
        }
      }
      posts.push({
        account: username,
        name: str(user.name) || username,
        text: (str(t.full_text) || str(t.text)).trim(),
        likes: num(t.favorite_count),
        replies: num(t.reply_count),
        retweets: num(t.retweet_count),
        views: t.views && typeof t.views === "object" ? parseInt(t.views.count ?? 0, 10) || 0 : 0,
        media: str(media),
        url: `https://x.com/${username}/status/${str(t.id_str)}`,
        createdAt: str(t.created_at),
      });
    }
    return posts;
  }, []);
}

export async function getXPosts(accounts: string[]): Promise<XPost[]> {
  // 동시 3개 제한(레퍼런스 max_workers=3): syndication 엔드포인트 rate-limit 회피.
  const results = await mapLimit(accounts, 3, fetchAccountPosts);
  return results.flat();
}
