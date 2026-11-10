"use client";
// Ponto único do navegador para o financeiro sem sinal: fila no IndexedDB + envio ao servidor.
import { attachReceipt, createTransaction } from "@/app/gestao/actions";
import { createFinanceQueue, receiptPathFor, type FinanceQueue, type QueueItem, type SendResult, type TxPayload } from "@/lib/finance-queue";
import { idbStore, STORES } from "@/lib/offline-db";
import { compressImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";
import { formatBRL } from "@/lib/format";

export const QUEUE_EVENT = "norte:finance-queue";
const notify = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(QUEUE_EVENT)); };

/** Erro de rede (sem sinal, sinal caindo, servidor fora): é o único tipo que manda o item para a fila. */
export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|timed out|aborted|server action|unexpected response|err_internet|offline/i.test(msg);
}

async function upload(path: string, blob: Blob, type: string): Promise<SendResult> {
  const { error } = await createClient().storage.from("receipts").upload(path, blob, { contentType: type, upsert: false });
  if (!error) return { ok: true };
  const info = error as { message: string; statusCode?: string | number; status?: number };
  if (/already exists|duplicate/i.test(info.message) || String(info.statusCode ?? info.status) === "409") return { ok: true }; // reenvio: já está lá
  if (isNetworkError(error)) throw error;
  return { ok: false, error: `Não foi possível enviar a foto: ${info.message}` };
}

let queue: FinanceQueue | null = null;
export function financeQueue(): FinanceQueue {
  queue ??= createFinanceQueue({
    items: idbStore<QueueItem>(STORES.queue),
    blobs: idbStore<Blob>(STORES.blobs),
    upload,
    removeUpload: async (path) => void (await createClient().storage.from("receipts").remove([path])),
    createTransaction: async (p) => { const r = await createTransaction(p); return r.ok ? { ok: true } : { ok: false, error: r.error }; },
    attachReceipt: async (id, path) => { const r = await attachReceipt(id, path); return r.ok ? { ok: true } : { ok: false, error: r.error }; },
  });
  return queue;
}

export async function flushFinanceQueue() {
  const r = await financeQueue().flush();
  notify();
  return r;
}

export type SubmitResult = { mode: "sent" } | { mode: "queued" } | { mode: "rejected"; error: string };

const labelOf = (p: TxPayload) => `${p.type === "entrada" ? "Entrada" : "Despesa"} de ${formatBRL(p.amount)} · ${p.category}${p.description ? ` · ${p.description}` : ""}`;

/**
 * Lança agora se tem sinal; se não tem (ou cai no meio), guarda no aparelho com a foto e envia depois.
 * A chave criada aqui é o id do lançamento e o nome da foto: repetir o envio nunca duplica.
 */
export async function submitTransaction(payload: TxPayload, file: File | null): Promise<SubmitResult> {
  const key = crypto.randomUUID();
  const receipt = file ? await compressImage(file) : undefined;
  const store = (receiptPath?: string) => financeQueue().enqueueTransaction({ key, label: labelOf(payload), payload, receipt, receiptPath }).then(() => { notify(); return { mode: "queued" } as const; });

  if (typeof navigator !== "undefined" && !navigator.onLine) return store();

  let receiptPath: string | undefined;
  try {
    if (receipt) {
      const path = receiptPathFor(key, payload.date, receipt.ext);
      const up = await upload(path, receipt.blob, receipt.type);
      if (!up.ok) return { mode: "rejected", error: up.error };
      receiptPath = path;
    }
    const res = await createTransaction({ ...payload, receipt_path: receiptPath, new_id: key });
    if (!res.ok) {
      if (receiptPath) await createClient().storage.from("receipts").remove([receiptPath]).catch(() => {});
      return { mode: "rejected", error: res.error };
    }
    return { mode: "sent" };
  } catch (e) {
    if (isNetworkError(e)) return store(receiptPath);
    return { mode: "rejected", error: e instanceof Error ? e.message : "Erro inesperado. Tente de novo." };
  }
}

/** Anexa a foto a um lançamento que já existe (com sinal agora, ou guardada para enviar depois). */
export async function submitAttachment(input: { transactionId: string; date: string; label: string; file: File }): Promise<SubmitResult> {
  const key = crypto.randomUUID();
  const receipt = await compressImage(input.file);
  const store = () => financeQueue().enqueueAttach({ key, label: input.label, transactionId: input.transactionId, date: input.date, receipt }).then(() => { notify(); return { mode: "queued" } as const; });
  if (typeof navigator !== "undefined" && !navigator.onLine) return store();
  try {
    const path = receiptPathFor(key, input.date, receipt.ext);
    const up = await upload(path, receipt.blob, receipt.type);
    if (!up.ok) return { mode: "rejected", error: up.error };
    const res = await attachReceipt(input.transactionId, path);
    if (!res.ok) { await createClient().storage.from("receipts").remove([path]).catch(() => {}); return { mode: "rejected", error: res.error }; }
    return { mode: "sent" };
  } catch (e) {
    if (isNetworkError(e)) return store();
    return { mode: "rejected", error: e instanceof Error ? e.message : "Erro inesperado. Tente de novo." };
  }
}
