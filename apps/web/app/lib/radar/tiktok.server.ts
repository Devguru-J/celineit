// 틱톡 — tikwm 무료 공개 API(트렌딩 + 구독계정). 레퍼런스 tiktok 섹션 포팅.
import { TIKWM_BASE, TIKTOK_REGION, UA } from "./constants";
import { num, str } from "./format";
import { httpJson, safe } from "./http.server";
import { proxyEnabled, proxyGetJson } from "./proxy.server";

// 프록시 활성 시 프록시 경유, 아니면 직접 fetch (tikwm는 CF IP를 차단하므로 프록시 권장)
function tikwmGet(url: string) {
  return proxyEnabled() ? proxyGetJson<any>(url, { "User-Agent": UA }) : httpJson<any>(url);
}

export type TikTokPost = {
  account: string;
  name: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  thumbnail: string;
  url: string;
  id: string;
  createdAt: number;
};

function toItem(v: any): TikTokPost {
  const author = v.author && typeof v.author === "object" ? v.author : {};
  // tikwm 트렌딩 피드는 일부 항목의 unique_id를 객체({6,12})로 주기도 해서 코어싱 필수.
  const handle = str(author.unique_id);
  const vid = str(v.video_id);
  return {
    account: handle,
    name: str(author.nickname) || handle,
    title: str(v.title).trim() || "(설명 없음)",
    views: num(v.play_count),
    likes: num(v.digg_count),
    comments: num(v.comment_count),
    shares: num(v.share_count),
    thumbnail: str(v.cover) || str(v.origin_cover),
    url: `https://www.tiktok.com/@${handle}/video/${vid}`,
    id: vid,
    createdAt: num(v.create_time),
  };
}

async function fetchTrending(): Promise<TikTokPost[]> {
  return safe(async () => {
    const d = await tikwmGet(`${TIKWM_BASE}/feed/list?region=${TIKTOK_REGION}&count=20`);
    return (d?.data ?? []).map(toItem);
  }, []);
}

async function fetchUser(handle: string): Promise<TikTokPost[]> {
  return safe(async () => {
    const d = await tikwmGet(
      `${TIKWM_BASE}/user/posts?unique_id=${encodeURIComponent(handle)}&count=12`,
    );
    return (d?.data?.videos ?? []).map(toItem);
  }, []);
}

export async function getTikTok(accounts: string[]): Promise<TikTokPost[]> {
  const trending = await fetchTrending();
  const userChunks = await Promise.all(accounts.map(fetchUser));
  const posts = [...trending, ...userChunks.flat()];
  const seen = new Set<string>();
  const unique: TikTokPost[] = [];
  for (const p of posts) {
    if (p.id && !seen.has(p.id)) {
      seen.add(p.id);
      unique.push(p);
    }
  }
  return unique;
}
