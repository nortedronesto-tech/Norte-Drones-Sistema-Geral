"use client";

import { Camera, Mic, PencilLine } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { categoriesFor } from "@/lib/constants";
import { formatBRL, parseMoney, todayBR } from "@/lib/format";
import { previewSplit } from "@/lib/split";
import { submitTransaction } from "@/lib/offline-finance";
import type { ScanResult } from "@/lib/receipt-scan";
import { ReceiptCapture } from "./ReceiptCapture";
import { VoiceEntry } from "./VoiceEntry";
import type { AccountBalance, Partner, Supplier, TxStatus, TxType } from "@/lib/types";
import { AccountPicker } from "./AccountPicker";
import { SupplierPicker } from "./SupplierPicker";
import { btn, Card, FormError, inputClass, labelClass } from "./ui";

export function TransactionForm({
  accounts,
  partners,
  reservePct,
  suppliers = [],
  onDone,
  onCancel,
}: {
  accounts: AccountBalance[];
  partners: Partner[];
  reservePct: number;
  suppliers?: Supplier[];
  /** dentro da janela de Lançamentos: chamado depois de salvar (em vez de trocar de página) */
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [queuedMsg, setQueuedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"foto" | "voz" | "manual">("foto");
  const [type, setType] = useState<TxType>("saida");
  const [amountText, setAmountText] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [supplierId, setSupplierId] = useState("");
  const [category, setCategory] = useState(categoriesFor("saida")[0]);
  const [description, setDescription] = useState("");
  const [paid, setPaid] = useState(true);
  const [date, setDate] = useState(todayBR());
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return setPreviewUrl(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const amount = parseMoney(amountText);
  const status: TxStatus = paid ? "pago" : type === "entrada" ? "a_receber" : "a_pagar";
  const preview = useMemo(
    () => (type === "entrada" && amount && amount > 0 ? previewSplit(amount, reservePct, partners) : null),
    [type, amount, reservePct, partners],
  );

  function changeType(next: TxType) {
    setType(next);
    setCategory(categoriesFor(next)[0]);
  }

  // Preenche o formulário com o que a leitura da foto encontrou (o usuário confere antes de salvar).
  function applyScan(d: ScanResult): string {
    const filled: string[] = [];
    const nextType: TxType = d.tipo ?? type;
    if (nextType !== type) { setType(nextType); filled.push(nextType === "saida" ? "tipo (saída)" : "tipo (entrada)"); }
    if (d.amount) { setAmountText(d.amount.toFixed(2).replace(".", ",")); filled.push("valor"); }
    const cats = categoriesFor(nextType);
    if (d.category && cats.includes(d.category)) { setCategory(d.category); filled.push("categoria"); }
    else if (nextType !== type) setCategory(cats[0]);
    if (d.date && d.date <= todayBR() && d.date >= `${Number(todayBR().slice(0, 4)) - 2}-01-01`) { setDate(d.date); filled.push("data"); }
    if (d.description) { setDescription(d.description); filled.push("descrição"); }
    if (d.status) { setPaid(d.status === "pago"); filled.push(d.status === "pago" ? "situação (pago/recebido)" : "situação (pendente)"); }
    return filled.length
      ? `Preenchi ${filled.join(", ")}. Confira antes de salvar.`
      : "Não encontrei dados nessa foto. Preencha manualmente.";
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setQueuedMsg(null);
    if (!amount || amount <= 0) return setError("Informe um valor maior que zero.");
    if (!accountId) return setError("Escolha a conta.");
    startTransition(async () => {
      const res = await submitTransaction(
        { type, amount, account_id: accountId, category, description, status, date, supplier_id: type === "saida" && supplierId ? supplierId : undefined },
        file,
      );
      if (res.mode === "rejected") return setError(res.error);
      if (res.mode === "queued") {
        // sem sinal: fica guardado no aparelho; limpa o formulário para o próximo lançamento
        setQueuedMsg(`${formatBRL(amount)} em ${category} guardado neste aparelho${file ? " com a foto" : ""}. Vai sozinho quando o sinal voltar.`);
        setAmountText(""); setDescription(""); setFile(null);
        return;
      }
      if (onDone) onDone();
      else router.push("/gestao/lancamentos");
    });
  }

  const seg = (active: boolean, tone: "in" | "out" | "neutral") =>
    `flex-1 rounded-xl px-4 py-3 text-base font-bold transition ${
      active
        ? tone === "in" ? "bg-brand-green text-white" : tone === "out" ? "bg-danger text-white" : "bg-brand-dark text-white"
        : "bg-black/[0.05] text-brand-graphite/70 hover:bg-black/[0.08]"
    }`;

  return (
    <form onSubmit={submit} className="space-y-5">
      <div role="group" aria-label="Como lançar" className="grid grid-cols-3 gap-2">
        {([["foto", "Foto", Camera], ["voz", "Voz", Mic], ["manual", "Manual", PencilLine]] as const).map(([v, l, Icon]) => (
          <button key={v} type="button" aria-pressed={mode === v} onClick={() => setMode(v)}
            className={`flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-sm font-bold transition ${mode === v ? "bg-brand-dark text-white" : "bg-black/[0.05] text-brand-graphite/80 hover:bg-black/[0.08]"}`}>
            <Icon className="size-5" aria-hidden /> {l}
          </button>
        ))}
      </div>

      {mode === "foto" && <ReceiptCapture file={file} previewUrl={previewUrl} onFile={setFile} onScan={applyScan} label="Foto do recibo (a IA lê e preenche)" />}
      {mode === "voz" && <VoiceEntry onParsed={applyScan} />}
      {mode !== "foto" && <ReceiptCapture file={file} previewUrl={previewUrl} onFile={setFile} onScan={applyScan} scanEnabled={false} label="Anexar recibo (opcional)" />}

      <div className="flex gap-2" role="group" aria-label="Tipo de lançamento">
        <button type="button" onClick={() => changeType("entrada")} className={seg(type === "entrada", "in")} aria-pressed={type === "entrada"}>Entrada</button>
        <button type="button" onClick={() => changeType("saida")} className={seg(type === "saida", "out")} aria-pressed={type === "saida"}>Saída</button>
      </div>

      <div>
        <label htmlFor="amount" className={labelClass}>Valor (R$)</label>
        <input id="amount" inputMode="decimal" autoComplete="off" placeholder="0,00" value={amountText}
          onChange={(e) => setAmountText(e.target.value)} className={`${inputClass} num text-2xl font-extrabold`} required />
      </div>

      <AccountPicker accounts={accounts} value={accountId} onChange={setAccountId} label={type === "entrada" ? "Conta bancária (onde entrou)" : "Conta bancária (de onde saiu)"} />

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="category" className={labelClass}>Categoria</label>
          <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
            {categoriesFor(type).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {type === "saida" && suppliers !== undefined && <SupplierPicker suppliers={suppliers} value={supplierId} onChange={setSupplierId} />}
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>Descrição <span className="font-normal text-brand-graphite/50">(opcional)</span></label>
        <input id="description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300}
          placeholder={type === "entrada" ? "Ex.: Fazenda Boa Vista — 40 ha" : "Ex.: Diesel L200"} className={inputClass} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <span className={labelClass}>Situação</span>
          <div className="flex gap-2" role="group" aria-label="Situação">
            <button type="button" onClick={() => setPaid(true)} className={seg(paid, "neutral")} aria-pressed={paid}>{type === "entrada" ? "Recebido" : "Pago"}</button>
            <button type="button" onClick={() => setPaid(false)} className={seg(!paid, "neutral")} aria-pressed={!paid}>{type === "entrada" ? "A receber" : "A pagar"}</button>
          </div>
        </div>
        <div>
          <label htmlFor="date" className={labelClass}>{paid ? "Data" : "Vencimento"}</label>
          <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} required />
        </div>
      </div>

      {preview && (
        <Card className="border-brand-green/30 bg-brand-green/[0.04]">
          <p className="text-sm font-bold text-brand-dark">
            {paid ? "Rateio desta entrada" : "Previsão de rateio (acontece quando for recebida)"}
          </p>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt>Fundo de reserva ({reservePct}%)</dt><dd className="num font-bold">{formatBRL(preview.reserve)}</dd></div>
            {preview.partners.map((p) => (
              <div key={p.id} className="flex justify-between gap-3">
                <dt className="min-w-0 truncate">{p.name} ({p.pct}%)</dt>
                <dd className="num font-bold">{formatBRL(p.share)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-brand-graphite/60">
            A reserva é retida primeiro ({preview.partners.map((p) => formatBRL(p.reserve)).join(" + ")}); o restante é dividido pelos percentuais.
          </p>
        </Card>
      )}

      <FormError message={error} />
      {queuedMsg && (
        <div role="status" className="rounded-xl border border-brand-green/30 bg-brand-green/10 p-3 text-sm text-brand-graphite">
          <p className="font-bold">Guardado no aparelho</p>
          <p>{queuedMsg}</p>
        </div>
      )}
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={`${btn.primary} flex-1`}>{pending ? (file ? "Enviando foto e salvando…" : "Salvando…") : "Salvar lançamento"}</button>
        <button type="button" onClick={() => (onCancel ? onCancel() : router.back())} className={btn.ghost}>Cancelar</button>
      </div>
    </form>
  );
}
