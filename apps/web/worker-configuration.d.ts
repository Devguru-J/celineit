// `npm run cf-typegen`(= wrangler types) 으로 재생성되는 파일의 최소 스텁.
// Hyperdrive 바인딩 외 바인딩을 추가하면 여기에도 반영됨.
interface Env {
  HYPERDRIVE: Hyperdrive;
  COLLECTOR?: Fetcher;
  COLLECTOR_URL?: string;
  COLLECTOR_SECRET?: string;
  WEBSHARE_API_KEY?: string;
  // 사이트 접근 코드(secret). 설정 시 전 요청이 접근 코드 게이트를 거친다. 미설정=게이트 off(로컬 dev).
  SITE_ACCESS_CODE?: string;
}
