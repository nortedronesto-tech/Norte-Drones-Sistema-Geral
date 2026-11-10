import test from "node:test";
import assert from "node:assert/strict";
import { createFinanceQueue, receiptPathFor, type AsyncStore, type QueueDeps, type QueueItem, type SendResult, type TxPayload } from "../lib/finance-queue.ts";

const memStore = <T>(): AsyncStore<T> & { map: Map<string, T> } => {
  const map = new Map<string, T>();
  return {
    map,
    all: async () => [...map.values()],
    get: async (k) => map.get(k),
    put: async (k, v) => void map.set(k, v),
    del: async (k) => void map.delete(k),
  };
};

const tx = (extra: Partial<TxPayload> = {}): TxPayload => ({ type: "saida", amount: 150, account_id: "acc", category: "Combustível", status: "pago", date: "2026-10-14", ...extra });
const photo = () => ({ blob: new Blob(["foto"], { type: "image/jpeg" }), ext: "jpg", type: "image/jpeg" });

function setup(over: Partial<QueueDeps> = {}) {
  const items = memStore<QueueItem>();
  const blobs = memStore<Blob>();
  const log: string[] = [];
  let clock = 0;
  const deps: QueueDeps = {
    items, blobs,
    now: () => new Date(2026, 9, 14, 12, 0, clock++).toISOString(),
    upload: async (path) => { log.push(`up:${path}`); return { ok: true }; },
    removeUpload: async (path) => void log.push(`rm:${path}`),
    createTransaction: async (p) => { log.push(`tx:${p.new_id}:${p.receipt_path ?? "-"}`); return { ok: true }; },
    attachReceipt: async (id, path) => { log.push(`att:${id}:${path}`); return { ok: true }; },
    ...over,
  };
  return { q: createFinanceQueue(deps), items, blobs, log };
}

test("caminho da foto é determinístico (reenvio não cria segunda cópia)", () => {
  assert.equal(receiptPathFor("k1", "2026-10-14", "JPG"), "2026/10/k1.jpg");
  assert.equal(receiptPathFor("k1", "2026-10-14", "jpg"), receiptPathFor("k1", "2026-10-14", "jpg"));
  assert.match(receiptPathFor("k1", "lixo", "../x"), /^\d{4}\/\d{2}\/k1\.x$/);
});

test("guarda lançamento + foto e envia: foto primeiro, depois o lançamento com o caminho e a chave", async () => {
  const { q, items, blobs, log } = setup();
  await q.enqueueTransaction({ key: "a", label: "Despesa", payload: tx(), receipt: photo() });
  assert.equal((await q.list()).length, 1);
  assert.equal(blobs.map.size, 1);
  const r = await q.flush();
  assert.deepEqual(r, { sent: 1, rejected: 0, pending: 0, stopped: false });
  assert.deepEqual(log, ["up:2026/10/a.jpg", "tx:a:2026/10/a.jpg"]);
  assert.equal(items.map.size, 0);
  assert.equal(blobs.map.size, 0, "a foto local some depois de enviada");
});

test("envia na ordem em que foi criado", async () => {
  const { q, log } = setup();
  await q.enqueueTransaction({ key: "um", label: "1", payload: tx() });
  await q.enqueueTransaction({ key: "dois", label: "2", payload: tx() });
  await q.flush();
  assert.deepEqual(log, ["tx:um:-", "tx:dois:-"]);
});

test("sem rede: tudo continua guardado, a fila para e a foto que já subiu não sobe de novo", async () => {
  let online = false;
  const { q, items, log } = setup({
    createTransaction: async (p) => { if (!online) throw new TypeError("Failed to fetch"); log2.push(p.new_id); return { ok: true }; },
  });
  const log2: string[] = [];
  await q.enqueueTransaction({ key: "a", label: "A", payload: tx(), receipt: photo() });
  await q.enqueueTransaction({ key: "b", label: "B", payload: tx() });
  let r = await q.flush();
  assert.equal(r.stopped, true);
  assert.equal(r.sent, 0);
  assert.equal(items.map.size, 2, "nada se perde");
  assert.equal(items.map.get("a")?.attempts, 1);
  assert.equal(items.map.get("a")?.receiptPath, "2026/10/a.jpg", "foto já subiu");
  online = true;
  r = await q.flush();
  assert.deepEqual(r, { sent: 2, rejected: 0, pending: 0, stopped: false });
  assert.deepEqual(log2, ["a", "b"]);
  assert.equal(log.filter((l) => l.startsWith("up:")).length, 1, "a foto subiu uma vez só");
});

