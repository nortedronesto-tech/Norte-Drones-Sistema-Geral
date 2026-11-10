// Fila de envio do FINANCEIRO sem sinal — PURA (recebe o "armazenamento" e as funções de envio), testada em tests/finance-queue.test.ts.
//
// Guarda no aparelho o lançamento (e a foto do recibo, que é grande demais para o localStorage) feito sem sinal e envia
// quando a internet volta. Nunca duplica: a chave (UUID) do item vira o id do lançamento no banco e o nome do arquivo da
// foto no bucket, então reenviar a mesma chave só repete o mesmo resultado.

export type TxPayload = {
  type: "entrada" | "saida";
  amount: number;
  account_id: string;
  category: string;
  description?: string;
  status: "pago" | "a_pagar" | "a_receber";
  date: string; // YYYY-MM-DD
  supplier_id?: string;
};

export type ReceiptRef = { blobKey: string; ext: string; type: string; size: number };

export type QueueItem = {
  key: string;
  kind: "transaction" | "attach";
  createdAt: string;
  label: string; // texto para a tela, ex.: "Despesa de R$ 150,00 · Combustível"
  payload?: TxPayload; // kind = transaction
  transactionId?: string; // kind = attach
  date: string; // data usada na pasta da foto (AAAA/MM/…)
  receipt?: ReceiptRef;
  receiptPath?: string; // preenchido quando a foto já subiu (não sobe de novo)
  attempts: number;
  error?: string; // recusa do servidor: fica na lista até a pessoa corrigir ou descartar
};

