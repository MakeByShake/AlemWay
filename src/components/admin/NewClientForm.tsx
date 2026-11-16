"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, FileText, Loader2, Upload } from "lucide-react";
import { createCabinetAction, type ActionState } from "@/app/admin/actions";
import { PAYMENT_METHODS } from "@/lib/cabinet/payments";
import { compressForUpload } from "@/lib/compress-file";
import { LinkBox } from "./ui";

type Member = { login: string; name: string };

/** Picks files and shows them as a list (with «×»). */
function FilePick({ label, files, setFiles, multiple }: { label: string; files: File[]; setFiles: (f: File[]) => void; multiple?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="grid gap-1.5 text-[14px] font-medium">
      {label}
      <input
        ref={ref}
        type="file"
        multiple={multiple}
        accept="application/pdf,image/jpeg,image/png"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const picked = [...(e.target.files ?? [])];
          e.target.value = "";
          setFiles(multiple ? [...files, ...picked].slice(0, 10) : picked.slice(0, 1));
        }}
      />
      {files.map((f, i) => (
        <div key={`${f.name}-${i}`} className="flex min-h-[40px] items-center gap-2 rounded-xl border border-accent/50 bg-accent-soft px-3 text-[14px] font-normal">
          <Check className="h-4 w-4 shrink-0 text-accent" />
          <span className="min-w-0 flex-1 truncate" title={f.name}>
            {f.name}
          </span>
          <button type="button" aria-label="Убрать" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="px-1 text-[16px] text-muted hover:text-red-600">
            ×
          </button>
        </div>
      ))}
      {(multiple || files.length === 0) && (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-dashed border-brand/50 bg-brand-soft/40 px-3 text-[14px] font-semibold text-brand hover:border-brand hover:bg-brand-soft"
        >
          <Upload className="h-4 w-4" /> {files.length ? "Добавить ещё" : "Загрузить"}
        </button>
      )}
    </div>
  );
}

/**
 * «+ Новый клиент»: name, phone, service, price — and right away the contract and the first payment with
 * its receipts. «Отдел продаж» gets the same form: the client becomes theirs and the team is notified.
 */
