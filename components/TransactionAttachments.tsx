"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus } from "lucide-react";
import { submitAttachment } from "@/lib/offline-finance";
import { MAX_ANEXOS } from "@/lib/receipts";
import { ReceiptLink } from "./ReceiptViewer";
import { btn, FormError, labelClass } from "./ui";

/** Anexos de um lançamento já salvo: vê os que existem e acrescenta mais (um ou vários de uma vez). */
export function TransactionAttachments({ txId, date, label, items }: { txId: string; date: string; label: string; items: { path: string; url: string }[] }) {
  const router = useRouter();
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function add(files: FileList | null) {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    setError(null); setNote(null); setBusy(true);
    let sent = 0, queued = 0, failed: string | null = null;
    for (const file of list.slice(0, Math.max(0, MAX_ANEXOS - items.length))) {
      const r = await submitAttachment({ transactionId: txId, date, label, file });
      if (r.mode === "sent") sent++; else if (r.mode === "queued") queued++; else failed = r.error;
    }
    setBusy(false);
    if (camera.current) camera.current.value = "";
    if (gallery.current) gallery.current.value = "";
    if (failed) setError(failed);
    const parts = [sent && `${sent} anexo(s) salvo(s)`, queued && `${queued} guardado(s) no aparelho, vai(ão) quando voltar o sinal`].filter(Boolean);
    if (parts.length) setNote(parts.join("; ") + ".");
    if (sent) router.refresh();
  }

  const full = items.length >= MAX_ANEXOS;
  return (
    <div className="space-y-3 border-t border-black/[0.08] pt-5">
      <p className={labelClass}>Anexos ({items.length})</p>
      {items.length === 0 && <p className="text-sm text-brand-graphite/60">Nenhum anexo ainda.</p>}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((a, i) => <ReceiptLink key={a.path} path={a.path} url={a.url} label={`Foto ${i + 1}`} />)}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn.ghost} disabled={busy || full} onClick={() => camera.current?.click()}><Camera className="size-4" aria-hidden /> Tirar foto</button>
        <button type="button" className={btn.ghost} disabled={busy || full} onClick={() => gallery.current?.click()}><ImagePlus className="size-4" aria-hidden /> Escolher da galeria (pode vários)</button>
        <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void add(e.target.files)} />
        <input ref={gallery} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void add(e.target.files)} />
      </div>
      {busy && <p className="text-sm font-semibold text-brand-graphite/70" role="status">Enviando…</p>}
      {note && <p className="text-sm font-semibold text-brand-green" role="status">{note}</p>}
      {full && <p className="text-sm text-[#7a4a00]">Limite de {MAX_ANEXOS} anexos por lançamento.</p>}
      <FormError message={error} />
    </div>
  );
}
