// 리소스 라우트: 스레드(Threads). 레퍼런스 /api/threads. 글 0개면 프론트가 계정 폴백 표시.
import { listAccounts } from "~/lib/radar/accounts.server";
import { cached } from "~/lib/radar/http.server";
import { getThreadsPosts } from "~/lib/radar/threads.server";

export async function loader({ request }: { request: Request }) {
  const force = new URL(request.url).searchParams.get("force") === "1";
  const accounts = await listAccounts("threads");
  const { data, fetchedAt } = await cached(`threads:${accounts.join(",")}`, force, () =>
    getThreadsPosts(accounts),
  );
  return Response.json({ posts: data, accounts, fetchedAt });
}
