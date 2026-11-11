import test from "node:test";
import assert from "node:assert/strict";
import { matchByName, removeNamed, type Named } from "../lib/voice-match.ts";
import { parseSpokenEntry } from "../lib/text-parse.ts";

const contas: Named[] = [
  { id: "h", name: "Conta MEI Helbert", kind: "mei" },
  { id: "m", name: "Conta MEI Mateus", kind: "mei" },
  { id: "n", name: "Nubank Porto Drones", kind: "empresa" },
  { id: "c", name: "Caixa (dinheiro)", kind: "caixa" },
];
const forn: Named[] = [
  { id: "p1", name: "Posto Ipiranga" },
  { id: "p2", name: "Posto Shell" },
  { id: "a", name: "Agro Peças Palmas" },
];

test("reconhece a conta pelo nome da pessoa", () => {
  assert.equal(matchByName("paguei 150 de diesel pela conta do Mateus", contas).item?.id, "m");
  assert.equal(matchByName("gastei 80 reais no almoço, conta do Helbert", contas).item?.id, "h");
});

test("aceita erro do reconhecimento de voz (Matheus, Elbert, nu bank)", () => {
  assert.equal(matchByName("paguei pela conta do Matheus", contas).item?.id, "m");
  assert.equal(matchByName("paguei pelo nu bank", contas).item?.id, "n");
  assert.equal(matchByName("paguei no dinheiro", contas).item?.id, "c");
});

test("em dúvida não escolhe: só 'MEI' empata entre as duas contas", () => {
  const r = matchByName("paguei 150 pela conta mei", contas);
  assert.equal(r.item, null);
  assert.deepEqual(r.candidates.map((c) => c.id).sort(), ["h", "m"]);
});

test("nada parecido: não escolhe", () => {
  assert.equal(matchByName("paguei 150 de diesel", contas).item, null);
});

test("fornecedor: 'posto' sozinho não decide; o nome decide", () => {
  assert.equal(matchByName("diesel no posto", forn, { minRatio: 0.6 }).item, null);
  assert.equal(matchByName("diesel no posto Ipiranga", forn, { minRatio: 0.6 }).item?.id, "p1");
  assert.equal(matchByName("comprei helice na agro pecas", forn, { minRatio: 0.6 }).item?.id, "a");
});

test("tira da descrição o trecho que só indicava a conta", () => {
  const r = parseSpokenEntry("paguei 150 reais de diesel pela conta do Mateus", "2026-11-11");
  const m = matchByName("paguei 150 reais de diesel pela conta do Mateus", contas);
  assert.equal(removeNamed(r.description, m.words), "Diesel");
  assert.equal(removeNamed("Almoço pelo Nubank", ["nubank"]), "Almoço");
});

test("frases completas: valor, conta e categoria juntos", () => {
  const t = "gastei oitenta reais de almoço pelo Nubank ontem";
  const r = parseSpokenEntry(t, "2026-11-11");
  assert.equal(r.amount, 80);
  assert.equal(r.category, "Alimentação");
  assert.equal(r.date, "2026-11-10");
  assert.equal(matchByName(t, contas).item?.id, "n");
});

test("valor falado com centavos em dígitos", () => {
  const v = (s: string) => parseSpokenEntry(s, "2026-11-11").amount;
  assert.equal(v("paguei 150 e 50 de combustível"), 150.5);
  assert.equal(v("paguei 89 reais e 90 centavos de almoço"), 89.9);
  assert.equal(v("paguei 89 reais e 90 de almoço"), 89.9);
  assert.equal(v("paguei 89 e 90 centavos"), 89.9);
  assert.equal(v("paguei cento e vinte litros de diesel por 700 reais"), 700);
  assert.equal(v("paguei 150 reais dia 10 e 15"), 150);
});
