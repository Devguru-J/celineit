// 이미지 프록시: 인스타/틱톡 CDN 핫링크 차단 우회.
// 서버에서 대신 받아 스트리밍 (Referer 없음). 허용 호스트만 통과(SSRF 방지).
const ALLOWED = [
  /\.cdninstagram\.com$/i,
  /\.fbcdn\.net$/i,
  /\.twimg\.com$/i,
  /tiktokcdn/i,
  /\.pstatp\.com$/i,
  // 트렌드 뷰어(유튜브 썸네일·HF 이미지 등) 추가 허용
  /\.ytimg\.com$/i,
  /\.googleusercontent\.com$/i,
];

export async function loader({ request }: { request: Request }) {
  const u = new URL(request.url).searchParams.get("u");
  if (!u) throw new Response("missing u", { status: 400 });

  let target: URL;
  try {
    target = new URL(u);
  } catch {
    throw new Response("bad url", { status: 400 });
  }
  if (target.protocol !== "https:") throw new Response("bad protocol", { status: 400 });
  if (!ALLOWED.some((rx) => rx.test(target.hostname))) throw new Response("host not allowed", { status: 403 });

  // 영상 탐색(seek)을 위해 Range 헤더를 그대로 전달
  const range = request.headers.get("range");
  // 느린/멈춘 CDN 이 워커를 붙잡지 않도록 타임아웃을 건다.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,video/*,*/*;q=0.8",
        ...(range ? { Range: range } : {}),
      },
      signal: controller.signal,
    });
  } catch {
    throw new Response("upstream timeout", { status: 504 });
  } finally {
    clearTimeout(timeout);
  }
  if (!upstream.ok && upstream.status !== 206) throw new Response(`upstream ${upstream.status}`, { status: 502 });
  if (!upstream.body) throw new Response("no body", { status: 502 });

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") ?? "application/octet-stream");
  // s-maxage: 브라우저 캐시 미스여도 엣지에서 응답해 업스트림 재요청을 줄인다.
  // (206 부분응답은 Range 별로 달라 엣지 캐시 대상에서 제외)
  headers.set(
    "Cache-Control",
    upstream.status === 206 ? "public, max-age=86400" : "public, max-age=86400, s-maxage=86400",
  );
  for (const h of ["content-range", "accept-ranges", "content-length"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
