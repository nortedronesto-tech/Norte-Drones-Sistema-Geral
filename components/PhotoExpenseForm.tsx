"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, CheckCircle2, ImagePlus, RefreshCw } from "lucide-react";
import { createTransaction } from "@/app/(app)/actions";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { formatBRL, parseMoney, todayBR } from "@/lib/format";
import type { BankAccount } from "@/lib/types";
import { btn, FormError, inputClass, labelClass } from "./ui";

const LS_ACCOUNT = "norte:ultimaConta";
const LS_CATEGORY = "norte:ultimaCategoria";

// localStorage só como conveniência: pode estar bloqueado (aba privada etc.).
const readLS = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const writeLS = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignora */ } };

export function PhotoExpenseForm({ accounts }: { accounts: BankAccount[] }) {
  const [amountText, setAmountText] = useState("");
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [paid, setPaid] = useState(true);
  const [date, setDate] = useState(todayBR());
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<"idle" | "compressing" | "uploading" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  // Lembra a última conta/categoria: despesa seguinte costuma ser parecida.
  useEffect(() => {
    const a = readLS(LS_ACCOUNT);
    if (a && accounts.some((x) => x.id === a)) setAccountId(a);
    const c = readLS(LS_CATEGORY);
    if (c && (EXPENSE_CATEGORIES as readonly string[]).includes(c)) setCategory(c);
  }, [accounts]);

  useEffect(() => {
    if (!file) return setPreviewUrl(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const loading = busy !== "idle";
  const amount = parseMoney(amountText);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    if (!amount || amount <= 0) return setError("Informe o valor da despesa.");
    if (!accountId) return setError("Escolha a conta.");

    let receiptPath: string | undefined;
    const supabase = createClient();
    try {
      if (file) {
        setBusy("compressing");
        const { blob, ext, type } = await compressImage(file);
        setBusy("uploading");
        const [y, m] = date.split("-");
        receiptPath = `${y}/${m}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("receipts").upload(receiptPath, blob, { contentType: type, upsert: false });
        if (upErr) throw new Error(`Não foi possível enviar a foto: ${upErr.message}`);
      }
      setBusy("saving");
      const res = await createTransaction({
        type: "saida",
        amount,
        account_id: accountId,
        category,
        description,
        status: paid ? "pago" : "a_pagar",
        date,
        receipt_path: receiptPath,
      });
      if (!res.ok) {
        // não deixa foto órfã no bucket se o lançamento falhou
        if (receiptPath) await supabase.storage.from("receipts").remove([receiptPath]);
        throw new Error(res.error);
      }
      writeLS(LS_ACCOUNT, accountId);
      writeLS(LS_CATEGORY, category);
      setDone(`${formatBRL(amount)} em ${category} lançado${file ? " com foto" : " (sem foto)"}.`);
      setAmountText("");
      setDescription("");
      setFile(null);
      setDate(todayBR());
      amountRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado. Tente de novo.");
    } finally {
      setBusy("idle");
    }
  }

  const busyLabel = { idle: "", compressing: "Preparando a foto…", uploading: "Enviando a foto…", saving: "Lançando…" }[busy];

  return (
    <form onSubmit={submit} className="space-y-5">
      {done && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-brand-green/30 bg-brand-green/10 px-4 py-3 text-sm font-medium text-brand-dark">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-green" aria-hidden />
          <div>
            <p className="font-bold">Despesa lançada</p>
            <p>{done} <Link href="/lancamentos" className="font-bold underline">Ver lançamentos</Link></p>
          </div>
        </div>
      )}

      {/* 1. Valor */}
      <div>
        <label htmlFor="amount" className={labelClass}>Valor (R$)</label>
        <input ref={amountRef} id="amount" inputMode="decimal" autoComplete="off" placeholder="0,00" value={amountText}
          onChange={(e) => setAmountText(e.target.value)} className={`${inputClass} num py-4 text-3xl font-extrabold`} required />
      </div>

      {/* 2. Categoria */}
      <div>
        <span className={labelClass}>Categoria</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Categoria">
          {EXPENSE_CATEGORIES.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={category === c} onClick={() => setCategory(c)}
              className={`rounded-full px-3.5 py-2 text-sm font-semibold transition ${category === c ? "bg-brand-dark text-white" : "bg-black/[0.06] text-brand-graphite hover:bg-black/10"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Conta */}
      <div>
        <label htmlFor="account" className={labelClass}>Conta que pagou</label>
        <select id="account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClass} required>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {/* 4. Foto */}
      <div>
        <span className={labelClass}>Foto do recibo / abastecimento</span>
        {previewUrl ? (
          <div className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Pré-visualização da foto" className="size-20 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{file?.name}</p>
              <p className="text-xs text-brand-graphite/60">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB — será reduzida antes de enviar` : ""}</p>
            </div>
            <button type="button" onClick={() => setFile(null)} className="rounded-lg p-2 text-brand-graphite/70 hover:bg-black/5" aria-label="Trocar foto">
              <RefreshCw className="size-5" aria-hidden />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className={`${btn.cta} cursor-pointer`}>
              <Camera className="size-5" aria-hidden /> Tirar foto
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <label className={`${btn.ghost} cursor-pointer`}>
              <ImagePlus className="size-5" aria-hidden /> Da galeria
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        )}
        <p className="mt-1.5 text-xs text-brand-graphite/60">Foto que o Mateus mandou no WhatsApp? Salve na galeria e escolha “Da galeria”.</p>
      </div>

      {/* 5. Detalhes opcionais */}
      <details className="rounded-xl border border-black/10 bg-white px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold">Observação, data e situação</summary>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="description" className={labelClass}>Observação</label>
            <input id="description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="Ex.: Posto Ipiranga, 38 L de diesel" className={inputClass} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="date" className={labelClass}>{paid ? "Data" : "Vencimento"}</label>
              <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <span className={labelClass}>Situação</span>
              <div className="flex gap-2">
                <button type="button" aria-pressed={paid} onClick={() => setPaid(true)} className={`flex-1 rounded-xl px-4 py-3 font-bold ${paid ? "bg-brand-dark text-white" : "bg-black/[0.05] text-brand-graphite/70"}`}>Pago</button>
                <button type="button" aria-pressed={!paid} onClick={() => setPaid(false)} className={`flex-1 rounded-xl px-4 py-3 font-bold ${!paid ? "bg-brand-dark text-white" : "bg-black/[0.05] text-brand-graphite/70"}`}>A pagar</button>
              </div>
            </div>
          </div>
        </div>
      </details>

      <FormError message={error} />
      <button type="submit" disabled={loading} className={`${btn.primary} w-full py-4 text-lg`}>
        {loading ? busyLabel : "Lançar despesa"}
      </button>
    </form>
  );
}
