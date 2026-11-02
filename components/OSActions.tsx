"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Pencil, Share2, Trash2, XCircle } from "lucide-react";
import { cancelOS, closeOS, deleteOS } from "@/app/gestao/os/actions";
import type { AccountBalance } from "@/lib/types";
import { AccountPicker } from "./AccountPicker";
import { PrintButton } from "./PrintButton";
import { btn, Card, CardTitle, FormError, inputClass, labelClass } from "./ui";

export function OSActions({ osId, status, accounts, due, text, total, canWrite, canManage }: {
  osId: string; status: "aberta" | "concluida" | "cancelada"; accounts: AccountBalance[]; due: string; text: string; total: string;
  canWrite: boolean; canManage: boolean;
}) {
  const router = useRouter();
  const [account, setAccount] = useState(accounts[0]?.id ?? "");
  const [dueDate, setDueDate] = useState(due);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(null), 3500); };
  const copy = async () => { try { await navigator.clipboard.writeText(text); flash("Resumo copiado."); } catch { flash("Não deu para copiar."); } };
  const share = async () => { if (navigator.share) { try { await navigator.share({ text }); } catch { /* cancelado */ } } else await copy(); };
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => start(async () => {
    setError(null);
    const r = await fn();
    if (!r.ok) return setError(r.error ?? "Não foi possível concluir.");
    after?.(); router.refresh();
  });

  return (
    <div className="space-y-4 print:hidden">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn.primary} onClick={share}><Share2 className="size-5" aria-hidden /> Enviar resumo (WhatsApp)</button>
        <button type="button" className={btn.ghost} onClick={copy}><Copy className="size-5" aria-hidden /> Copiar</button>
        <PrintButton />
        {canWrite && status === "aberta" && <Link href={`/gestao/os/${osId}?editar=1`} className={btn.ghost}><Pencil className="size-5" aria-hidden /> Editar</Link>}
      </div>
      {msg && <p role="status" className="text-sm font-semibold text-brand-green">{msg}</p>}

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
