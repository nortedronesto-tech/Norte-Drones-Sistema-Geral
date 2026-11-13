"use client";

import { Camera, Mic, PencilLine } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { categoriesFor } from "@/lib/constants";
import { formatBRL, parseMoney, todayBR } from "@/lib/format";
import { previewSplit } from "@/lib/split";
import { submitTransaction } from "@/lib/offline-finance";
import { findSimilarTransactions } from "@/app/gestao/actions";
import { avisosLancamento, validarLancamento } from "@/lib/lancamento-check";
import { gerarParcelas, MAX_PARCELAS } from "@/lib/parcelas";
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
  onDirtyChange,
}: {
  accounts: AccountBalance[];
  partners: Partner[];
  reservePct: number;
  suppliers?: Supplier[];
  /** dentro da janela de Lançamentos: chamado depois de salvar (em vez de trocar de página) */
  onDone?: () => void;
  onCancel?: () => void;
  /** avisa a janela se há algo digitado (para pedir confirmação antes de fechar) */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [queuedMsg, setQueuedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dups, setDups] = useState<{ date: string; description: string | null; status: string }[] | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [mode, setMode] = useState<"foto" | "voz" | "manual">("foto");
  const [type, setType] = useState<TxType>("saida");
  const [amountText, setAmountText] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [supplierId, setSupplierId] = useState("");
  const [category, setCategory] = useState(categoriesFor("saida")[0]);
  const [description, setDescription] = useState("");
  const [paid, setPaid] = useState(true);
  const [parcelasText, setParcelasText] = useState("1");
  const [modoParc, setModoParc] = useState<"total" | "parcela">("total");
  const [date, setDate] = useState(todayBR());
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Lembra a última conta usada neste aparelho (a 1ª da lista só vale na primeira vez).
  useEffect(() => {
    try {
      const last = localStorage.getItem("norte:last-account");
      if (last && accounts.some((a) => a.id === last)) setAccountId(last);
      const cat = localStorage.getItem("norte:last-category:saida");
      if (cat && categoriesFor("saida").includes(cat)) setCategory(cat);
    } catch { /* sem armazenamento: segue com a 1ª conta */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { onDirtyChange?.(Boolean(amountText.trim() || description.trim() || file)); }, [amountText, description, file]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!file) return setPreviewUrl(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const amount = parseMoney(amountText);
  const nParc = Math.min(MAX_PARCELAS, Math.max(1, Math.trunc(Number(parcelasText) || 1)));
  const parcelado = nParc > 1;
  const base = useMemo(
    () => (parcelado && amount && amount > 0 ? gerarParcelas({ valor: amount, modo: modoParc, n: nParc, primeiro: date, descricao: "" }) : []),
    [parcelado, amount, modoParc, nParc, date],
  );
  // linhas editáveis: nascem do cálculo acima e cada uma pode ser ajustada (valor, data, já paga)
  const [linhas, setLinhas] = useState<{ amount: string; date: string; paid: boolean }[]>([]);
  useEffect(() => { setLinhas(base.map((p) => ({ amount: p.amount.toFixed(2).replace(".", ","), date: p.date, paid: false }))); }, [base]);
  const setLinha = (i: number, patch: Partial<{ amount: string; date: string; paid: boolean }>) => setLinhas((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const parcelas = linhas.map((l, i) => ({
    n: i + 1, of: linhas.length, amount: parseMoney(l.amount) ?? 0, date: l.date, paid: l.paid,
    description: `${description.trim() ? `${description.trim()} ` : ""}(${i + 1}/${linhas.length})`,
  }));
  const pago = paid && !parcelado; // parcelado sempre entra como "a pagar/a receber": cada parcela é marcada quando for paga
  const status: TxStatus = pago ? "pago" : type === "entrada" ? "a_receber" : "a_pagar";
  const preview = useMemo(
    () => (type === "entrada" && amount && amount > 0 ? previewSplit(amount, reservePct, partners) : null),
    [type, amount, reservePct, partners],
  );

  function changeType(next: TxType) {
    setType(next);
    let cat: string = categoriesFor(next)[0];
    try { const l = localStorage.getItem(`norte:last-category:${next}`); if (l && categoriesFor(next).includes(l)) cat = l; } catch { /* ignora */ }
    setCategory(cat);
    setDups(null);
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
    if (d.account_id && accounts.some((a) => a.id === d.account_id)) { setAccountId(d.account_id); filled.push("conta"); }
    if (d.supplier_id && nextType === "saida" && suppliers.some((x) => x.id === d.supplier_id)) { setSupplierId(d.supplier_id); filled.push("fornecedor"); }
    if (d.description) { setDescription(d.description); filled.push("descrição"); }
    if (d.status) { setPaid(d.status === "pago"); filled.push(d.status === "pago" ? "situação (pago/recebido)" : "situação (pendente)"); }
    return filled.length
      ? `Preenchi ${filled.join(", ")}. Confira antes de salvar.`
      : "Não encontrei dados nessa foto. Preencha manualmente.";
  }

  function reset() {
    setAmountText(""); setDescription(""); setFile(null); setSupplierId(""); setDups(null); setParcelasText("1");
  }

  function remember() {
    try {
      localStorage.setItem("norte:last-account", accountId);
      localStorage.setItem(`norte:last-category:${type}`, category);
    } catch { /* ignora */ }
  }

  /** `another`: salva e deixa a janela aberta para o próximo lançamento. `force`: ignora o aviso de repetido. */
  function save(another: boolean, force: boolean) {
    setError(null);
    setQueuedMsg(null);
    setSavedMsg(null);
    const bad = validarLancamento({ amount, paid: pago, date, today: todayBR() });
    if (bad) return setError(bad);
    if (!accountId) return setError("Escolha a conta.");
    if (parcelado) return saveParcelado(another);
    startTransition(async () => {
      // com sinal, confere se já existe um lançamento igual (pode ser o mesmo enviado duas vezes)
      if (!force && typeof navigator !== "undefined" && navigator.onLine) {
        const same = await findSimilarTransactions({ type, amount: amount!, account_id: accountId, date }).catch(() => []);
        if (same.length) { setDups(same); return; }
      }
      setDups(null);
      const res = await submitTransaction(
        { type, amount: amount!, account_id: accountId, category, description, status, date, supplier_id: type === "saida" && supplierId ? supplierId : undefined },
        file,
      );
      if (res.mode === "rejected") return setError(res.error);
      remember();
      if (res.mode === "queued") {
        // sem sinal: fica guardado no aparelho; limpa o formulário para o próximo lançamento
        setQueuedMsg(`${formatBRL(amount!)} em ${category} guardado neste aparelho${file ? " com a foto" : ""}. Vai sozinho quando o sinal voltar.`);
        reset();
        return;
      }
      if (another) {
        setSavedMsg(`Salvo: ${formatBRL(amount!)} em ${category}. Pode lançar o próximo.`);
        reset();
        router.refresh();
        return;
      }
      if (onDone) onDone();
      else router.push("/gestao/lancamentos");
    });
  }

  /** Uma conta por parcela, cada uma com a sua chave (a fila sem sinal continua valendo). A foto vai só na 1ª. */
  function saveParcelado(another: boolean) {
    if (!parcelas.length) return setError("Confira o valor e a data da 1ª parcela.");
    for (const p of parcelas) {
      const bad = validarLancamento({ amount: p.amount, paid: p.paid, date: p.date, today: todayBR() });
      if (bad) return setError(`Parcela ${p.n}: ${bad}`);
    }
    startTransition(async () => {
      let ok = 0, queued = 0;
      for (const p of parcelas) {
        const res = await submitTransaction(
          { type, amount: p.amount, account_id: accountId, category, description: p.description, status: p.paid ? "pago" : type === "entrada" ? "a_receber" : "a_pagar", date: p.date, supplier_id: type === "saida" && supplierId ? supplierId : undefined },
          p.n === 1 ? file : null,
        );
        if (res.mode === "rejected") {
          setError(`${ok + queued} de ${parcelas.length} parcelas foram lançadas. A parcela ${p.n} deu erro: ${res.error} Não lance de novo as que já entraram; confira em Lançamentos.`);
          router.refresh();
          return;
        }
        if (res.mode === "queued") queued++; else ok++;
      }
      remember();
      const resumo = `${parcelas.length} parcelas de ${type === "entrada" ? "entrada" : "despesa"} lançadas (${formatBRL(parcelas.reduce((t, p) => t + p.amount, 0))} no total)`;
      if (queued) { setQueuedMsg(`${resumo}. ${queued} ficaram guardadas neste aparelho e vão sozinhas quando o sinal voltar.`); reset(); return; }
      if (another) { setSavedMsg(`${resumo}. Pode lançar o próximo.`); reset(); router.refresh(); return; }
      if (onDone) onDone(); else router.push(type === "entrada" ? "/gestao/contas-a-receber" : "/gestao/contas-a-pagar");
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    save(false, false);
  }

  const avisos = avisosLancamento({ amount, paid: pago, date, today: todayBR() });

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
      {mode === "voz" && <VoiceEntry onParsed={applyScan} accounts={accounts} suppliers={suppliers} />}
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
            <button type="button" onClick={() => { setPaid(true); setParcelasText("1"); }} className={seg(pago, "neutral")} aria-pressed={pago}>{type === "entrada" ? "Recebido" : "Pago"}</button>
            <button type="button" onClick={() => setPaid(false)} className={seg(!pago, "neutral")} aria-pressed={!pago}>{type === "entrada" ? "A receber" : "A pagar"}</button>
          </div>
        </div>
        <div>
          <label htmlFor="date" className={labelClass}>{pago ? "Data" : parcelado ? "Vencimento da 1ª parcela" : "Vencimento"}</label>
          <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} required />
        </div>
      </div>

      <div className="rounded-xl border border-black/10 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="parcelas" className={labelClass}>Parcelas <span className="font-normal text-brand-graphite/50">(1 = à vista)</span></label>
            <input id="parcelas" inputMode="numeric" value={parcelasText} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 2); setParcelasText(v); if (Number(v) > 1) setPaid(false); }} onBlur={() => setParcelasText(String(nParc))} className={inputClass} />
          </div>
          {parcelado && (
            <div>
              <label htmlFor="modoParc" className={labelClass}>O valor acima é</label>
              <select id="modoParc" value={modoParc} onChange={(e) => setModoParc(e.target.value as "total" | "parcela")} className={inputClass}>
                <option value="total">o total (divido pelas parcelas)</option>
                <option value="parcela">o valor de cada parcela</option>
              </select>
            </div>
          )}
        </div>
        {parcelado && (
          parcelas.length ? (
            <div className="mt-3 text-sm">
              <p className="font-bold">{nParc} parcelas · total {formatBRL(parcelas.reduce((t, p) => t + p.amount, 0))}</p>
              <p className="mt-1 text-xs text-brand-graphite/60">Ajuste o que precisar: valor, data e se já foi {type === "entrada" ? "recebida" : "paga"}. Ex.: 1ª parcela de entrada 80.000 já paga, e as outras 6 de 5.300 (use 7 parcelas, “valor de cada parcela” 5.300 e mude só a 1ª).</p>
              <ul className="mt-2 space-y-2">
                {linhas.map((l, i) => (
                  <li key={i} className="grid grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
                    <span className="text-xs font-bold text-brand-graphite/60">{i + 1}/{linhas.length}</span>
                    <input aria-label={`Valor da parcela ${i + 1}`} inputMode="decimal" className={`${inputClass} num`} value={l.amount} onChange={(e) => setLinha(i, { amount: e.target.value })} />
                    <input aria-label={`Data da parcela ${i + 1}`} type="date" className={inputClass} value={l.date} onChange={(e) => setLinha(i, { date: e.target.value })} />
                    <label className="col-span-3 -mt-1 flex items-center gap-2 pl-10 text-xs font-semibold text-brand-graphite/70"><input type="checkbox" className="size-4" checked={l.paid} onChange={(e) => setLinha(i, { paid: e.target.checked })} /> já {type === "entrada" ? "recebida" : "paga"}</label>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-brand-graphite/60">As não marcadas entram como {type === "entrada" ? "a receber" : "a pagar"}. A foto fica na 1ª parcela.</p>
            </div>
          ) : <p className="mt-2 text-sm text-brand-graphite/60">Informe o valor e a data para ver as parcelas.</p>
        )}
      </div>

      {preview && (
        <Card className="border-brand-green/30 bg-brand-green/[0.04]">
          <p className="text-sm font-bold text-brand-dark">
            {pago ? "Rateio desta entrada" : "Previsão de rateio (acontece quando for recebida)"}
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

      {avisos.length > 0 && (
        <ul role="note" className="rounded-xl border border-brand-amber/40 bg-brand-amber/10 px-4 py-3 text-sm text-[#7a4a00]">
          {avisos.map((a) => <li key={a}>• {a}</li>)}
        </ul>
      )}
      <FormError message={error} />
      {dups && (
        <div role="alert" className="rounded-xl border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-[#7a4a00]">
          <p className="font-bold">Parece que este lançamento já existe</p>
          <ul className="mt-1">
            {dups.map((d, i) => <li key={i}>• {d.date.split("-").reverse().join("/")} · mesmo valor e mesma conta{d.description ? ` · ${d.description}` : ""}</li>)}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => save(false, true)} disabled={pending} className={btn.ghost}>É outro, salvar mesmo assim</button>
            <button type="button" onClick={() => setDups(null)} className={btn.ghost}>Revisar</button>
          </div>
        </div>
      )}
      {savedMsg && <p role="status" className="rounded-xl border border-brand-green/30 bg-brand-green/10 px-4 py-3 text-sm font-bold text-brand-dark">{savedMsg}</p>}
      {queuedMsg && (
        <div role="status" className="rounded-xl border border-brand-green/30 bg-brand-green/10 p-3 text-sm text-brand-graphite">
          <p className="font-bold">Guardado no aparelho</p>
          <p>{queuedMsg}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className={`${btn.primary} min-w-[10rem] flex-1`}>{pending ? (file ? "Enviando foto e salvando…" : "Salvando…") : "Salvar lançamento"}</button>
        {onDone && <button type="button" disabled={pending} onClick={() => save(true, false)} className={btn.ghost}>Salvar e lançar outro</button>}
        <button type="button" onClick={() => (onCancel ? onCancel() : router.back())} className={btn.ghost}>Cancelar</button>
      </div>
    </form>
  );
}
