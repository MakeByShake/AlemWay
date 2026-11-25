import { getAdminUsers } from "@/lib/admin/data";
import { ROLE_OPTIONS, ROLE_TITLES, isTopRole, requireAdminUser } from "@/lib/admin/session";
import { addManagerAction, removeManagerAction, renameMemberAction, setConsultantAction, setPasswordAction, setRoleAction } from "../../actions";
import { Badge, PageTitle, fmtDate } from "@/components/admin/bits";
import { ActionForm, AutoSelect, ConfirmForm, SubmitButton } from "@/components/admin/ui";

export const metadata = { title: "Команда" };

export default async function TeamPage() {
  const me = await requireAdminUser();
  // The administrator manages accounts; the founder sees the whole team but doesn't change it.
  const owner = me.role === "owner";
  const seeTeam = isTopRole(me.role);
  const users = seeTeam ? await getAdminUsers() : [];

  return (
    <>
      <PageTitle title="Команда и пароль" />
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="card p-4 sm:p-6">
          <h2 className="text-[18px] font-bold">Мой пароль</h2>
          <p className="mt-1 text-[14px] text-muted">
            Логин: <b className="text-ink">{me.login}</b>
          </p>
          <ActionForm action={setPasswordAction} className="mt-4 flex flex-wrap gap-2" resetOnSuccess>
            <input name="password" type="password" autoComplete="new-password" minLength={8} required placeholder="Новый пароль (мин. 8 символов)" className="field max-w-xs flex-1" />
            <SubmitButton pendingText="Сохраняем…">Сменить</SubmitButton>
          </ActionForm>
        </section>

        {owner && (
          <section className="card p-4 sm:p-6">
            <h2 className="text-[18px] font-bold">Добавить менеджера</h2>
            <p className="mt-1 text-[14px] text-muted">Отдел продаж — только свои клиенты (просмотр, договор и чеки). Операционный отдел — вся работа с клиентами. Учредитель — видит всё, включая деньги и действия каждого. Администратор — ещё команда и сайт.</p>
            <ActionForm action={addManagerAction} className="mt-4 grid gap-3 sm:grid-cols-2" resetOnSuccess>
              <label className="grid gap-1 text-[14px] font-medium">
                Имя
                <input name="name" required placeholder="Алиби" className="field py-2" />
              </label>
              <label className="grid gap-1 text-[14px] font-medium">
                Логин (латиницей)
                <input name="login" required pattern="[a-z0-9_.\-]{3,30}" autoCapitalize="none" placeholder="alibi" className="field py-2" />
              </label>
              <label className="grid gap-1 text-[14px] font-medium">
                Пароль
                <input name="password" type="text" required minLength={8} placeholder="минимум 8 символов" className="field py-2" />
              </label>
              <label className="grid gap-1 text-[14px] font-medium">
                Роль
                <select name="role" className="field py-2">
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {ROLE_TITLES[o.value]}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <SubmitButton pendingText="Добавляем…">Добавить</SubmitButton>
              </div>
            </ActionForm>
          </section>
        )}
      </div>

      {seeTeam && (
        <section className="card mt-5 p-4 sm:p-6">
          <h2 className="text-[18px] font-bold">Все, у кого есть доступ</h2>
          <ul className="mt-3 divide-y divide-line">
            {users.map((u) => (
              <li key={u._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {u.name} <span className="font-normal text-muted">· {u.login}</span>{" "}
                    <Badge tone={isTopRole(u.role) ? "blue" : u.role === "sales" ? "amber" : "gray"}>{ROLE_TITLES[u.role] ?? ROLE_TITLES.manager}</Badge>
                  </p>
                  <p className="text-[13px] text-muted">добавлен {fmtDate(u.createdAt, false)}</p>
                  {owner && (
                  <>
                  <ActionForm action={renameMemberAction} className="mt-1.5 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="login" value={u.login} />
                    <input name="name" defaultValue={u.name} required minLength={2} maxLength={60} aria-label="Имя" className="field w-44 py-1.5 text-[14px]" />
                    <SubmitButton className="btn-ghost min-h-9 px-3 text-[13px]" pendingText="Сохраняем…">
                      Изменить имя
                    </SubmitButton>
                  </ActionForm>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px]">
                    <span className="text-muted">Консультации:</span>
                    <AutoSelect
                      action={setConsultantAction}
                      hidden={{ login: u.login }}
                      name="consultant"
                      label="Ведёт консультации"
                      value={u.consultant ? "yes" : "no"}
                      options={[
                        { value: "no", title: "не ведёт" },
                        { value: "yes", title: "✅ ведёт (видно на сайте)" },
                      ]}
                    />
                  </div>
                  </>
                  )}
                </div>
                {owner && u.login !== me.login && (
                  <div className="flex flex-wrap items-center gap-3">
                    <AutoSelect
                      action={setRoleAction}
                      hidden={{ login: u.login }}
                      name="role"
                      label="Роль"
                      value={u.role ?? "manager"}
                      options={ROLE_OPTIONS.map((o) => ({ value: o.value, title: o.title }))}
                    />
                    <ActionForm action={setPasswordAction} className="flex flex-wrap gap-2" resetOnSuccess>
                      <input type="hidden" name="login" value={u.login} />
                      <input name="password" type="text" minLength={8} required placeholder="Новый пароль" className="field w-40 py-1.5 text-[14px]" />
                      <SubmitButton className="btn-ghost min-h-9 px-3 text-[13px]">Сбросить</SubmitButton>
                    </ActionForm>
                    <ConfirmForm action={removeManagerAction} hidden={{ login: u.login }} confirmText={`Убрать доступ у ${u.name}?`}>
                      Убрать доступ
                    </ConfirmForm>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
