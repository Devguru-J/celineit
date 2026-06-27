// 기존 media_assets 중 아직 영속 저장 안 된 것(r2_key NULL)을 Supabase Storage 로 백필.
//   DATABASE_URL=... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npm run backfill -w @celine/collector
import { createDb, mediaAssets } from "@celine/db";
import { eq, isNull } from "drizzle-orm";
import { copyToStorage, ensureBucket, storageFromEnv } from "./media";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL 이 필요합니다.");
  const cfg = storageFromEnv();
  if (!cfg) throw new Error("SUPABASE_URL, SUPABASE_SERVICE_KEY 환경변수가 필요합니다.");

  const db = createDb(databaseUrl);
  await ensureBucket(cfg);

  const pending = await db
    .select({ id: mediaAssets.id, ownerType: mediaAssets.ownerType, originalUrl: mediaAssets.originalUrl })
    .from(mediaAssets)
    .where(isNull(mediaAssets.r2Key));

  console.log(`백필 대상: ${pending.length}건`);
  let ok = 0;
  let fail = 0;
  for (const m of pending) {
    const path = `${m.ownerType}/${m.id}`;
    const publicUrl = await copyToStorage(cfg, m.originalUrl, path);
    if (publicUrl) {
      await db.update(mediaAssets).set({ r2Key: publicUrl }).where(eq(mediaAssets.id, m.id));
      ok++;
    } else {
      fail++;
    }
    if ((ok + fail) % 20 === 0) console.log(`  진행 ${ok + fail}/${pending.length} (성공 ${ok} · 실패 ${fail})`);
  }
  console.log(`백필 완료: 성공 ${ok} · 실패 ${fail}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
