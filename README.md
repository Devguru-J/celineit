# Celine Intelligence

내부용 경쟁사 브랜드 모니터링 툴 (Snipit "Brand Insights Monitoring" 벤치마크).
Meta 광고지면 · Instagram · Twitter/X · TikTok 의 광고/콘텐츠를 매일 수집·누적해
longevity 기반 "Winning Ads", 팔로워·인게이지먼트 추세, 포스팅 리듬 등 전략 인사이트로 가공한다.

> 현재 상태: **프론트엔드 목업** (Google Stitch 디자인 + 목 데이터). 수집 파이프라인/DB는 미연결.

## 설계 문서
- [`docs/superpowers/specs/2026-06-27-brand-monitoring-design.md`](docs/superpowers/specs/2026-06-27-brand-monitoring-design.md)

## 기술 스택
- **프론트**: React Router v7 (framework mode) · Cloudflare Pages (예정)
- **DB**: Supabase Postgres · **ORM**: Drizzle (예정)
- **수집**: Cloudflare Workers (Cron + Queues) → Apify 스크래핑 (예정)
- **미디어**: Cloudflare R2 (예정)
- **스타일**: Tailwind v3 (Stitch 디자인 토큰) · Inter · Material Symbols

## 구조 (모노레포 / npm workspaces)
```
apps/web        React Router v7 목업 앱
  app/routes    Summary · Feed · Winning Ads · Trends · Calendar · Brands · Admin/Runs
  app/components Sidebar · TopBar · ui (PlatformChip, MediaPlaceholder, LineChart …)
  app/mock      목 데이터 (계획된 Drizzle 스키마 형태)
packages/db     공유 Drizzle 스키마 (예정)
packages/shared 공유 타입/상수 (예정)
.stitch         Stitch 원본 디자인 참조 (HTML/로고)
```

## 실행
```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## 다음 단계
1. `packages/db` Drizzle 스키마 + Supabase 마이그레이션
2. `apps/collector` Cloudflare Worker (Cron → Queue → Apify → 적재)
3. 플랫폼 어댑터(meta-ads/instagram/twitter/tiktok) + 멱등 적재 + longevity 계산
4. 목 데이터 → 실제 loader 연결
