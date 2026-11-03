// Fila de envio offline: guarda no aparelho o que foi feito sem sinal e envia quando a internet volta.
// Puro (recebe o "armazenamento" e a função de envio), testado em tests/outbox.test.ts.
// Cada item tem uma chave (UUID) que vira o id da OS no banco: reenviar a mesma chave nunca duplica.

export type OutboxItem = {
  key: string;
  createdAt: string;
  label: string; // texto para mostrar na tela, ex.: "Fazenda Boa Vista · 40 ha"
  payload: Record<string, unknown>; // dados da OS, como a ação saveOS recebe
  newClientName?: string; // cliente cadastrado sem sinal: é criado no envio
  attempts: number;
  error?: string; // recusa do servidor (dado inválido): fica na lista até a pessoa corrigir ou descartar
};

export type KV = { getItem(k: string): string | null; setItem(k: string, v: string): void };
export type SendResult = { ok: true } | { ok: false; error: string };

export const OUTBOX_KEY = "norte:outbox:v1";

export function readOutbox(kv: KV): OutboxItem[] {
  try {
    const raw = kv.getItem(OUTBOX_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? (list as OutboxItem[]).filter((i) => i && typeof i.key === "string") : [];
  } catch {
    return [];
  }
}

function write(kv: KV, list: OutboxItem[]) {
  kv.setItem(OUTBOX_KEY, JSON.stringify(list));
}

export function enqueue(kv: KV, item: Omit<OutboxItem, "attempts" | "createdAt"> & { createdAt?: string }): OutboxItem {
  const full: OutboxItem = { attempts: 0, createdAt: new Date().toISOString(), ...item };
  const rest = readOutbox(kv).filter((i) => i.key !== full.key);
  write(kv, [...rest, full]);
  return full;
}

export function removeFromOutbox(kv: KV, key: string) {
  write(kv, readOutbox(kv).filter((i) => i.key !== key));
}

function patchItem(kv: KV, key: string, patch: Partial<OutboxItem>) {
  write(kv, readOutbox(kv).map((i) => (i.key === key ? { ...i, ...patch } : i)));
}

let flushing = false;

/**
 * Envia a fila em ordem. `send` devolve {ok:true} ao concluir; {ok:false,error} quando o servidor recusa o
 * dado (o item fica marcado com o erro e a fila segue); se `send` LANÇAR erro (sem rede, sessão expirada), a fila
 * para e tudo continua guardado para a próxima tentativa.
 */
export async function flushOutbox(kv: KV, send: (item: OutboxItem) => Promise<SendResult>): Promise<{ sent: number; rejected: number; pending: number; stopped: boolean }> {
  if (flushing) return { sent: 0, rejected: 0, pending: readOutbox(kv).length, stopped: false };
  flushing = true;
  let sent = 0, rejected = 0, stopped = false;
  try {
    for (const item of readOutbox(kv)) {
      if (item.error) continue; // recusado antes: espera a pessoa descartar
      try {
        const res = await send(item);
        if (res.ok) { removeFromOutbox(kv, item.key); sent++; }
        else { patchItem(kv, item.key, { error: res.error, attempts: item.attempts + 1 }); rejected++; }
      } catch {
        patchItem(kv, item.key, { attempts: item.attempts + 1 });
        stopped = true;
        break;
      }
    }
  } finally {
    flushing = false;
  }
  return { sent, rejected, pending: readOutbox(kv).filter((i) => !i.error).length, stopped };
}

/** Tira a marca de erro para tentar de novo (depois de a pessoa corrigir o cadastro, por exemplo). */
export function retryItem(kv: KV, key: string) {
  patchItem(kv, key, { error: undefined });
}
