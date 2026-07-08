// 인스타그램 릴스 — web_profile_info 무인증 API. 레퍼런스 fetch_ig_reels 포팅.
import { IG_APP_ID } from "./constants";
import { num, str } from "./format";
import { httpJson, safe } from "./http.server";

export type Reel = {
  account: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  thumbnail: string;
  url: string;
  takenAt: number;
};

async function fetchAccountReels(username: string): Promise<Reel[]> {
  return safe(async () => {
    const url =
      "https://www.instagram.com/api/v1/users/web_profile_info/?username=" +
      encodeURIComponent(username);
    const data = await httpJson<any>(url, { headers: { "x-ig-app-id": IG_APP_ID }, timeoutMs: 12000 });
    const user = data?.data?.user ?? {};
    const reels: Reel[] = [];
    for (const edge of user?.edge_owner_to_timeline_media?.edges ?? []) {
      const n = edge?.node ?? {};
      if (!n.is_video) continue;
      const caps = n?.edge_media_to_caption?.edges ?? [];
      const title = caps.length ? str(caps[0]?.node?.text).split("\n")[0].slice(0, 120) : "";
      reels.push({
        account: username,
        title: title || "(설명 없음)",
        views: num(n.video_view_count),
        likes: num(n?.edge_liked_by?.count),
        comments: num(n?.edge_media_to_comment?.count),
        thumbnail: str(n.thumbnail_src),
        url: `https://www.instagram.com/reel/${str(n.shortcode)}/`,
        takenAt: num(n.taken_at_timestamp),
      });
    }
    return reels;
  }, []);
}

export async function getReels(accounts: string[]): Promise<Reel[]> {
  const results = await Promise.all(accounts.map(fetchAccountReels));
  const merged = results.flat();
  merged.sort((a, b) => b.views - a.views);
  return merged;
}
