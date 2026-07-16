// 계정 관리: Supabase Auth Admin API 로 계정 목록·추가·비밀번호 변경·삭제.
// service key 는 서버(action/loader)에서만 사용된다. 대시보드 접속 불필요.
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { Panel } from "~/components/ui";
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
    <div className="mx-auto max-w-[1080px] space-y-6 p-4 sm:p-8">
      <header>
        <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Access control</span>
        <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-on-surface">계정 관리</h1>
        <p className="mt-1.5 max-w-[60ch] font-body-sm text-body-sm text-on-surface-variant">
          이 사이트에 로그인할 수 있는 계정을 관리합니다. 비밀번호는 안전하게 Supabase Auth 에 저장됩니다.
        </p>
      </header>

      {actionData?.error && (
        <div className="flex items-start gap-2.5 rounded-xl bg-danger/10 p-4 font-body-sm text-body-sm text-danger">
          <span className="material-symbols-outlined notranslate text-[18px]">error</span>
          {actionData.error}
        </div>
      )}
      {actionData?.ok && (
        <div className="flex items-start gap-2.5 rounded-xl bg-success/10 p-4 font-body-sm text-body-sm text-success">
          <span className="material-symbols-outlined notranslate text-[18px]">check_circle</span>
          <span className="text-on-surface">{actionData.ok}</span>
        </div>
      )}
      {!configured && (
        <div className="flex items-start gap-2.5 rounded-xl bg-warning/10 p-4 font-body-sm text-body-sm text-warning">
          <span className="material-symbols-outlined notranslate text-[18px]">info</span>
          <span className="text-on-surface-variant">
            인증 서버가 설정되지 않았습니다 (SUPABASE_URL / SUPABASE_SERVICE_KEY). 배포 환경에서 사용해 주세요.
          </span>
        </div>
      )}

      {/* 계정 추가 */}
      <Panel className="p-5 sm:p-7">
        <h2 className="font-headline-sm text-headline-sm">계정 추가</h2>
        <p className="mt-1 font-label-muted text-label-muted text-on-surface-variant">
          초대할 팀원의 이메일과 임시 비밀번호를 입력하세요. 첫 로그인 후 비밀번호를 바꾸도록 안내해 주세요.
        </p>
        <Form method="post" className="mt-5 flex flex-wrap items-end gap-4">
          <input type="hidden" name="intent" value="create" />
          <div className="flex min-w-56 flex-1 flex-col gap-1.5">
            <label htmlFor="new-email" className="font-label-muted text-label-muted text-on-surface-variant">이메일</label>
            <input
              id="new-email"
              name="email"
              type="email"
              required
              placeholder="name@company.com"
              className="rounded-lg border border-transparent bg-surface-container-low px-3.5 py-2.5 font-body-sm text-body-sm transition-colors duration-200 placeholder:text-on-surface-variant/60 focus:border-primary/50 focus:outline-none"
            />
          </div>
          <div className="flex min-w-48 flex-col gap-1.5">
            <label htmlFor="new-password" className="font-label-muted text-label-muted text-on-surface-variant">초기 비밀번호 (8자 이상)</label>
            <input
              id="new-password"
              name="password"
              type="text"
              required
              minLength={8}
              placeholder="임시 비밀번호"
              autoComplete="off"
              className="rounded-lg border border-transparent bg-surface-container-low px-3.5 py-2.5 font-body-sm text-body-sm transition-colors duration-200 placeholder:text-on-surface-variant/60 focus:border-primary/50 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !configured}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 font-body-sm text-body-sm font-semibold text-on-primary shadow-[0_2px_12px_rgba(200,164,93,0.3)] transition-all duration-200 hover:bg-primary-fixed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
          >
            <span className="material-symbols-outlined notranslate text-[18px]">add</span>
            추가
          </button>
        </Form>
      </Panel>

      {/* 계정 목록 */}
      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 sm:px-7 sm:pt-6">
          <h2 className="font-headline-sm text-headline-sm">계정 목록</h2>
          <span className="rounded-full bg-surface-container-lowest px-2.5 py-1 font-label-muted text-[11px] tabular-nums text-on-surface-variant">
            {users.length}명
          </span>
        </div>
        <div className="mt-4 overflow-x-auto pb-2">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="bg-white/[0.02] font-label-caps text-label-caps uppercase text-on-surface-variant">
                <th className="px-6 py-3.5 font-semibold sm:px-7">이메일</th>
                <th className="px-6 py-3.5 font-semibold sm:px-7">생성일</th>
                <th className="px-6 py-3.5 font-semibold sm:px-7">마지막 로그인</th>
                <th className="px-6 py-3.5 font-semibold sm:px-7">비밀번호 변경</th>
                <th className="px-6 py-3.5 font-semibold sm:px-7">삭제</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-body-sm text-body-sm">
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-14 text-center">
                    <span className="material-symbols-outlined notranslate mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-lowest text-[24px] text-on-surface-variant">
                      group
                    </span>
                    <p className="mt-3 font-body-md text-body-md text-on-surface">
                      {configured ? "등록된 계정이 없습니다" : "인증 서버 미설정"}
                    </p>
                    <p className="mt-1 text-on-surface-variant">
                      {configured ? "위의 계정 추가에서 첫 팀원을 초대해 주세요." : "배포 환경에서 확인해 주세요."}
                    </p>
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="transition-colors duration-200 hover:bg-surface-container-low/50">
                  <td className="px-6 py-4 font-medium sm:px-7">{u.email}</td>
                  <td className="px-6 py-4 tabular-nums text-on-surface-variant sm:px-7">{dateLabel(u.createdAt)}</td>
                  <td className="px-6 py-4 tabular-nums text-on-surface-variant sm:px-7">{dateLabel(u.lastSignInAt)}</td>
                  <td className="px-6 py-4 sm:px-7">
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
                        className="w-36 rounded-lg border border-transparent bg-surface-container-low px-3 py-2 font-body-sm text-body-sm transition-colors duration-200 placeholder:text-on-surface-variant/60 focus:border-primary/50 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={busy}
                        className="rounded-lg bg-surface-container-lowest px-3.5 py-2 text-on-surface-variant transition-colors duration-200 hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 active:scale-[0.98] disabled:opacity-50"
                      >
                        변경
                      </button>
                    </Form>
                  </td>
                  <td className="px-6 py-4 sm:px-7">
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
                        className="rounded-lg px-3.5 py-2 text-danger transition-colors duration-200 hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/60 active:scale-[0.98] disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </Form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <p className="font-label-muted text-label-muted text-on-surface-variant">
        모든 로그인 계정이 이 화면에 접근할 수 있습니다(역할 구분 없음). 자가 가입은 막혀 있으므로 계정 추가는 여기서만 가능합니다.
      </p>
    </div>
  );
}
