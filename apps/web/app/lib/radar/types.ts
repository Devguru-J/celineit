// 트렌드 뷰어 클라이언트 표시용 타입 (서버 반환 shape와 일치). 런타임 코드 없음.

export type RadarTab = "youtube" | "shorts" | "ai" | "reels" | "x" | "threads" | "tiktok";

export type Video = {
  id: string;
  title: string;
  channel: string;
  views: number;
  viewsText: string;
  length: string;
  published: string;
  thumbnail: string;
  likes?: number;
};

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

export type TikTokPost = Reel & { name: string; shares: number; id: string; createdAt: number };

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

export type SortOption = { key: string; label: string; icon: string };

// 프록시 이미지 URL
export function imgProxy(url: string): string {
  return url ? `/img?u=${encodeURIComponent(url)}` : "";
}
