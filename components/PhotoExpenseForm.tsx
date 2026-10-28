"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { createTransaction } from "@/app/gestao/actions";
import { removeReceipt, uploadReceipt } from "@/lib/receipt-upload";
import type { ScanResult } from "@/lib/receipt-scan";
import { ReceiptCapture } from "./ReceiptCapture";
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
  const [detailsOpen, setDetailsOpen] = useState(false);
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
    try {
      if (file) {
        setBusy("uploading");
        receiptPath = await uploadReceipt(file, date);
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
        if (receiptPath) await removeReceipt(receiptPath);
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

  // Preenche o formulário com o que a leitura da foto encontrou (o usuário confere antes de lançar).
  function applyScan(d: ScanResult): string {
    const filled: string[] = [];
    if (d.amount) { setAmountText(d.amount.toFixed(2).replace(".", ",")); filled.push("valor"); }
    if (d.category && (EXPENSE_CATEGORIES as readonly string[]).includes(d.category)) { setCategory(d.category); filled.push("categoria"); }
    if (d.date && d.date <= todayBR() && d.date >= `${Number(todayBR().slice(0, 4)) - 2}-01-01`) { setDate(d.date); filled.push("data"); }
    if (d.description) { setDescription(d.description); filled.push("observação"); }
    if (filled.length) setDetailsOpen(true);
    return filled.length
      ? `Preenchi ${filled.join(", ")}. Confira antes de lançar.`
      : "Não encontrei dados nessa foto. Preencha manualmente.";
  }

  const busyLabel = { idle: "", compressing: "Preparando a foto…", uploading: "Enviando a foto…", saving: "Lançando…" }[busy];

  return (
    <form onSubmit={submit} className="space-y-5">
      {done && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-brand-green/30 bg-brand-green/10 px-4 py-3 text-sm font-medium text-brand-dark">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-green" aria-hidden />
          <div>
            <p className="font-bold">Despesa lançada</p>
            <p>{done} <Link href="/gestao/lancamentos" className="font-bold underline">Ver lançamentos</Link></p>
          </div>
        </div>
      )}

      {/* 0. Foto primeiro: tira a foto e o sistema preenche o resto */}
      <ReceiptCapture file={file} previewUrl={previewUrl} onFile={setFile} onScan={applyScan} label="1. Foto da nota / abastecimento" />

      {/* 1. Valor */}
      <div>
        <label htmlFor="amount" className={labelClass}>2. Valor (R$)</label>
        <input ref={amountRef} id="amount" inputMode="decimal" autoComplete="off" placeholder="0,00" value={amountText}
          onChange={(e) => setAmountText(e.target.value)} className={`${inputClass} num py-4 text-3xl font-extrabold`} required />
      </div>

      {/* 2. Categoria */}
      <div>
        <span className={labelClass}>3. Categoria</span>
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
        <label htmlFor="account" className={labelClass}>4. Conta que pagou</label>
        <select id="account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClass} required>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {/* 5. Detalhes opcionais */}
      <details open={detailsOpen} onToggle={(e) => setDetailsOpen(e.currentTarget.open)} className="rounded-xl border border-black/10 bg-white px-4 py-3">
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
