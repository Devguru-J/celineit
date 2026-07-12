// 계정 관리: Supabase Auth Admin API 로 계정 목록·추가·비밀번호 변경·삭제.
// service key 는 서버(action/loader)에서만 사용된다. 대시보드 접속 불필요.
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { Card } from "~/components/ui";
import { createUser, deleteUser, listUsers, updateUserPassword } from "~/lib/auth.server";

export function meta() {
  return [{ title: "Celine Intelligence · 계정 관리" }];
}

export async function loader() {
  try {
    const users = await listUsers();
    return { users, configured: true as const };
  } catch {
    // SUPABASE_URL/KEY 미설정(로컬 dev) 또는 Admin API 오류
    return { users: [], configured: false as const };
  }
}

export async function action({ request }: { request: Request }) {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (intent === "create") {
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "이메일 형식이 올바르지 않습니다." };
    if (password.length < 8) return { error: "비밀번호는 8자 이상이어야 합니다." };
    const r = await createUser(email, password);
    return r.error ? { error: r.error } : { ok: `${email} 계정을 만들었습니다.` };
  }
  if (intent === "password") {
    const id = String(form.get("id") ?? "");
    const password = String(form.get("password") ?? "");
    if (!id) return { error: "대상 계정이 없습니다." };
    if (password.length < 8) return { error: "비밀번호는 8자 이상이어야 합니다." };
    const r = await updateUserPassword(id, password);
    return r.error ? { error: r.error } : { ok: "비밀번호를 변경했습니다." };
  }
  if (intent === "delete") {
    const id = String(form.get("id") ?? "");
    if (!id) return { error: "대상 계정이 없습니다." };
    const r = await deleteUser(id);
    return r.error ? { error: r.error } : { ok: "계정을 삭제했습니다." };
  }
  return { error: "알 수 없는 요청입니다." };
}

function dateLabel(iso: string | null) {
  return iso ? iso.slice(0, 10) : "—";
}

export default function AdminUsers() {
  const { users, configured } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  return (
    <div className="space-y-card-gap p-4 sm:p-container-padding">
      <div>
        <h1 className="font-headline-sm text-headline-sm">계정 관리</h1>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          이 사이트에 로그인할 수 있는 계정을 관리합니다. 비밀번호는 안전하게 Supabase Auth 에 저장됩니다.
        </p>
      </div>

      {actionData?.error && (
        <Card className="border-error/40 p-3 font-body-sm text-body-sm text-error">{actionData.error}</Card>
      )}
      {actionData?.ok && (
        <Card className="p-3 font-body-sm text-body-sm text-on-surface-variant">✓ {actionData.ok}</Card>
      )}
      {!configured && (
        <Card className="p-3 font-body-sm text-body-sm text-on-surface-variant">
          인증 서버가 설정되지 않았습니다 (SUPABASE_URL / SUPABASE_SERVICE_KEY). 배포 환경에서 사용해 주세요.
        </Card>
      )}

      {/* 계정 추가 */}
      <Card className="p-4">
        <h2 className="mb-3 font-title-md text-title-md">계정 추가</h2>
        <Form method="post" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="intent" value="create" />
          <div className="flex min-w-56 flex-1 flex-col gap-1">
            <label htmlFor="new-email" className="font-label-muted text-label-muted text-on-surface-variant">이메일</label>
            <input
              id="new-email"
              name="email"
              type="email"
              required
              placeholder="name@company.com"
              className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 font-body-sm text-body-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex min-w-48 flex-col gap-1">
            <label htmlFor="new-password" className="font-label-muted text-label-muted text-on-surface-variant">초기 비밀번호 (8자 이상)</label>
            <input
              id="new-password"
              name="password"
              type="text"
              required
              minLength={8}
              placeholder="임시 비밀번호"
              autoComplete="off"
              className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 font-body-sm text-body-sm focus:border-primary focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !configured}
            className="rounded-lg bg-primary px-5 py-2 font-body-sm text-body-sm font-semibold text-on-primary transition-[filter] hover:brightness-105 disabled:opacity-50"
          >
            추가
          </button>
        </Form>
      </Card>

      {/* 계정 목록 */}
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="border-b border-outline-variant font-label-muted text-label-muted text-on-surface-variant">
              <th className="px-4 py-3 font-medium">이메일</th>
              <th className="px-4 py-3 font-medium">생성일</th>
              <th className="px-4 py-3 font-medium">마지막 로그인</th>
              <th className="px-4 py-3 font-medium">비밀번호 변경</th>
              <th className="px-4 py-3 font-medium">삭제</th>
            </tr>
          </thead>
          <tbody className="font-body-sm text-body-sm">
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-on-surface-variant">
                  {configured ? "등록된 계정이 없습니다. 위에서 추가해 주세요." : "—"}
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-b border-outline-variant/60 last:border-0">
                <td className="px-4 py-3 font-medium">{u.email}</td>
                <td className="px-4 py-3 text-on-surface-variant">{dateLabel(u.createdAt)}</td>
                <td className="px-4 py-3 text-on-surface-variant">{dateLabel(u.lastSignInAt)}</td>
                <td className="px-4 py-3">
                  <Form method="post" className="flex items-center gap-2">
                    <input type="hidden" name="intent" value="password" />
                    <input type="hidden" name="id" value={u.id} />
                    <input
                      name="password"
                      type="text"
                      required
                      minLength={8}
                      placeholder="새 비밀번호"
                      autoComplete="off"
                      className="w-36 rounded-lg border border-outline-variant bg-surface-container-low px-2.5 py-1.5 font-body-sm text-body-sm focus:border-primary focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-lg border border-outline-variant px-3 py-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-50"
                    >
                      변경
                    </button>
                  </Form>
                </td>
                <td className="px-4 py-3">
                  <Form
                    method="post"
                    onSubmit={(e) => {
                      if (!confirm(`${u.email} 계정을 삭제할까요? 되돌릴 수 없습니다.`)) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={u.id} />
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-lg border border-error/40 px-3 py-1.5 text-error transition-colors hover:bg-error-container/40 disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </Form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="font-body-sm text-body-sm text-on-surface-variant">
        ※ 모든 로그인 계정이 이 화면에 접근할 수 있습니다(역할 구분 없음). 자가 가입은 막혀 있으므로
        계정 추가는 여기서만 가능합니다.
      </p>
    </div>
  );
}
