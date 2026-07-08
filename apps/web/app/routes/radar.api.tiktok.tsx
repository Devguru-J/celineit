// 리소스 라우트: 틱톡. 레퍼런스 /api/tiktok.
import { listAccounts } from "~/lib/radar/accounts.server";
import { cached } from "~/lib/radar/http.server";
import { getTikTok } from "~/lib/radar/tiktok.server";

export async function loader({ request }: { request: Request }) {
  const force = new URL(request.url).searchParams.get("force") === "1";
  const accounts = await listAccounts("tiktok");
  const { data, fetchedAt } = await cached(`tiktok:${accounts.join(",")}`, force, () =>
    getTikTok(accounts),
  );
  return Response.json({ posts: data.slice(0, 100), accounts, fetchedAt });
}
