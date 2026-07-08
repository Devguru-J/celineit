// 리소스 라우트: X(트위터). 레퍼런스 /api/x.
import { listAccounts } from "~/lib/radar/accounts.server";
import { cached } from "~/lib/radar/http.server";
import { getXPosts } from "~/lib/radar/x.server";

export async function loader({ request }: { request: Request }) {
  const force = new URL(request.url).searchParams.get("force") === "1";
  const accounts = await listAccounts("x");
  const { data, fetchedAt } = await cached(`x:${accounts.join(",")}`, force, () =>
    getXPosts(accounts),
  );
  return Response.json({ posts: data, accounts, fetchedAt });
}
