import test from "node:test";
import assert from "node:assert/strict";
import { calcCalda, formatAmount, recipeText, type Product } from "../lib/calda.ts";

const ok = (r: ReturnType<typeof calcCalda>) => {
  assert.equal(r.ok, true, JSON.stringify(r));
  return r as Extract<typeof r, { ok: true }>;
};

test("formatAmount: litros viram mL e quilos viram g quando pequenos", () => {
  assert.equal(formatAmount(0.35, "L"), "350 mL");
  assert.equal(formatAmount(1.5, "L"), "1,5 L");
  assert.equal(formatAmount(0.08, "kg"), "80 g");
  assert.equal(formatAmount(12.3, "kg"), "12,3 kg");
  assert.equal(formatAmount(0.0075, "L"), "7,5 mL");
});

test("divide a área em tanques e calcula o produto por tanque (caso redondo)", () => {
  // 100 ha, 10 L/ha, tanque 40 L → 4 ha por tanque → 25 tanques cheios
  const prods: Product[] = [{ name: "Produto A", dose: 0.5, unit: "L/ha", form: "suspensao" }];
  const r = ok(calcCalda({ areaHa: 100, rateLHa: 10, tankL: 40, products: prods }));
  assert.equal(r.haPerFullTank, 4);
  assert.equal(r.fullTanks, 25);
  assert.equal(r.tankCount, 25);
  assert.equal(r.totalVolumeL, 1000);
  assert.equal(r.tanks[0].lines[0].text, "2 L"); // 0,5 L/ha × 4 ha
  assert.equal(r.tanks[0].waterL, 38); // 40 − 2 L de produto líquido
  assert.equal(r.totals[0].text, "50 L");
});

test("último tanque parcial", () => {
  // 10 ha, 12 L/ha, tanque 40 L → 3,333 ha por tanque → 3 cheios + 0,0 … 10 - 9.999 ≈ parcial pequeno
  const r = ok(calcCalda({ areaHa: 9, rateLHa: 12, tankL: 40, products: [{ name: "A", dose: 300, unit: "mL/ha", form: "emulsao" }] }));
  assert.equal(r.fullTanks, 2);
  assert.equal(r.tankCount, 3);
  const last = r.tanks[2];
  assert.equal(last.full, false);
  assert.ok(Math.abs(last.ha - (9 - 2 * (40 / 12))) < 0.001);
  assert.ok(Math.abs(last.volumeL - last.ha * 12) < 0.01);
  // soma dos produtos dos tanques = total
  const sum = r.tanks.reduce((s, t) => s + t.lines[0].amount, 0);
  assert.ok(Math.abs(sum - r.totals[0].amount) < 0.001);
});

test("área exatamente múltipla do tanque não cria tanque parcial", () => {
  const r = ok(calcCalda({ areaHa: 12, rateLHa: 10, tankL: 40, products: [] }));
  assert.equal(r.tankCount, 3);
  assert.ok(r.tanks.every((t) => t.full));
});

test("unidades: mL/ha, g/ha e kg/ha", () => {
  const r = ok(
    calcCalda({
      areaHa: 8,
      rateLHa: 10,
      tankL: 40, // 4 ha por tanque
      products: [
        { name: "Líquido", dose: 250, unit: "mL/ha", form: "solucao" },
        { name: "Pó", dose: 200, unit: "g/ha", form: "pre-diluir" },
        { name: "Granulado", dose: 0.15, unit: "kg/ha", form: "pre-diluir" },
      ],
    }),
  );
  const byName = Object.fromEntries(r.tanks[0].lines.map((l) => [l.name, l.text]));
  assert.equal(byName["Líquido"], "1 L");
  assert.equal(byName["Pó"], "800 g");
  assert.equal(byName["Granulado"], "600 g");
});

test("ordem de mistura: corretivo → pó → suspensão → emulsão → solução → adjuvante", () => {
  const r = ok(
    calcCalda({
      areaHa: 4,
      rateLHa: 10,
      tankL: 40,
      products: [
        { name: "Óleo", dose: 0.5, unit: "L/ha", form: "adjuvante" },
        { name: "EC", dose: 0.3, unit: "L/ha", form: "emulsao" },
        { name: "Acidificante", dose: 0.05, unit: "L/ha", form: "corretivo" },
        { name: "WG", dose: 100, unit: "g/ha", form: "pre-diluir" },
        { name: "SL", dose: 0.2, unit: "L/ha", form: "solucao" },
        { name: "SC", dose: 0.4, unit: "L/ha", form: "suspensao" },
      ],
    }),
  );
  assert.deepEqual(r.tanks[0].lines.map((l) => l.name), ["Acidificante", "WG", "SC", "EC", "SL", "Óleo"]);
});

