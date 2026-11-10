"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Image as ImageIcon, X } from "lucide-react";
import { cachedReceiptUrl, keepReceipt } from "@/lib/receipt-cache";

/** Foto do recibo guardada no aparelho (ou, na falta dela e com sinal, a do servidor). */
export function useReceiptSrc(path: string, url: string) {
  const [src, setSrc] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const local = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    keepReceipt(path, url);
    void cachedReceiptUrl(path).then((u) => {
      if (!alive) return;
      if (u) { local.current = u; setSrc(u); }
      else if (navigator.onLine) setSrc(url);
      else setMissing(true);
    });
    return () => { alive = false; if (local.current) URL.revokeObjectURL(local.current); };
  }, [path, url]);

  // a URL do servidor vale 1 hora: se falhar, tenta a cópia do aparelho
  async function onError() {
    if (local.current) return setMissing(true);
    const u = await cachedReceiptUrl(path);
    if (u) { local.current = u; setSrc(u); } else setMissing(true);
  }
  return { src, missing, onError };
}

/** Miniatura do recibo (arquivo de recibos). */
export function ReceiptThumb({ path, url, alt }: { path: string; url: string; alt: string }) {
  const { src, missing, onError } = useReceiptSrc(path, url);
  if (!src || missing) {
    return (
      <div className="grid aspect-[4/3] w-full place-items-center rounded-lg bg-black/[0.06] p-2 text-center text-xs font-semibold text-brand-graphite/55">
        {missing ? "Foto ainda não guardada neste aparelho" : "Carregando…"}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} onError={onError} loading="lazy" className="aspect-[4/3] w-full rounded-lg object-cover" />;
}

/** Botão "Ver foto": abre o recibo numa janela da própria tela (funciona sem sinal se a foto já foi guardada). */
export function ReceiptLink({ path, url, label = "Ver foto", className }: { path: string; url: string; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { keepReceipt(path, url); }, [path, url]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? "inline-flex items-center gap-1.5 rounded-lg bg-black/[0.05] px-3 py-1.5 text-sm font-semibold hover:bg-black/[0.08]"}>
        <ImageIcon className="size-4" aria-hidden /> {label}
      </button>
      {open && <ReceiptDialog path={path} url={url} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ReceiptDialog({ path, url, onClose }: { path: string; url: string; onClose: () => void }) {
  const { src, missing, onError } = useReceiptSrc(path, url);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Foto do recibo" className="fixed inset-0 z-50 flex flex-col bg-black/85 p-3 print:hidden" onClick={onClose}>
      <div className="mb-2 flex items-center justify-end gap-3 text-white" onClick={(e) => e.stopPropagation()}>
        {src && !missing && src.startsWith("http") && (
          <a href={src} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold underline"><ExternalLink className="size-4" aria-hidden /> Abrir em outra aba</a>
        )}
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg bg-white/15 p-2 hover:bg-white/25"><X className="size-5" aria-hidden /></button>
      </div>
      <div className="grid min-h-0 flex-1 place-items-center" onClick={(e) => e.stopPropagation()}>
        {missing ? (
          <p className="max-w-sm rounded-xl bg-white p-4 text-center text-sm font-semibold text-brand-graphite">
            Esta foto ainda não foi guardada neste aparelho e não há sinal. Abra o sistema com internet uma vez para guardá-la.
          </p>
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Recibo" onError={onError} className="max-h-full max-w-full rounded-lg object-contain" />
        ) : <p className="text-sm font-semibold text-white">Carregando…</p>}
      </div>
    </div>
  );
}
