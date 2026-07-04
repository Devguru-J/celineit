// 서버 전용: 수집기(celine-collector) Service Binding 을 요청 컨텍스트로 전달.
// RR7 middleware 환경에서는 load context 로 임의 객체를 넘길 수 없으므로(RouterContextProvider 요구),
// DB 와 동일하게 AsyncLocalStorage 로 loader/action 에 바인딩을 전달한다.
import { AsyncLocalStorage } from "node:async_hooks";

// Cloudflare Service Binding 은 fetch 를 가진 Fetcher. 로컬 dev 등에서는 없을 수 있어 undefined 허용.
export type CollectorBinding = { fetch: (input: Request) => Promise<Response> } | undefined;

const collectorContext = new AsyncLocalStorage<CollectorBinding>();

export function runWithCollector<T>(collector: CollectorBinding, callback: () => T): T {
  return collectorContext.run(collector, callback);
}

export function getCollector(): CollectorBinding {
  return collectorContext.getStore();
}