export function NewClientForm({ full, isOwner, me, members }: { full: boolean; isOwner: boolean; me: string; members: Member[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ActionState>(null);
  const [contract, setContract] = useState<File[]>([]);
  const [receipts, setReceipts] = useState<File[]>([]);
  const [contacts, setContacts] = useState(0);

  const post = async (url: string, fd: FormData) => {
    const res = await fetch(url, { method: "POST", body: fd });
    const j = (await res.json().catch(() => ({}))) as { message?: string; key?: string };
    if (!res.ok) throw new Error(j.message || `Ошибка ${res.status}`);
    return j;
  };

  if (done?.ok && done.link)
    return (
      <div className="mt-4 grid gap-3">
        <p className="text-[15px] font-semibold text-[#0a7a42]">
          ✓ Клиент создан{!full && " — команда получила уведомление и свяжется с ним"}
        </p>
        <LinkBox link={done.link} phone={done.phone} name={done.clientName} curator={done.curator} service={done.service} />
        <div className="flex flex-wrap gap-2">
          {done.id && (
            <Link prefetch={false} href={`/admin/clients/${done.id}`} className="btn-primary min-h-10 px-4 text-[14px]">
              Открыть карточку клиента →
            </Link>
          )}
          <button
            type="button"
            className="btn-ghost min-h-10 px-4 text-[14px]"
            onClick={() => {
              setDone(null);
              setContract([]);
              setReceipts([]);
              setContacts(0);
            }}
          >
            + Ещё клиент
          </button>
        </div>
      </div>
    );

  return (
    <form
      className="mt-4 grid gap-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        setError(null);
        try {
          setBusy("Создаём клиента…");
          const res = await createCabinetAction(null, fd);
          if (!res?.ok || !res.id) throw new Error(res?.error || "Не получилось создать клиента");
          const id = res.id;
          if (contract[0]) {
            setBusy("Загружаем договор…");
            const c = new FormData();
            c.set("file", await compressForUpload(contract[0]));
            await post(`/api/admin/cabinet/upload?id=${encodeURIComponent(id)}&kind=contract`, c);
          }
          const amount = String(fd.get("paid") ?? "").trim();
          if (amount) {
            setBusy("Сохраняем оплату и чеки…");
            const p = new FormData();
            p.set("id", id);
            p.set("amount", amount);
            p.set("method", String(fd.get("method") ?? "kaspi"));
            p.set("note", "Оплата при оформлении");
            if (receipts[0]) p.set("file", await compressForUpload(receipts[0]));
            const { key } = await post("/api/admin/cabinet/payment", p);
            for (const r of receipts.slice(1)) {
              const x = new FormData();
              x.set("id", id);
              x.set("key", key ?? "");
              x.set("file", await compressForUpload(r));
              await post("/api/admin/cabinet/payment/receipt", x);
            }
          }
          setDone(res);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(null);
        }
      }}
    >
      <label className="grid gap-1 text-[14px] font-medium">
        Имя клиента
        <input name="clientName" required minLength={2} className="field" placeholder="Айгерим Нурланова" />
      </label>
      <label className="grid gap-1 text-[14px] font-medium">
        Телефон (WhatsApp)
        <input name="clientPhone" required className="field" placeholder="+7 777 123 45 67" />
      </label>
      {Array.from({ length: contacts }, (_, i) => (
        <div key={i} className="grid grid-cols-[1fr_1.3fr] gap-2 sm:col-span-2">
          <input name={`contact_label_${i}`} className="field" placeholder="Кто: мама, папа, 2-й номер" aria-label="Кто это" />
          <input name={`contact_phone_${i}`} className="field" placeholder="+7 777 123 45 67" aria-label="Телефон" />
        </div>
      ))}
      {contacts < 10 && (
        <button type="button" onClick={() => setContacts((n) => n + 1)} className="justify-self-start text-[14px] font-semibold text-brand hover:underline sm:col-span-2">
          + ещё контакт (мама, папа, второй номер)
        </button>
      )}
      <label className="grid gap-1 text-[14px] font-medium">
        Услуга
        <select name="service" className="field">
          <option value="ferienjob">🇩🇪 Германия (Ferienjob)</option>
          <option value="keta">🇰🇷 K-ETA</option>
        </select>
      </label>
      <label className="grid gap-1 text-[14px] font-medium">
        Сумма договора, ₸
        <input name="price" inputMode="numeric" className="field" placeholder="750000" />
      </label>

      <div className="grid gap-3 rounded-xl bg-surface p-3 sm:col-span-2 sm:grid-cols-2">
        <p className="flex items-center gap-1.5 text-[14px] font-bold sm:col-span-2">
          <FileText className="h-4 w-4" /> Договор и оплата (можно потом)
        </p>
        <FilePick label="Договор" files={contract} setFiles={setContract} />
        <div className="grid content-start gap-3">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <label className="grid gap-1 text-[14px] font-medium">
              Оплачено сейчас, ₸
              <input name="paid" inputMode="numeric" className="field" placeholder="например 375000" />
            </label>
            <label className="grid gap-1 text-[14px] font-medium">
              Способ
              <select name="method" className="field">
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <FilePick label="Чеки (можно несколько)" files={receipts} setFiles={setReceipts} multiple />
        </div>
      </div>

      {full && (
        <>
          <label className="grid gap-1 text-[14px] font-medium">
            🤝 Кто продал
            <select name="seller" defaultValue="" className="field">
              <option value="">— не указано —</option>
              {members.map((m) => (
                <option key={m.login} value={m.login}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          {isOwner && (
            <label className="grid gap-1 text-[14px] font-medium">
              👤 Кто ведёт документы
              <select name="manager" defaultValue={me} className="field">
                <option value="">— не назначен —</option>
                {members.map((m) => (
                  <option key={m.login} value={m.login}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
      {!full && <p className="text-[13px] text-muted sm:col-span-2">Клиент будет закреплён за вами. Команда получит уведомление, назначит ведущего и свяжется с клиентом. Оплату подтвердит менеджер.</p>}

      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <button type="submit" disabled={busy !== null} className="btn-primary disabled:opacity-60">
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {busy}
            </>
          ) : (
            "Создать клиента"
          )}
        </button>
      </div>
      {error && <p className="rounded-lg bg-warn-soft px-3 py-2 text-[14px] text-warn sm:col-span-2">{error}</p>}
    </form>
  );
}
