"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { compressForUpload } from "@/lib/compress-file";

const LABELS = ["Договор", "Условия / вакансии", "Фото жилья", "Реквизиты", "Другое"];

/** Adds a document to an employer card: pick what it is, then the file. */
export function EmployerFileUpload({ id }: { id: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState(LABELS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        list="employer-file-labels"
        className="field min-w-[200px] flex-1 py-2 text-[15px]"
        aria-label="Что за документ"
        placeholder="Что за документ"
      />
      <datalist id="employer-file-labels">
        {LABELS.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>
      <input
        ref={input}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={async (e) => {
          const picked = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (!picked) return;
          setBusy(true);
          setError(null);
          try {
            const fd = new FormData();
            fd.append("file", await compressForUpload(picked));
            const res = await fetch(`/api/admin/employer/upload?id=${encodeURIComponent(id)}&label=${encodeURIComponent(label.trim() || "Документ")}`, {
              method: "POST",
              body: fd,
            });
            const j = (await res.json().catch(() => ({}))) as { message?: string };
            if (!res.ok) throw new Error(j.message || `Ошибка ${res.status}`);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setBusy(false);
          }
        }}
      />
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className="btn-primary min-h-10 px-4 text-[14px] disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Загрузить файл
      </button>
      {error && <p className="w-full text-[13px] text-warn">{error}</p>}
    </div>
  );
}
