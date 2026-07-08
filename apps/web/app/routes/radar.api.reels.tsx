// 리소스 라우트: 인스타 릴스. 레퍼런스 /api/reels.
import { listAccounts } from "~/lib/radar/accounts.server";
import { cached } from "~/lib/radar/http.server";
import { getReels } from "~/lib/radar/instagram.server";

export async function loader({ request }: { request: Request }) {
  const force = new URL(request.url).searchParams.get("force") === "1";
  const accounts = await listAccounts("reels");
  const { data, fetchedAt } = await cached(`reels:${accounts.join(",")}`, force, () =>
    getReels(accounts),
  );
  return Response.json({ reels: data.slice(0, 80), accounts, fetchedAt });
}
