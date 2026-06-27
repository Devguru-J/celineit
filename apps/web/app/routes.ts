import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/summary.tsx"),
  route("feed", "routes/feed.tsx"),
  route("winning-ads", "routes/winning-ads.tsx"),
  route("trends", "routes/trends.tsx"),
  route("calendar", "routes/calendar.tsx"),
  route("brands", "routes/brands.tsx"),
  route("item/:kind/:id", "routes/item.tsx"),
  route("img", "routes/img.tsx"),
  route("admin/runs", "routes/admin-runs.tsx"),
] satisfies RouteConfig;
