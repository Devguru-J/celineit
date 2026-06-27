// 이미지 프록시: 인스타/틱톡 CDN 핫링크 차단 우회.
// 서버에서 대신 받아 스트리밍 (Referer 없음). 허용 호스트만 통과(SSRF 방지).
const ALLOWED = [
  /\.cdninstagram\.com$/i,
  /\.fbcdn\.net$/i,
  /\.twimg\.com$/i,
  /tiktokcdn/i,
  /\.pstatp\.com$/i,
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
  const upstream = await fetch(target.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/*,video/*,*/*;q=0.8",
      ...(range ? { Range: range } : {}),
    },
  });
  if (!upstream.ok && upstream.status !== 206) throw new Response(`upstream ${upstream.status}`, { status: 502 });
  if (!upstream.body) throw new Response("no body", { status: 502 });

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") ?? "application/octet-stream");
  headers.set("Cache-Control", "public, max-age=86400");
  for (const h of ["content-range", "accept-ranges", "content-length"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
