"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Download, FileText, Pencil, Share2, Trash2, XCircle } from "lucide-react";
import { cancelOS, closeOS, deleteOS, setClientOk } from "@/app/gestao/os/actions";
import { formatDate, todayBR } from "@/lib/format";
import type { AccountBalance } from "@/lib/types";
import { AccountPicker } from "./AccountPicker";
import { makeOsPdf, whatsappDigits } from "@/lib/os-pdf-client";
import type { OsData } from "@/lib/os";
import type { PdfContacts } from "@/lib/os-pdf";
import { btn, Card, CardTitle, FormError, inputClass, labelClass } from "./ui";

export function OSActions({ osId, status, accounts, due, text, total, data, contacts, clientPhone, clientOkNote, canWrite, canManage }: {
  osId: string; status: "aberta" | "concluida" | "cancelada"; accounts: AccountBalance[]; due: string; text: string; total: string;
  data: OsData; contacts: PdfContacts; clientPhone: string | null; clientOkNote: string | null; canWrite: boolean; canManage: boolean;
}) {
  const router = useRouter();
  const [account, setAccount] = useState(accounts[0]?.id ?? "");
  const [dueDate, setDueDate] = useState(due);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [includePrice, setIncludePrice] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [waLink, setWaLink] = useState<string | null>(null);
  const [okDate, setOkDate] = useState(todayBR());
  const [okNote, setOkNote] = useState("");

  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(null), 3500); };
  const copy = async () => { try { await navigator.clipboard.writeText(text); flash("Resumo copiado."); } catch { flash("Não deu para copiar."); } };
  const share = async () => { if (navigator.share) { try { await navigator.share({ text }); } catch { /* cancelado */ } } else await copy(); };
  const download = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };
  // Compartilhar: no celular abre a folha de compartilhamento já com o PDF anexado (escolha o WhatsApp);
  // no computador baixa o PDF e oferece abrir a conversa do cliente.
  const sharePdf = async (downloadOnly = false) => {
    setError(null); setWaLink(null); setPdfBusy(true);
    try {
      const file = await makeOsPdf(data, { includePrice, contacts, kind: status === "aberta" ? "autorizacao" : "comprovante" });
      const message = `Olá! Segue a OS nº ${data.number} — ${data.client}.${data.clientOkAt ? "" : " Para autorizar, é só responder com OK."}`;
      if (!downloadOnly && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: `OS nº ${data.number}`, text: message }); }
        catch (e) { if (!(e instanceof DOMException && e.name === "AbortError")) { download(file); flash("PDF baixado. Anexe no WhatsApp."); } }
      } else {
        download(file);
        const wa = whatsappDigits(clientPhone);
        setWaLink(`https://wa.me/${wa ?? ""}?text=${encodeURIComponent(message)}`);
        flash("PDF baixado. Abra o WhatsApp e anexe o arquivo.");
      }
    } catch { setError("Não foi possível gerar o PDF. Tente de novo."); }
    finally { setPdfBusy(false); }
  };
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => start(async () => {
    setError(null);
    const r = await fn();
    if (!r.ok) return setError(r.error ?? "Não foi possível concluir.");
    after?.(); router.refresh();
  });

  return (
    <div className="space-y-4 print:hidden">
      <div className="rounded-2xl border border-brand-green/30 bg-brand-green/[0.05] p-3">
        <p className="mb-2 flex items-center gap-2 text-sm font-bold text-brand-dark"><FileText className="size-4" aria-hidden /> PDF para o cliente</p>
        <label className="mb-3 flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="size-5" checked={includePrice} onChange={(e) => setIncludePrice(e.target.checked)} /> Incluir o valor do serviço no PDF</label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn.primary} disabled={pdfBusy} onClick={() => sharePdf()}><Share2 className="size-5" aria-hidden /> {pdfBusy ? "Gerando PDF…" : "Compartilhar PDF"}</button>
          <button type="button" className={btn.ghost} disabled={pdfBusy} onClick={() => sharePdf(true)}><Download className="size-5" aria-hidden /> Baixar PDF</button>
        </div>
        {waLink && <a href={waLink} target="_blank" rel="noopener noreferrer" className={`${btn.cta} mt-3`}>Abrir conversa no WhatsApp{clientPhone ? "" : " (escolha o contato)"}</a>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn.ghost} onClick={share}><Share2 className="size-5" aria-hidden /> Enviar só texto</button>
        <button type="button" className={btn.ghost} onClick={copy}><Copy className="size-5" aria-hidden /> Copiar texto</button>
        {canWrite && status === "aberta" && <Link href={`/gestao/os/${osId}?editar=1`} className={btn.ghost}><Pencil className="size-5" aria-hidden /> Editar</Link>}
      </div>
      {msg && <p role="status" className="text-sm font-semibold text-brand-green">{msg}</p>}

      <Card className={data.clientOkAt ? "border-brand-green/40" : "border-brand-amber/50"}>
        <CardTitle>Autorização do cliente (OK no WhatsApp)</CardTitle>
        {data.clientOkAt ? (
          <div className="space-y-2">
            <p className="flex items-center gap-2 font-semibold text-brand-green"><CheckCircle2 className="size-5" aria-hidden /> Autorizada em {formatDate(data.clientOkAt)}</p>
            {clientOkNote && <p className="text-sm text-brand-graphite/80">{clientOkNote}</p>}
            {canWrite && <button type="button" className="text-sm font-bold text-danger underline" disabled={pending} onClick={() => run(() => setClientOk(osId, false, okDate))}>Desfazer registro</button>}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-brand-graphite/80">Mande o PDF e peça um <strong>OK</strong> no WhatsApp. Quando ele responder, registre aqui.</p>
            {canWrite ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label htmlFor="okdate" className={labelClass}>Data da resposta</label><input id="okdate" type="date" className={inputClass} value={okDate} onChange={(e) => setOkDate(e.target.value)} /></div>
                  <div><label htmlFor="oknote" className={labelClass}>Observação (opcional)</label><input id="oknote" className={inputClass} maxLength={300} value={okNote} onChange={(e) => setOkNote(e.target.value)} placeholder="Ex.: respondeu OK às 14h" /></div>
                </div>
                <button type="button" className={btn.cta} disabled={pending || !okDate} onClick={() => run(() => setClientOk(osId, true, okDate, okNote))}><CheckCircle2 className="size-5" aria-hidden /> Registrar: cliente respondeu OK</button>
              </>
            ) : <p className="text-sm font-semibold text-[#9a5a00]">Ainda sem OK do cliente.</p>}
          </div>
        )}
      </Card>

      {canWrite && status === "aberta" && (
        <Card className="border-brand-green/40">
          <CardTitle>Concluir e cobrar</CardTitle>
          <p className="mb-3 text-sm text-brand-graphite/80">Ao concluir, o sistema cria em <strong>Contas a receber</strong> uma cobrança de <strong>{total}</strong> para esta OS.</p>
          {accounts.length === 0 ? <p className="text-sm text-danger">Cadastre uma conta em Cadastros para concluir.</p> : (
            <div className="space-y-3">
              <AccountPicker accounts={accounts} value={account} onChange={setAccount} label="Conta onde o dinheiro vai entrar" />
              <div><label htmlFor="due" className={labelClass}>Vencimento da cobrança</label><input id="due" type="date" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
              <button type="button" disabled={pending || !account || !dueDate} className={btn.cta} onClick={() => run(() => closeOS(osId, account, dueDate))}>
                <CheckCircle2 className="size-5" aria-hidden /> Concluir OS e gerar conta a receber
              </button>
            </div>
          )}
        </Card>
      )}
      {status === "concluida" && <p className="rounded-xl bg-brand-green/10 px-4 py-3 text-sm font-semibold text-brand-green">OS concluída. A cobrança está em <Link href="/gestao/contas-a-receber" className="underline">Contas a receber</Link>.</p>}

      <FormError message={error} />
      <div className="flex flex-wrap gap-2">
        {canWrite && status === "aberta" && (
          <button type="button" className={btn.danger} disabled={pending} onClick={() => { if (confirm("Cancelar esta OS? Ela não gera cobrança.")) run(() => cancelOS(osId)); }}><XCircle className="size-5" aria-hidden /> Cancelar OS</button>
        )}
        {canManage && status !== "concluida" && (
          <button type="button" className={btn.danger} disabled={pending} onClick={() => { if (confirm("Apagar esta OS de vez?")) run(() => deleteOS(osId), () => router.push("/gestao/os")); }}><Trash2 className="size-5" aria-hidden /> Apagar</button>
        )}
      </div>
    </div>
  );
}
