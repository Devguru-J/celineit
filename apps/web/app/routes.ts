import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  // 인증 (게이트 제외 경로 — workers/auth-gate.ts)
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  index("routes/summary.tsx"),
  route("feed", "routes/feed.tsx"),
  route("winning-ads", "routes/winning-ads.tsx"),
  route("trends", "routes/trends.tsx"),
  route("calendar", "routes/calendar.tsx"),
  route("brands", "routes/brands.tsx"),
  route("brands/:slug", "routes/brand-detail.tsx"),
  route("item/:kind/:id", "routes/item.tsx"),
  route("img", "routes/img.tsx"),
  route("admin/runs", "routes/admin-runs.tsx"),
  route("admin/users", "routes/admin-users.tsx"),
  // 트렌드 뷰어 (Trend Radar): 페이지 + 플랫폼별 리소스 라우트
  route("radar", "routes/radar.tsx"),
  route("radar/api/videos", "routes/radar.api.videos.tsx"),
  route("radar/api/ai", "routes/radar.api.ai.tsx"),
  route("radar/api/reels", "routes/radar.api.reels.tsx"),
  route("radar/api/x", "routes/radar.api.x.tsx"),
  route("radar/api/threads", "routes/radar.api.threads.tsx"),
  route("radar/api/tiktok", "routes/radar.api.tiktok.tsx"),
  route("radar/api/accounts", "routes/radar.api.accounts.tsx"),
] satisfies RouteConfig;
