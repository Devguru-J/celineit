// AI 영상 탭 — HuggingFace 모델 + Google News RSS. 레퍼런스 fetch_hf_models/fetch_news 포팅.
// XML은 표준 파서가 Workers에 없어 정규식 기반 경량 파서 사용(의존성 0).
import { HF_PIPELINES } from "./constants";
import { httpJson, httpText, safe } from "./http.server";

export type HfModel = {
  id: string;
  likes: number;
  downloads: number;
  pipeline: string;
  createdAt: string;
};

export type NewsItem = {
  region: string;
  title: string;
  source: string;
  link: string;
  ts: number;
};

export type AiData = {
  models: { latest: HfModel[]; trending: HfModel[] };
  news: NewsItem[];
};

const NEWS_FEEDS: [string, string][] = [
  [
    "국내",
    "https://news.google.com/rss/search?q=" +
      encodeURIComponent('AI 영상 생성 OR "AI 비디오" OR 영상생성모델') +
      "&hl=ko&gl=KR&ceid=KR:ko",
  ],
  [
    "해외",
    "https://news.google.com/rss/search?q=" +
      encodeURIComponent('"AI video" model OR Sora OR Runway OR Kling OR Veo') +
      "&hl=en-US&gl=US&ceid=US:en",
  ],
];

// ── HuggingFace ──────────────────────────────────────
async function fetchModels(pipeline: string, sort: string): Promise<HfModel[]> {
  return safe(async () => {
    const url =
      `https://huggingface.co/api/models?pipeline_tag=${pipeline}` +
      `&sort=${sort}&direction=-1&limit=12`;
    const data = await httpJson<any[]>(url, { timeoutMs: 12000 });
    return data.map((m) => ({
      id: m.id ?? "",
      likes: m.likes ?? 0,
      downloads: m.downloads ?? 0,
      pipeline,
      createdAt: m.createdAt ?? "",
    }));
  }, []);
}

function dedupe(lists: HfModel[][]): HfModel[] {
  const seen = new Set<string>();
  const out: HfModel[] = [];
  for (const chunk of lists)
    for (const m of chunk)
      if (!seen.has(m.id)) {
        seen.add(m.id);
        out.push(m);
      }
  return out;
}

async function getModels(): Promise<{ latest: HfModel[]; trending: HfModel[] }> {
  // jobs 순서: 각 pipeline에 대해 [createdAt, trendingScore]
  const jobs: [string, string][] = [];
  for (const p of HF_PIPELINES) for (const s of ["createdAt", "trendingScore"]) jobs.push([p, s]);
  const results = await Promise.all(jobs.map(([p, s]) => fetchModels(p, s)));
  const latest = dedupe(results.filter((_, i) => i % 2 === 0));
  latest.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  const trending = dedupe(results.filter((_, i) => i % 2 === 1));
  return { latest: latest.slice(0, 12), trending: trending.slice(0, 12) };
}

// ── Google News RSS (경량 파서) ──────────────────────
function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1]).trim() : "";
}

async function fetchFeed([label, url]: [string, string]): Promise<NewsItem[]> {
  return safe(async () => {
    const xml = await httpText(url, { timeoutMs: 12000 });
    const items: NewsItem[] = [];
    const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
    for (const block of blocks.slice(0, 25)) {
      const pub = tag(block, "pubDate");
      const ts = pub ? Math.floor(new Date(pub).getTime() / 1000) : 0;
      items.push({
        region: label,
        title: tag(block, "title"),
        source: tag(block, "source"),
        link: tag(block, "link"),
        ts: Number.isFinite(ts) ? ts : 0,
      });
    }
    return items;
  }, []);
}

async function getNews(): Promise<NewsItem[]> {
  const results = await Promise.all(NEWS_FEEDS.map(fetchFeed));
  const merged = results.flat();
  merged.sort((a, b) => b.ts - a.ts);
  return merged.slice(0, 40);
}

export async function getAiData(): Promise<AiData> {
  const [models, news] = await Promise.all([getModels(), getNews()]);
  return { models, news };
}