test("servidor recusa o dado: marca o erro, apaga a foto órfã e segue com os próximos", async () => {
  const { q, items, log } = setup({
    createTransaction: async (p) => (p.new_id === "ruim" ? { ok: false, error: "Conta inativa" } : { ok: true }),
  });
  await q.enqueueTransaction({ key: "ruim", label: "R", payload: tx(), receipt: photo() });
  await q.enqueueTransaction({ key: "bom", label: "B", payload: tx() });
  const r = await q.flush();
  assert.deepEqual(r, { sent: 1, rejected: 1, pending: 0, stopped: false });
  assert.equal(items.map.get("ruim")?.error, "Conta inativa");
  assert.ok(log.includes("rm:2026/10/ruim.jpg"));
  // item recusado não é reenviado sozinho...
  assert.equal((await q.flush()).sent, 0);
  // ...até a pessoa pedir para tentar de novo
  await q.retry("ruim");
  assert.equal(items.map.get("ruim")?.error, undefined);
});

test("descartar remove o item e a foto local", async () => {
  const { q, items, blobs } = setup();
  await q.enqueueTransaction({ key: "a", label: "A", payload: tx(), receipt: photo() });
  await q.discard("a");
  assert.equal(items.map.size, 0);
  assert.equal(blobs.map.size, 0);
});

test("anexar recibo a lançamento que já existe: sobe a foto e chama o anexo", async () => {
  const { q, log, items } = setup();
  await q.enqueueAttach({ key: "x", label: "Recibo", transactionId: "tx-1", date: "2026-09-30", receipt: photo() });
  assert.deepEqual(await q.flush(), { sent: 1, rejected: 0, pending: 0, stopped: false });
  assert.deepEqual(log, ["up:2026/09/x.jpg", "att:tx-1:2026/09/x.jpg"]);
  assert.equal(items.map.size, 0);
});

test("foto sumiu do aparelho: lançamento segue sem foto; anexo é recusado com mensagem clara", async () => {
  const { q, blobs, log, items } = setup();
  await q.enqueueTransaction({ key: "a", label: "A", payload: tx(), receipt: photo() });
  await q.enqueueAttach({ key: "b", label: "B", transactionId: "t", date: "2026-10-01", receipt: photo() });
  blobs.map.clear();
  const r = await q.flush();
  assert.equal(r.sent, 1);
  assert.equal(r.rejected, 1);
  assert.ok(log.includes("tx:a:-"));
  assert.match(items.map.get("b")?.error ?? "", /não está mais no aparelho/);
});

test("duas execuções ao mesmo tempo não enviam duas vezes", async () => {
  let n = 0;
  const { q } = setup({ createTransaction: async () => { n++; await new Promise((r) => setTimeout(r, 20)); return { ok: true } as SendResult; } });
  await q.enqueueTransaction({ key: "a", label: "A", payload: tx() });
  await Promise.all([q.flush(), q.flush()]);
  assert.equal(n, 1);
});

test("falha de upload (sem rede) para a fila; recusa do upload marca o erro", async () => {
  let mode: "down" | "deny" = "down";
  const { q, items } = setup({ upload: async () => { if (mode === "down") throw new Error("net"); return { ok: false, error: "Arquivo grande demais" }; } });
  await q.enqueueTransaction({ key: "a", label: "A", payload: tx(), receipt: photo() });
  let r = await q.flush();
  assert.equal(r.stopped, true);
  mode = "deny";
  r = await q.flush();
  assert.equal(r.rejected, 1);
  assert.equal(items.map.get("a")?.error, "Arquivo grande demais");
});
