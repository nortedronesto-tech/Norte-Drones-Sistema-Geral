import test from "node:test";
import assert from "node:assert/strict";
import { buildReminder, type DueRow } from "../lib/reminder.ts";

const row = (o: Partial<DueRow>): DueRow => ({ type: "saida", status: "a_pagar", amount: 100, date: "2026-11-05", description: null, category: "Outros", ...o });
const TODAY = "2026-11-05";

test("separa atrasadas, de hoje e dos próximos 3 dias; ignora o resto e o que já foi pago", () => {
  const r = buildReminder([
    row({ date: "2026-11-01", description: "Aluguel do carro", amount: 1500 }),
    row({ date: "2026-11-05", description: "DAS" }),
    row({ date: "2026-11-08" }),
    row({ date: "2026-11-09" }), // fora da janela
    row({ date: "2026-11-02", status: "pago" }), // já pago
    row({ type: "entrada", status: "a_receber", date: "2026-11-04", description: "Fazenda Boa Vista", amount: 3800 }),
  ], TODAY);
  assert.deepEqual(r.counts, { overdue: 2, today: 1, soon: 1 });
  assert.equal(r.pay.overdue.length, 1);
  assert.equal(r.receive.overdue.length, 1);
  assert.equal(r.hasAny, true);
  assert.match(r.subject, /2 atrasada\(s\), 1 vence\(m\) hoje, 1 nos próximos 3 dias/);
  assert.match(r.text, /A PAGAR — atrasadas\n• 01\/11 · Aluguel do carro · R\$\s?1\.500,00/);
  assert.match(r.text, /A RECEBER — atrasadas\n• 04\/11 · Fazenda Boa Vista/);
});

test("nada a avisar quando só há contas distantes ou pagas", () => {
  const r = buildReminder([row({ date: "2026-12-20" }), row({ date: "2026-11-01", status: "pago" })], TODAY);
  assert.equal(r.hasAny, false);
  assert.equal(r.text, "");
});

test("ordena por data e protege o HTML do e-mail", () => {
  const r = buildReminder([row({ date: "2026-11-03", description: "<b>B</b> & Cia" }), row({ date: "2026-11-01", description: "A" })], TODAY);
  assert.ok(r.text.indexOf("• 01/11 · A") < r.text.indexOf("• 03/11"));
  assert.match(r.html, /&lt;b&gt;B&lt;\/b&gt; &amp; Cia/);
  assert.doesNotMatch(r.html, /<b>B<\/b>/);
});
