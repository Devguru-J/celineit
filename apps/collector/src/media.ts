// 미디어 영속 저장: 원본 CDN 이미지를 Supabase Storage(공개 버킷)에 사본 저장.
// 서명 만료 없는 영구 public URL 을 돌려준다. (운영 전환 시 R2 로 교체 가능)

export interface StorageConfig {
  supabaseUrl: string; // https://<ref>.supabase.co
  serviceKey: string; // service_role 키
  bucket: string; // 예: "media"
}

export function storageFromEnv(): StorageConfig | null {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  return { supabaseUrl: supabaseUrl.replace(/\/$/, ""), serviceKey, bucket: process.env.SUPABASE_BUCKET ?? "media" };
}

export async function ensureBucket(cfg: StorageConfig): Promise<void> {
  const res = await fetch(`${cfg.supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      apikey: cfg.serviceKey,
      Authorization: `Bearer ${cfg.serviceKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ id: cfg.bucket, name: cfg.bucket, public: true }),
  });
  // 이미 존재(409/400)면 무시
  if (!res.ok && res.status !== 409 && res.status !== 400) {
    throw new Error(`버킷 생성 실패: ${res.status} ${await res.text()}`);
  }
}

/** 원본 URL 의 이미지를 받아 Storage 에 올리고 공개 URL 을 반환. 실패 시 null. */
export async function copyToStorage(cfg: StorageConfig, originalUrl: string, objectPath: string): Promise<string | null> {
  const src = await fetch(originalUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "image/*,*/*;q=0.8",
    },
  });
  if (!src.ok || !src.body) return null;
  const contentType = src.headers.get("content-type") ?? "image/jpeg";
  const bytes = new Uint8Array(await src.arrayBuffer());

  const up = await fetch(`${cfg.supabaseUrl}/storage/v1/object/${cfg.bucket}/${objectPath}`, {
    method: "POST",
    headers: {
      apikey: cfg.serviceKey,
      Authorization: `Bearer ${cfg.serviceKey}`,
      "content-type": contentType,
      "x-upsert": "true",
    },
    body: bytes,
  });
  if (!up.ok) return null;
  return `${cfg.supabaseUrl}/storage/v1/object/public/${cfg.bucket}/${objectPath}`;
}