test("pó não tira água do tanque; só líquido", () => {
  const r = ok(calcCalda({ areaHa: 4, rateLHa: 10, tankL: 40, products: [{ name: "Pó", dose: 500, unit: "g/ha", form: "pre-diluir" }] }));
  assert.equal(r.tanks[0].waterL, 40);
});

test("entradas inválidas devolvem mensagem em português", () => {
  for (const bad of [
    { areaHa: 0, rateLHa: 10, tankL: 40 },
    { areaHa: 5, rateLHa: 0, tankL: 40 },
    { areaHa: 5, rateLHa: 10, tankL: 0 },
    { areaHa: 5, rateLHa: 50, tankL: 40 },
  ]) {
    const r = calcCalda({ ...bad, products: [] });
    assert.equal(r.ok, false);
    assert.match((r as { error: string }).error, /[a-z]/i);
  }
});

test("avisos: volume fora do usual, líquidos acima da calda, sem produto", () => {
  assert.ok(ok(calcCalda({ areaHa: 5, rateLHa: 2, tankL: 40, products: [] })).warnings.some((w) => /fora do usual/.test(w)));
  const w = ok(calcCalda({ areaHa: 5, rateLHa: 10, tankL: 40, products: [{ name: "X", dose: 12, unit: "L/ha", form: "solucao" }] })).warnings;
  assert.ok(w.some((x) => /somam mais/.test(x)));
  assert.ok(ok(calcCalda({ areaHa: 5, rateLHa: 10, tankL: 40, products: [] })).warnings.some((x) => /Nenhum produto/.test(x)));
});

test("produtos sem nome ou sem dose são ignorados", () => {
  const r = ok(calcCalda({ areaHa: 4, rateLHa: 10, tankL: 40, products: [{ name: " ", dose: 1, unit: "L/ha", form: "solucao" }, { name: "Y", dose: 0, unit: "L/ha", form: "solucao" }] }));
  assert.equal(r.tanks[0].lines.length, 0);
});

test("texto da receita para WhatsApp traz tanque cheio, último tanque e aviso", () => {
  const input = { areaHa: 9, rateLHa: 12, tankL: 40, products: [{ name: "Produto A", dose: 0.3, unit: "L/ha" as const, form: "emulsao" as const }] };
  const r = ok(calcCalda(input));
  const t = recipeText("Soja — teste", input, r);
  assert.match(t, /CALDA — Soja — teste/);
  assert.match(t, /POR TANQUE CHEIO \(40 L\)/);
  assert.match(t, /ÚLTIMO TANQUE/);
  assert.match(t, /Siga a bula e o receituário/);
});

import { FAQ, STEPS, SOURCES } from "../lib/campo-content.ts";
test("conteúdo do guia: sem itens vazios, perguntas únicas e fontes citadas", () => {
  assert.ok(FAQ.length >= 25);
  assert.equal(new Set(FAQ.map((f) => f.q)).size, FAQ.length);
  for (const f of FAQ) {
    assert.ok(f.q.endsWith("?"), f.q);
    assert.ok(f.a.length > 60, f.q);
  }
  assert.ok(STEPS.length >= 10 && STEPS.every((s) => s.title && s.body));
  assert.ok(SOURCES.length >= 4);
  assert.ok(SOURCES.every((s) => !s.href || /^https?:\/\//.test(s.href)));
});

import { PRAGAS } from "../lib/campo-pragas.ts";
test("pragas de pastagem: campos preenchidos, ids únicos e sem dose inventada", () => {
  assert.ok(PRAGAS.length >= 7);
  assert.equal(new Set(PRAGAS.map((p) => p.id)).size, PRAGAS.length);
  for (const p of PRAGAS) {
    assert.ok(p.procurar.length >= 1 && p.manejo.length >= 1, p.id);
    assert.ok(p.resumo.length > 40 && p.danos.length > 30 && p.conferir.length > 20, p.id);
    assert.ok(!/\b\d+[,.]?\d*\s*(mL|g|kg|L)\s*(\/|por)\s*ha\b/i.test(JSON.stringify(p)), `${p.id} cita dose`);
  }
});
