"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Upload, X } from "lucide-react";
import { savePlanAction } from "@/app/admin/actions";
import { PLAN_PRESETS, formatTenge, type PlanItem } from "@/lib/cabinet/payments";
import { compressForUpload } from "@/lib/compress-file";
import { ActionForm, SubmitButton } from "./ui";

/** Payment pieces of the client card that need the browser: the plan editor and «+ чек». */

type Row = { title: string; amount: string; due: string };
const MAX_ROWS = 6;
const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Plan of the payment: prepayment, the rest, debt… Presets fill the rows from the sum to pay. */
export function PlanEditor({ id, total, plan }: { id: string; total: number; plan?: PlanItem[] }) {
  const [rows, setRows] = useState<Row[]>(() =>
    plan?.length ? plan.map((p) => ({ title: p.title, amount: String(p.amount), due: p.dueDate ?? "" })) : [{ title: "", amount: "", due: "" }]
  );
  const sum = rows.reduce((s, r) => s + (Number(r.amount.replace(/\D/g, "")) || 0), 0);
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const preset = (id: string) => {
    const p = PLAN_PRESETS.find((x) => x.id === id);
    if (!p || !total) return;
    let left = total;
    setRows(
      p.parts.map((part, i) => {
        // Round to 1000 ₸; the last part takes what is left so the sum is exact.
        const amount = i === p.parts.length - 1 ? left : Math.round((total * part.share) / 1000) * 1000;
        left -= amount;
        return { title: part.title, amount: String(amount), due: addDays(part.days) };
      })
    );
  };

  return (
    <ActionForm action={savePlanAction} className="grid gap-3">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[13px] text-muted">Шаблон:</span>
        {PLAN_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={!total}
            onClick={() => preset(p.id)}
            className="rounded-full border border-line bg-white px-3 py-1 text-[13px] font-medium hover:border-brand hover:text-brand disabled:opacity-50"
            title={total ? undefined : "Сначала укажите сумму договора"}
          >
            {p.title}
          </button>
        ))}
      </div>
      <div className="grid gap-2">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-line bg-surface/50 p-2 sm:grid-cols-[1.3fr_1fr_1fr_auto] sm:items-center sm:border-0 sm:bg-transparent sm:p-0">
            <input
              name={`title_${i}`}
              value={r.title}
              onChange={(e) => set(i, { title: e.target.value })}
              placeholder="Предоплата / Остаток / В долг"
              className="field col-span-2 min-w-0 py-2 text-[14px] sm:col-span-1"
              aria-label="Что за часть"
            />
            <input
              name={`amount_${i}`}
              value={r.amount}
              onChange={(e) => set(i, { amount: e.target.value })}
              inputMode="numeric"
              placeholder="Сумма, ₸"
              className="field min-w-0 py-2 text-[14px]"
              aria-label="Сумма"
            />
            <input
              name={`due_${i}`}
              type="date"
              value={r.due}
              onChange={(e) => set(i, { due: e.target.value })}
              className="field min-w-0 py-2 text-[14px]"
              aria-label="Оплатить до"
              title="Оплатить до"
            />
            <button
              type="button"
              onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [{ title: "", amount: "", due: "" }]))}
              className="row-start-2 flex h-9 w-9 items-center justify-center self-center justify-self-end rounded-lg text-muted hover:bg-red-50 hover:text-red-600 sm:row-start-auto"
              aria-label="Убрать строку"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {rows.length < MAX_ROWS && (
          <button type="button" onClick={() => setRows((rs) => [...rs, { title: "", amount: "", due: "" }])} className="btn-ghost min-h-9 px-3 text-[13px]">
            <Plus className="h-4 w-4" /> Ещё часть
          </button>
        )}
        <SubmitButton className="btn-primary min-h-9 px-4 text-[14px]" pendingText="Сохраняем…">
          Сохранить план
        </SubmitButton>
        <span className={`text-[13px] ${total && sum !== total ? "font-semibold text-warn" : "text-muted"}`}>
          Сумма частей: {formatTenge(sum)}
          {total ? (sum === total ? " ✓" : ` · к оплате ${formatTenge(total)}`) : ""}
        </span>
      </div>
    </ActionForm>
  );
}

/** Uploads one or more receipts to a payment, one request per file (each stays under the size limit). */
export async function uploadReceipts(id: string, key: string, files: File[]) {
  for (const f of files) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("key", key);
    fd.set("file", await compressForUpload(f));
    const res = await fetch("/api/admin/cabinet/payment/receipt", { method: "POST", body: fd });
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) throw new Error(j.message || `Ошибка ${res.status}`);
  }
}

/** «+ чек» next to a payment: pick one or several files. */
export function AddReceiptButton({ id, paymentKey }: { id: string; paymentKey: string }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        multiple
        accept="application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={async (e) => {
          const files = [...(e.currentTarget.files ?? [])];
          e.currentTarget.value = "";
          if (!files.length) return;
          setBusy(true);
          setError(null);
          try {
            await uploadReceipts(id, paymentKey, files);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setBusy(false);
          }
        }}
      />
      <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="btn-ghost min-h-8 px-2.5 text-[13px] disabled:opacity-60">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} чек
      </button>
      {error && <span className="w-full text-[12.5px] text-warn">{error}</span>}
    </>
  );
}
