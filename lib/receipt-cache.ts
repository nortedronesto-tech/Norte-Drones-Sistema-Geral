// Cópia dos recibos no aparelho (Cache Storage) para ver o anexo sem sinal — na auditoria, nos lançamentos e no arquivo de recibos.
// A URL assinada do Supabase vale 1 hora, então a cópia é guardada pelo CAMINHO do arquivo (estável), não pela URL.
// Só roda no navegador. O service worker apaga esta cópia quando a pessoa sai do sistema (abre /login).

export const RECEIPTS_CACHE = "norte-receipts-v1";
const MAX_FILES = 400;
const keyOf = (path: string) => new URL(`/__receipts/${path}`, location.origin).href;

const supported = () => typeof caches !== "undefined" && typeof location !== "undefined";

/** Devolve a foto guardada como URL local (blob:), ou null se ainda não foi guardada. */
export async function cachedReceiptUrl(path: string): Promise<string | null> {
  if (!supported()) return null;
  try {
    const hit = await (await caches.open(RECEIPTS_CACHE)).match(keyOf(path));
    return hit ? URL.createObjectURL(await hit.blob()) : null;
  } catch { return null; }
}

export async function isReceiptCached(path: string): Promise<boolean> {
  if (!supported()) return false;
  try { return !!(await (await caches.open(RECEIPTS_CACHE)).match(keyOf(path))); } catch { return false; }
}

// Baixa uma foto de cada vez (no máximo 2 ao mesmo tempo) e só as que ainda não estão no aparelho: pouco dado no 4G.
const waiting: Array<() => Promise<void>> = [];
let running = 0;
function pump() {
  while (running < 2 && waiting.length) {
    const job = waiting.shift()!;
    running++;
    job().finally(() => { running--; pump(); });
  }
}

function slowLink(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!c && (c.saveData === true || c.effectiveType === "slow-2g" || c.effectiveType === "2g");
}

/** Guarda a foto no aparelho (em segundo plano). Não faz nada sem sinal, com economia de dados ligada ou se já estiver guardada. */
export function keepReceipt(path: string, signedUrl: string): void {
  if (!supported() || !navigator.onLine || slowLink()) return;
  waiting.push(async () => {
    try {
      const cache = await caches.open(RECEIPTS_CACHE);
      if (await cache.match(keyOf(path))) return;
      const res = await fetch(signedUrl);
      if (!res.ok) return;
      await cache.put(keyOf(path), res);
      const keys = await cache.keys(); // mais antigas primeiro
      for (const k of keys.slice(0, Math.max(0, keys.length - MAX_FILES))) await cache.delete(k);
    } catch { /* tenta na próxima visita */ }
  });
  pump();
}

export async function clearReceiptCache() {
  if (supported()) await caches.delete(RECEIPTS_CACHE).catch(() => {});
}
