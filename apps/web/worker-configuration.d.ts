// `npm run cf-typegen`(= wrangler types) 으로 재생성되는 파일의 최소 스텁.
// Hyperdrive 바인딩 외 바인딩을 추가하면 여기에도 반영됨.
interface Env {
  HYPERDRIVE: Hyperdrive;
  COLLECTOR?: Fetcher;
  COLLECTOR_URL?: string;
  COLLECTOR_SECRET?: string;
  WEBSHARE_API_KEY?: string;
  // Supabase Auth (로그인 게이트 + /admin/users 계정 관리). 미설정=게이트 off(로컬 dev).
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_KEY?: string;
}
