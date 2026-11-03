import test from "node:test";
import assert from "node:assert/strict";
import { loadDayChecks, PREFLIGHT_ITEMS, preflightSummary, saveDayChecks, toStored, type KV } from "../lib/preflight.ts";

test("resumo: nada marcado, parcial e completo", () => {
  assert.deepEqual(preflightSummary(null), { done: 0, total: PREFLIGHT_ITEMS.length, complete: false, missing: PREFLIGHT_ITEMS.map((i) => i.label) });
  const parcial = preflightSummary([{ id: "epi", ok: true }, { id: "bateria", ok: true }, { id: "filtros", ok: false }]);
  assert.equal(parcial.done, 2);
  assert.equal(parcial.complete, false);
  assert.ok(parcial.missing.some((m) => /Filtros/.test(m)));
  const tudo = preflightSummary(PREFLIGHT_ITEMS.map((i) => ({ id: i.id, ok: true })));
  assert.equal(tudo.complete, true);
  assert.deepEqual(tudo.missing, []);
});

test("ids desconhecidos não contam", () => {
  assert.equal(preflightSummary([{ id: "inventado", ok: true }]).done, 0);
});

test("guardar: só o marcado, na ordem do checklist; vazio vira null", () => {
  assert.equal(toStored(new Set()), null);
  assert.deepEqual(toStored(new Set(["clima", "epi"])), [{ id: "epi", ok: true }, { id: "clima", ok: true }]);
  assert.deepEqual(toStored(new Set(["lixo"])), null);
});

const mem = (): KV => { const d = new Map<string, string>(); return { getItem: (k) => d.get(k) ?? null, setItem: (k, v) => void d.set(k, v) }; };

test("checklist do dia: volta no mesmo dia e zera no dia seguinte", () => {
  const kv = mem();
  assert.equal(loadDayChecks(kv, "2026-11-03").size, 0);
  saveDayChecks(kv, "2026-11-03", new Set(["epi", "bateria"]));
  assert.deepEqual([...loadDayChecks(kv, "2026-11-03")].sort(), ["bateria", "epi"]);
  assert.equal(loadDayChecks(kv, "2026-11-04").size, 0);
});

test("checklist do dia ignora lixo guardado", () => {
  const kv = mem();
  kv.setItem("norte:prevoo:v1", "não é json");
  assert.equal(loadDayChecks(kv, "2026-11-03").size, 0);
  kv.setItem("norte:prevoo:v1", JSON.stringify({ day: "2026-11-03", ids: ["epi", "inventado", 7] }));
  assert.deepEqual([...loadDayChecks(kv, "2026-11-03")], ["epi"]);
});
