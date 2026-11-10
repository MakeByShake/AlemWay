import { FEEDBACK_STATUS_LIST, FEEDBACK_TOPIC_TITLES, getFeedback } from "@/lib/admin/data";
import { isFullRole, requireAdminUser } from "@/lib/admin/session";
import { deleteFeedbackAction, updateFeedbackAction } from "../../actions";
import { Empty, FilterTabs, PageTitle, fmtDate } from "@/components/admin/bits";
import { AutoSelect, ConfirmForm, NoteForm } from "@/components/admin/ui";

export const metadata = { title: "Отзывы" };

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const valid = FEEDBACK_STATUS_LIST.some((s) => s.value === status) ? status : undefined;
  const [items, me] = await Promise.all([getFeedback(valid), requireAdminUser()]);
  // «owner» here = full rights (owner or manager); «Отдел продаж» is read-only.
  const owner = isFullRole(me.role);
  const rated = items.filter((i) => i.rating);
  const avg = rated.length ? (rated.reduce((a, i) => a + (i.rating ?? 0), 0) / rated.length).toFixed(1) : null;

  return (
    <>
      <PageTitle title="Отзывы о сайте и работе">{avg && <p className="text-[15px] text-muted">Средняя оценка: <b className="text-ink">{avg} ★</b></p>}</PageTitle>
      <FilterTabs base="/admin/feedback" current={valid} items={[...FEEDBACK_STATUS_LIST]} />
      {items.length === 0 ? (
        <Empty>Отзывов нет</Empty>
      ) : (
        <ul className="grid gap-3">
          {items.map((f) => (
            <li key={f._id} className="card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[20px] tracking-wide text-amber-500" aria-label={`Оценка ${f.rating}`}>
                    {"★".repeat(f.rating ?? 0)}
                    <span className="text-line">{"★".repeat(5 - (f.rating ?? 0))}</span>
                  </p>
                  <p className="text-[14px] text-muted">
                    {FEEDBACK_TOPIC_TITLES[f.topic ?? ""] ?? "—"} · {fmtDate(f.createdAt)}
                    {f.name ? ` · ${f.name}` : ""}
                    {f.contact ? ` · ${f.contact}` : ""}
                  </p>
                </div>
                {owner && <AutoSelect action={updateFeedbackAction} hidden={{ id: f._id }} name="status" value={f.status ?? "new"} options={FEEDBACK_STATUS_LIST} />}
              </div>
              {f.liked && (
                <p className="mt-3 text-[15px]">
                  <b>👍 Понравилось:</b> {f.liked}
                </p>
              )}
              {f.improve && (
                <p className="mt-2 text-[15px]">
                  <b>🛠 Улучшить:</b> {f.improve}
                </p>
              )}
              {owner && (
                <>
              <div className="mt-3">
                <NoteForm action={updateFeedbackAction} id={f._id} value={f.managerNote} placeholder="Что решили сделать…" />
              </div>
              <div className="mt-3 flex justify-end border-t border-line pt-3">
                <ConfirmForm action={deleteFeedbackAction} hidden={{ id: f._id }} confirmText="Удалить этот отзыв?">
                  Удалить
                </ConfirmForm>
              </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
