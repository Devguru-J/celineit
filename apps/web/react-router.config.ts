import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
  // React Router v8 동작을 미리 채택해 future flag 경고 제거.
  // (앱에 middleware/트레일링슬래시 의존 로직 없고 Vite 6 사용 → 모두 무해)
  future: {
    v8_middleware: true,
    v8_splitRouteModules: true,
    v8_viteEnvironmentApi: true,
    v8_passThroughRequests: true,
    v8_trailingSlashAwareDataRequests: true,
  },
} satisfies Config;
