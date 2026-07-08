// 인스타그램 릴스 — web_profile_info 무인증 API. 레퍼런스 fetch_ig_reels 포팅.
import { IG_APP_ID, UA } from "./constants";
import { num, str } from "./format";
import { httpJson, safe } from "./http.server";
import { proxyEnabled, proxyGetJson } from "./proxy.server";

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
    const data = proxyEnabled()
      ? await proxyGetJson<any>(
          url,
          { "x-ig-app-id": IG_APP_ID, "User-Agent": UA, Accept: "*/*" },
          15000,
        )
      : await httpJson<any>(url, { headers: { "x-ig-app-id": IG_APP_ID }, timeoutMs: 12000 });
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getReels(accounts: string[]): Promise<Reel[]> {
  // 인스타는 IP당 레이트리밋이 공격적이라 병렬 대신 순차+지연으로 수집(429 회피).
  // 프록시 사용 시 계정마다 라운드로빈으로 다른 IP를 쓴다. 1시간 캐시라 지연 허용.
  const merged: Reel[] = [];
  const gap = proxyEnabled() ? 900 : 0;
  for (let i = 0; i < accounts.length; i++) {
    merged.push(...(await fetchAccountReels(accounts[i])));
    if (gap && i < accounts.length - 1) await sleep(gap);
  }
  merged.sort((a, b) => b.views - a.views);
  return merged;
}
