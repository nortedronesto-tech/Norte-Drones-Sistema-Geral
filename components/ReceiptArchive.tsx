"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip } from "lucide-react";
import { submitAttachment } from "@/lib/offline-finance";
import { formatBRL, formatDate } from "@/lib/format";
import { ReceiptLink, ReceiptThumb } from "./ReceiptViewer";

export type ArchiveRow = {
  id: string; date: string; amount: number; type: "entrada" | "saida"; category: string;
  description: string | null; supplier: string | null; account: string | null;
  receipt_path: string | null; receipt_url: string | null;
};

function AttachButton({ row }: { row: ArchiveRow }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "busy" | "queued" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function pick(file: File | undefined) {
    if (!file) return;
    setState("busy"); setMsg("");
    const label = `Recibo de ${formatBRL(row.amount)} · ${row.category}`;
    const res = await submitAttachment({ transactionId: row.id, date: row.date, label, file });
    if (res.mode === "sent") { setState("idle"); router.refresh(); }
    else if (res.mode === "queued") { setState("queued"); setMsg("Guardado no aparelho. Vai sozinho quando o sinal voltar."); }
    else { setState("error"); setMsg(res.error); }
    if (ref.current) ref.current.value = "";
  }

  return (
    <div className="mt-2">
      <input ref={ref} type="file" accept="image/*" capture="environment" className="sr-only" id={`att-${row.id}`} onChange={(e) => void pick(e.target.files?.[0])} />
      <label htmlFor={`att-${row.id}`} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-green/10 px-3 py-1.5 text-sm font-bold text-brand-green hover:bg-brand-green/15 ${state === "busy" ? "pointer-events-none opacity-60" : ""}`}>
        <Paperclip className="size-4" aria-hidden /> {state === "busy" ? "Anexando…" : "Anexar recibo"}
      </label>
      {msg && <p className={`mt-1 text-xs font-semibold ${state === "error" ? "text-danger" : "text-brand-graphite/70"}`} role="status">{msg}</p>}
    </div>
  );
}

export function ReceiptArchive({ rows, canWrite }: { rows: ArchiveRow[]; canWrite: boolean }) {
  return (
    <ul className="divide-y divide-black/[0.06]">
      {rows.map((r) => (
        <li key={r.id} className="flex gap-3 py-3">
          {r.receipt_path && r.receipt_url
            ? <ReceiptThumb path={r.receipt_path} url={r.receipt_url} alt={`Recibo de ${r.category}`} />
            : <div className="grid size-16 shrink-0 place-items-center rounded-lg bg-black/[0.05] text-brand-graphite/40" aria-hidden><Paperclip className="size-5" /></div>}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate font-semibold">{r.description || r.category}</p>
              <p className={`shrink-0 font-bold ${r.type === "entrada" ? "text-brand-green" : "text-brand-dark"}`}>{formatBRL(r.amount)}</p>
            </div>
            <p className="text-xs text-brand-graphite/65">{formatDate(r.date)} · {r.category}{r.supplier ? ` · ${r.supplier}` : ""}{r.account ? ` · ${r.account}` : ""}</p>
            {r.receipt_path && r.receipt_url ? <div className="mt-2"><ReceiptLink path={r.receipt_path} url={r.receipt_url} /></div> : canWrite ? <AttachButton row={r} /> : <p className="mt-1 text-xs text-brand-graphite/55">Sem recibo.</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