/** Armazenamento assíncrono simples (IndexedDB no navegador, memória nos testes). */
export interface AsyncStore<T> {
  all(): Promise<T[]>;
  get(key: string): Promise<T | undefined>;
  put(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
}

export type SendResult = { ok: true } | { ok: false; error: string };

export type QueueDeps = {
  items: AsyncStore<QueueItem>;
  blobs: AsyncStore<Blob>;
  /** Sobe a foto. Devolve ok também quando o arquivo já existe. LANÇA erro se não houver rede. */
  upload: (path: string, blob: Blob, type: string) => Promise<SendResult>;
  /** Apaga uma foto que ficou sem lançamento (melhor esforço). */
  removeUpload?: (path: string) => Promise<void>;
  /** LANÇA erro se não houver rede; devolve {ok:false} quando o servidor recusa o dado. */
  createTransaction: (payload: TxPayload & { receipt_path?: string; new_id: string }) => Promise<SendResult>;
  attachReceipt: (transactionId: string, receiptPath: string) => Promise<SendResult>;
  now?: () => string;
};

/** Caminho da foto no bucket: determinístico a partir da chave, para o reenvio nunca criar uma segunda cópia. */
export function receiptPathFor(key: string, date: string, ext: string): string {
  const [y, m] = /^\d{4}-\d{2}/.test(date) ? date.split("-") : new Date().toISOString().slice(0, 7).split("-");
  return `${y}/${m}/${key}.${ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg"}`;
}

const byDate = (a: QueueItem, b: QueueItem) => a.createdAt.localeCompare(b.createdAt);

export function createFinanceQueue(deps: QueueDeps) {
  const now = deps.now ?? (() => new Date().toISOString());
  let flushing = false;

  async function list(): Promise<QueueItem[]> {
    return (await deps.items.all()).filter((i) => i && typeof i.key === "string").sort(byDate);
  }

  async function saveBlob(key: string, receipt?: { blob: Blob; ext: string; type: string }): Promise<ReceiptRef | undefined> {
    if (!receipt) return undefined;
    const blobKey = `${key}:receipt`;
    await deps.blobs.put(blobKey, receipt.blob);
    return { blobKey, ext: receipt.ext, type: receipt.type, size: receipt.blob.size };
  }

  async function enqueueTransaction(input: {
    key: string;
    label: string;
    payload: TxPayload;
    receipt?: { blob: Blob; ext: string; type: string };
    receiptPath?: string; // foto que já subiu antes de a rede cair
  }): Promise<QueueItem> {
    const ref = input.receiptPath ? undefined : await saveBlob(input.key, input.receipt);
    const item: QueueItem = {
      key: input.key, kind: "transaction", createdAt: now(), label: input.label, payload: input.payload,
      date: input.payload.date, receipt: ref, receiptPath: input.receiptPath, attempts: 0,
    };
    await deps.items.put(item.key, item);
    return item;
  }

  async function enqueueAttach(input: {
    key: string;
    label: string;
    transactionId: string;
    date: string;
    receipt: { blob: Blob; ext: string; type: string };
  }): Promise<QueueItem> {
    const ref = await saveBlob(input.key, input.receipt);
    const item: QueueItem = {
      key: input.key, kind: "attach", createdAt: now(), label: input.label, transactionId: input.transactionId,
      date: input.date, receipt: ref, attempts: 0,
    };
    await deps.items.put(item.key, item);
    return item;
  }

  async function patch(key: string, changes: Partial<QueueItem>) {
    const cur = await deps.items.get(key);
    if (cur) await deps.items.put(key, { ...cur, ...changes });
  }

  async function finish(item: QueueItem) {
    await deps.items.del(item.key);
    if (item.receipt) await deps.blobs.del(item.receipt.blobKey);
  }

  async function discard(key: string) {
    const item = await deps.items.get(key);
    if (item) await finish(item);
  }

  async function retry(key: string) {
    await patch(key, { error: undefined });
  }

  async function sendOne(item: QueueItem): Promise<SendResult> {
    let receiptPath = item.receiptPath;
    // 1) a foto sobe primeiro (e só uma vez)
    if (!receiptPath && item.receipt) {
      const blob = await deps.blobs.get(item.receipt.blobKey);
      if (!blob) {
        // foto sumiu do aparelho (limpeza do navegador): segue sem foto em vez de travar a fila
        if (item.kind === "attach") return { ok: false, error: "A foto deste recibo não está mais no aparelho. Anexe de novo." };
      } else {
        const path = receiptPathFor(item.key, item.date, item.receipt.ext);
        const up = await deps.upload(path, blob, item.receipt.type);
        if (!up.ok) return up;
        receiptPath = path;
        await patch(item.key, { receiptPath: path }); // se cair a rede agora, não sobe de novo
      }
    }
    // 2) depois o lançamento (ou o anexo)
    if (item.kind === "transaction" && item.payload) {
      const res = await deps.createTransaction({ ...item.payload, receipt_path: receiptPath, new_id: item.key });
      if (!res.ok && receiptPath && deps.removeUpload) await deps.removeUpload(receiptPath).catch(() => {});
      return res;
    }
    if (item.kind === "attach" && item.transactionId && receiptPath) {
      const res = await deps.attachReceipt(item.transactionId, receiptPath);
      if (!res.ok && deps.removeUpload) await deps.removeUpload(receiptPath).catch(() => {});
      return res;
    }
    return { ok: false, error: "Item da fila incompleto." };
  }

  /**
   * Envia a fila em ordem. Recusa do servidor (dado inválido): o item fica marcado com o erro e a fila segue.
   * Falta de rede (qualquer função LANÇA): a fila para e tudo continua guardado para a próxima tentativa.
   */
  async function flush(): Promise<{ sent: number; rejected: number; pending: number; stopped: boolean }> {
    if (flushing) return { sent: 0, rejected: 0, pending: (await list()).filter((i) => !i.error).length, stopped: false };
    flushing = true;
    let sent = 0, rejected = 0, stopped = false;
    try {
      for (const item of await list()) {
        if (item.error) continue;
        try {
          const res = await sendOne(item);
          if (res.ok) { await finish(item); sent++; }
          else { await patch(item.key, { error: res.error, attempts: item.attempts + 1 }); rejected++; }
        } catch {
          await patch(item.key, { attempts: item.attempts + 1 });
          stopped = true;
          break;
        }
      }
    } finally {
      flushing = false;
    }
    return { sent, rejected, pending: (await list()).filter((i) => !i.error).length, stopped };
  }

  return { list, enqueueTransaction, enqueueAttach, discard, retry, flush, blobOf: (item: QueueItem) => (item.receipt ? deps.blobs.get(item.receipt.blobKey) : Promise.resolve(undefined)) };
}

export type FinanceQueue = ReturnType<typeof createFinanceQueue>;
