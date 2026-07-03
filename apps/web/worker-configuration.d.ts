// `npm run cf-typegen`(= wrangler types) 으로 재생성되는 파일의 최소 스텁.
// Hyperdrive 바인딩 외 바인딩을 추가하면 여기에도 반영됨.
interface Env {
  HYPERDRIVE: Hyperdrive;
}
