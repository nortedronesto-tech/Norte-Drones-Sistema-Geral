import test from "node:test";
import assert from "node:assert/strict";
import { PREFLIGHT_ITEMS, preflightSummary, toStored } from "../lib/preflight.ts";

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
