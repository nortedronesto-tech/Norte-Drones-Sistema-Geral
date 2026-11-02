import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PRICE_PER_HA, defaultDue, osCalda, osText, osTotal, type OsData } from "../lib/os.ts";

const base: OsData = {
  number: 12, client: "Fazenda Boa Vista", farm: "Talhão 3", date: "2026-11-02", areaHa: 40, pricePerHa: 95,
  crop: "Soja", target: "Ferrugem", drone: "T50", operator: "João", rateLHa: 10, tankL: 40,
  products: [{ name: "Produto A (exemplo)", dose: 0.5, unit: "L/ha", form: "emulsao" }],
  windKmh: 6, tempC: 28, humidityPct: 65, notes: "Sem vento forte",
};

test("total: área × valor por ha, sem erro de ponto flutuante", () => {
  assert.equal(osTotal(40, 95), 3800);
  assert.equal(osTotal(0.1, 3), 0.3);
  assert.equal(osTotal(12.5, 100), 1250);
  assert.equal(osTotal(0, 100), 0);
  assert.equal(osTotal(10, -5), 0);
  assert.equal(DEFAULT_PRICE_PER_HA, 100);
});

test("vencimento padrão: hoje + 15 dias, atravessando mês e ano", () => {
  assert.equal(defaultDue("2026-11-02"), "2026-11-17");
  assert.equal(defaultDue("2026-12-25"), "2027-01-09");
  assert.equal(defaultDue("2026-11-02", 0), "2026-11-02");
});

test("plano de calda da OS só existe com volume e tanque", () => {
  const c = osCalda(base);
  assert.ok(c);
  assert.equal(c?.result.tankCount, 10);
  assert.equal(osCalda({ ...base, tankL: null }), null);
  assert.equal(osCalda({ ...base, rateLHa: null }), null);
});

test("texto do WhatsApp traz cliente, área, produtos, clima e valor", () => {
  const t = osText(base);
  assert.match(t, /Ordem de serviço nº 12/);
  assert.match(t, /Fazenda Boa Vista · Talhão 3/);
  assert.match(t, /40 ha/);
  assert.match(t, /Produto A \(exemplo\): 0,5 L\/ha/);
  assert.match(t, /vento 6 km\/h/);
  assert.match(t, /R\$\s?3\.800,00/);
  assert.doesNotMatch(osText(base, false), /Valor:/);
});

test("texto pede o OK do cliente, e para de pedir depois que ele respondeu", () => {
  assert.match(osText(base), /responder esta mensagem com \*OK\*/);
  assert.doesNotMatch(osText({ ...base, clientOkAt: "2026-11-03" }), /responder esta mensagem/);
  assert.doesNotMatch(osText(base, true, false), /responder esta mensagem/);
});
