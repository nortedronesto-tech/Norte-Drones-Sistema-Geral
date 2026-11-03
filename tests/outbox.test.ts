import test from "node:test";
import assert from "node:assert/strict";
import { enqueue, flushOutbox, readOutbox, removeFromOutbox, retryItem, type KV, type OutboxItem } from "../lib/outbox.ts";

const mem = (): KV & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};
const item = (key: string, extra: Partial<OutboxItem> = {}) => ({ key, label: `OS ${key}`, payload: { area_ha: 10 }, ...extra });

test("enfileira, lê e remove; mesma chave não duplica", () => {
  const kv = mem();
  enqueue(kv, item("a")); enqueue(kv, item("b")); enqueue(kv, item("a", { label: "atualizada" }));
  assert.deepEqual(readOutbox(kv).map((i) => i.key), ["b", "a"]);
  assert.equal(readOutbox(kv).find((i) => i.key === "a")?.label, "atualizada");
  removeFromOutbox(kv, "b");
  assert.deepEqual(readOutbox(kv).map((i) => i.key), ["a"]);
});

test("armazenamento corrompido ou vazio não quebra", () => {
  const kv = mem();
  assert.deepEqual(readOutbox(kv), []);
  kv.setItem("norte:outbox:v1", "{ isso não é json");
  assert.deepEqual(readOutbox(kv), []);
  kv.setItem("norte:outbox:v1", '{"x":1}');
  assert.deepEqual(readOutbox(kv), []);
});

test("envio com sucesso esvazia a fila, na ordem em que foi criada", async () => {
  const kv = mem();
  enqueue(kv, item("1")); enqueue(kv, item("2")); enqueue(kv, item("3"));
  const order: string[] = [];
  const r = await flushOutbox(kv, async (i) => { order.push(i.key); return { ok: true }; });
  assert.deepEqual(order, ["1", "2", "3"]);
  assert.deepEqual(r, { sent: 3, rejected: 0, pending: 0, stopped: false });
  assert.equal(readOutbox(kv).length, 0);
});

test("sem rede (send lança): para, guarda tudo e conta a tentativa", async () => {
  const kv = mem();
  enqueue(kv, item("1")); enqueue(kv, item("2"));
  const r = await flushOutbox(kv, async () => { throw new Error("Failed to fetch"); });
  assert.equal(r.stopped, true);
  assert.equal(r.sent, 0);
  assert.equal(r.pending, 2);
  const list = readOutbox(kv);
  assert.equal(list.length, 2);
  assert.equal(list[0].attempts, 1);
  assert.equal(list[1].attempts, 0); // parou no primeiro
});

test("o primeiro envia e o segundo cai sem rede: só o primeiro sai da fila", async () => {
  const kv = mem();
  enqueue(kv, item("1")); enqueue(kv, item("2"));
  let n = 0;
  const r = await flushOutbox(kv, async () => { if (++n === 2) throw new Error("offline"); return { ok: true }; });
  assert.equal(r.sent, 1);
  assert.deepEqual(readOutbox(kv).map((i) => i.key), ["2"]);
});

test("recusa do servidor marca o erro, segue a fila e não tenta de novo sozinha", async () => {
  const kv = mem();
  enqueue(kv, item("1")); enqueue(kv, item("2"));
  const sentKeys: string[] = [];
  const r1 = await flushOutbox(kv, async (i) => { sentKeys.push(i.key); return i.key === "1" ? { ok: false, error: "Escolha o cliente" } : { ok: true }; });
  assert.deepEqual(r1, { sent: 1, rejected: 1, pending: 0, stopped: false });
  assert.equal(readOutbox(kv)[0].error, "Escolha o cliente");
  await flushOutbox(kv, async (i) => { sentKeys.push(i.key); return { ok: true }; });
  assert.deepEqual(sentKeys, ["1", "2"]); // o item recusado não foi reenviado
  retryItem(kv, "1");
  await flushOutbox(kv, async (i) => { sentKeys.push(i.key); return { ok: true }; });
  assert.deepEqual(sentKeys, ["1", "2", "1"]);
  assert.equal(readOutbox(kv).length, 0);
});

test("dois envios ao mesmo tempo não duplicam", async () => {
  const kv = mem();
  enqueue(kv, item("1"));
  let calls = 0;
  const slow = async () => { calls++; await new Promise((r) => setTimeout(r, 20)); return { ok: true as const }; };
  await Promise.all([flushOutbox(kv, slow), flushOutbox(kv, slow)]);
  assert.equal(calls, 1);
});
