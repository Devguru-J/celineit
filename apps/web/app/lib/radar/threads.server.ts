// 스레드(Threads) — GraphQL 무인증 시도(doc_id 후보 순회). 실패 시 라우트에서 계정 폴백.
// 레퍼런스 fetch_threads_posts 포팅.
import { IG_APP_ID, IG_APP_ID_THREADS, UA } from "./constants";
import { num, str } from "./format";
import { httpJson, httpText, mapLimit, safe } from "./http.server";

export type ThreadPost = {
  account: string;
  text: string;
  likes: number;
  replies: number;
  reposts: number;
  views: number;
  media: string;
  url: string;
  createdAt: number;
};

// 프로필 페이지에서 LSD 토큰, IG API에서 user_id 획득
async function lsdAndUserId(username: string): Promise<[string | null, string | null]> {
  const lsd = await safe(async () => {
    const body = await httpText("https://www.threads.com/@" + encodeURIComponent(username), {
      timeoutMs: 12000,
    });
    const m = body.match(/"LSD",\[\],\{"token":"([^"]+)"/);
    return m ? m[1] : null;
  }, null);
  const userId = await safe(async () => {
    const info = await httpJson<any>(
      "https://www.instagram.com/api/v1/users/web_profile_info/?username=" +
        encodeURIComponent(username),
      { headers: { "x-ig-app-id": IG_APP_ID }, timeoutMs: 12000 },
    );
    return info?.data?.user?.id ?? null;
  }, null);
  return [lsd, userId];
}

// 프로필 탭 쿼리의 doc_id는 수시로 바뀌므로 알려진 후보를 순서대로 시도
const THREADS_DOC_IDS = [
  "25073444226023094",
  "7451607104958938",
  "23996318550159868",
  "9925907010825989",
  "26286467210919721",
];

function parseThreads(data: any, username: string): ThreadPost[] {
  const posts: ThreadPost[] = [];
  const walk = (o: any) => {
    if (Array.isArray(o)) {
      for (const v of o) walk(v);
      return;
    }
    if (o && typeof o === "object") {
      if (o.post && typeof o.post === "object" && o.post.caption != null) {
        const p = o.post;
        const caption =
          p.caption && typeof p.caption === "object" ? str(p.caption.text) : "";
        const info = p.text_post_app_info ?? {};
        const imgs = p.image_versions2?.candidates ?? [];
        posts.push({
          account: username,
          text: caption.slice(0, 280),
          likes: num(p.like_count),
          replies: num(info.direct_reply_count),
          reposts: num(info.repost_count),
          views: 0,
          media: imgs.length ? str(imgs[0]?.url) : "",
          url: `https://www.threads.com/@${username}/post/${str(p.code)}`,
          createdAt: num(p.taken_at),
        });
      }
      for (const key of Object.keys(o)) walk(o[key]);
    }
  };
  walk(data);
  return posts;
}

async function fetchAccountThreads(username: string): Promise<ThreadPost[]> {
  const [lsd, userId] = await lsdAndUserId(username);
  if (!lsd || !userId) return [];
  const headers = {
    "X-FB-LSD": lsd,
    "X-IG-App-ID": IG_APP_ID_THREADS,
    "Sec-Fetch-Site": "same-origin",
    "X-FB-Friendly-Name": "BarcelonaProfileThreadsTabQuery",
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": UA,
  };
  for (const docId of THREADS_DOC_IDS) {
    const body = new URLSearchParams({
      lsd,
      doc_id: docId,
      variables: JSON.stringify({
        userID: String(userId),
        __relay_internal__pv__BarcelonaIsLoggedInrelayprovider: false,
      }),
    }).toString();
    const data = await safe(
      () => httpJson<any>("https://www.threads.com/api/graphql", { method: "POST", headers, body, timeoutMs: 12000 }),
      null,
    );
    if (!data || data.errors) continue;
    const posts = parseThreads(data, username);
    if (posts.length) return posts;
  }
  return [];
}

export async function getThreadsPosts(accounts: string[]): Promise<ThreadPost[]> {
  // 동시 5개 제한(레퍼런스 max_workers=5). 계정당 최대 5개 doc_id 후보를 순회하므로
  // 무제한이면 서브리퀘스트가 계정수×5 로 폭증한다.
  const results = await mapLimit(accounts, 5, fetchAccountThreads);
  return results.flat();
}
