"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, RefreshCw, ScanText, Sparkles } from "lucide-react";
import { scanReceipt, type ScanResult } from "@/lib/receipt-scan";
import { normalizeImageFile } from "@/lib/image";
import { ocrReceipt } from "@/lib/receipt-ocr";
import { btn, labelClass } from "./ui";

type Note = { kind: "ok" | "warn"; text: string } | null;

/**
 * Foto da nota/comprovante: tirar na hora ou escolher da galeria.
 * Ao escolher, lê a foto (IA) e devolve valor, data, descrição e categoria
 * para o formulário preencher — sempre para o usuário conferir antes de salvar.
 */
export function ReceiptCapture({
  file,
  previewUrl,
  onFile,
  onScan,
  label = "Foto da nota / comprovante",
}: {
  file: File | null;
  previewUrl: string | null;
  onFile: (file: File | null) => void;
  onScan: (data: ScanResult) => string; // devolve o texto do aviso ("Preenchi valor e data…")
  label?: string;
}) {
  const [scanning, setScanning] = useState(false);
  const [converting, setConverting] = useState(false);
  const [scanLabel, setScanLabel] = useState("Lendo a nota…");
  const [previewBroken, setPreviewBroken] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const run = useRef(0);

  /** Leitura no aparelho (OCR): sem IA, sem chave, sem cota. */
  async function scanLocal(f: File, id: number, prefix = "") {
    setScanLabel("Lendo a foto no seu aparelho…");
    try {
      const data = await ocrReceipt(f, (s) => id === run.current && setScanLabel(s));
      if (id !== run.current) return;
      const found = data.amount !== null || data.date !== null || data.description !== null;
      setNote({
        kind: found ? "ok" : "warn",
        text: found
          ? `${prefix}${onScan(data)} (lido no seu aparelho, sem IA — confira o valor com atenção)`
          : `${prefix}Li a foto, mas não achei valor nem data. Tente com mais luz e a nota inteira no quadro, ou use “Falar ou digitar”.`,
      });
    } catch (e) {
      if (id !== run.current) return;
      setNote({ kind: "warn", text: `${prefix}${e instanceof Error ? e.message : "Não consegui ler a foto."} Use “Falar ou digitar” abaixo.` });
    }
  }

  /** Tenta a IA; se ela falhar (sem crédito, sobrecarregada, sem chave…), lê a foto no aparelho. */
  async function scan(f: File, localOnly = false) {
    const id = ++run.current;
    setScanning(true);
    setNote(null);
    try {
      if (localOnly) return await scanLocal(f, id);
      setScanLabel("Lendo a nota…");
      try {
        const data = await scanReceipt(f);
        if (id !== run.current) return; // trocou a foto no meio
        setNote({ kind: "ok", text: onScan(data) + (data.provider ? ` (lido por ${data.provider})` : "") });
      } catch (e) {
        if (id !== run.current) return;
        const why = e instanceof Error ? e.message : "";
        // foto ilegível para a IA não melhora com OCR; qualquer outra falha (IA fora do ar, sem chave…) cai no aparelho
        await scanLocal(f, id, /^Não consegui ler essa foto/.test(why) ? "A IA não conseguiu ler. " : "A IA não respondeu agora — ");
      }
    } finally {
      if (id === run.current) setScanning(false);
    }
  }

  async function pick(raw: File | null) {
    const id = ++run.current;
    setNote(null);
    setScanning(false);
    setPreviewBroken(false);
    if (!raw) return onFile(null);

    let f = raw;
    try {
      setConverting(true);
      f = await normalizeImageFile(raw); // foto do iPhone (HEIC) vira JPEG
    } catch (e) {
      if (id === run.current) {
        setConverting(false);
        onFile(null);
        setNote({ kind: "warn", text: e instanceof Error ? e.message : "Não foi possível abrir essa foto." });
      }
      return;
    }
    if (id !== run.current) return; // trocou a foto no meio da conversão
    setConverting(false);
    onFile(f);
    void scan(f);
  }

  return (
    <div>
      <span className={labelClass}>{label}</span>
      {previewUrl && file ? (
        <div className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {previewBroken ? (
            <div className="grid size-20 shrink-0 place-items-center rounded-lg bg-black/[0.06] text-center text-[10px] font-semibold leading-tight text-brand-graphite/60">
              sem prévia
            </div>
          ) : (
            <img src={previewUrl} alt="Pré-visualização da foto" onError={() => setPreviewBroken(true)} className="size-20 shrink-0 rounded-lg object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{file.name}</p>
            <p className="text-xs text-brand-graphite/60">{(file.size / 1024 / 1024).toFixed(1)} MB — será reduzida antes de enviar</p>
            {!scanning && (
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                <button type="button" onClick={() => void scan(file)} className="inline-flex items-center gap-1 text-xs font-bold text-brand-green hover:underline">
                  <ScanText className="size-3.5" aria-hidden /> Ler a nota de novo
                </button>
                <button type="button" onClick={() => void scan(file, true)} className="inline-flex items-center gap-1 text-xs font-bold text-brand-green hover:underline">
                  <ScanText className="size-3.5" aria-hidden /> Ler sem IA (no aparelho)
                </button>
              </div>
            )}
          </div>
          <button type="button" onClick={() => pick(null)} className="rounded-lg p-2 text-brand-graphite/70 hover:bg-black/5" aria-label="Trocar foto">
            <RefreshCw className="size-5" aria-hidden />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <label className={`${btn.cta} cursor-pointer`}>
            <Camera className="size-5" aria-hidden /> Tirar foto
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          </label>
          <label className={`${btn.ghost} cursor-pointer`}>
            <ImagePlus className="size-5" aria-hidden /> Da galeria
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      )}

      {converting && (
        <p role="status" className="mt-2 flex items-center gap-2 rounded-xl bg-brand-green/10 px-3 py-2 text-sm font-semibold text-brand-dark">
          <Sparkles className="size-4 animate-pulse text-brand-green" aria-hidden /> Convertendo a foto do iPhone…
        </p>
      )}
      {scanning && (
        <p role="status" className="mt-2 flex items-center gap-2 rounded-xl bg-brand-green/10 px-3 py-2 text-sm font-semibold text-brand-dark">
          <Sparkles className="size-4 animate-pulse text-brand-green" aria-hidden /> {scanLabel}
        </p>
      )}
      {note && (
        <p
          role="status"
          className={`mt-2 rounded-xl px-3 py-2 text-sm font-medium ${note.kind === "ok" ? "bg-brand-green/10 text-brand-dark" : "bg-brand-amber/15 text-[#7a4a00]"}`}
        >
          {note.text}
        </p>
      )}
      <p className="mt-1.5 text-xs text-brand-graphite/60">
        Tire a foto e o sistema preenche valor, data e categoria sozinho — é só conferir. Foto que o Mateus mandou no WhatsApp? Salve na galeria e escolha “Da galeria”.
      </p>
    </div>
  );
}
