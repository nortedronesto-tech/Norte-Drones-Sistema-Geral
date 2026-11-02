import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { jsPDF } from "jspdf";
import { drawOsPdf, osFileName } from "../lib/os-pdf.ts";
import type { OsData } from "../lib/os.ts";

const data: OsData = {
  number: 12, client: "Fazenda Boa Vista", farm: "Talhão 3 — pivô norte", date: "2026-11-02", areaHa: 40, pricePerHa: 95,
  crop: "Soja", target: "Ferrugem asiática", drone: "DJI T50", operator: "João da Silva", rateLHa: 10, tankL: 40,
  products: [
    { name: "Produto A (exemplo)", dose: 0.5, unit: "L/ha", form: "emulsao" },
    { name: "Produto B (exemplo)", dose: 150, unit: "g/ha", form: "pre-diluir" },
  ],
  windKmh: 6, tempC: 28, humidityPct: 65, notes: "Aplicação sem vento forte; talhão vizinho com apicultura avisada.",
};

test("nome do arquivo sem acento e sem símbolos", () => {
  assert.equal(osFileName(12, "Fazenda Boa Vista"), "OS-12-Fazenda-Boa-Vista.pdf");
  assert.equal(osFileName(7, "Sítio São José & Filhos"), "OS-7-Sitio-Sao-Jose-Filhos.pdf");
  assert.equal(osFileName(3, "###"), "OS-3.pdf");
});

test("gera PDF válido com e sem valores, e com muitos produtos (várias páginas)", () => {
  const logo = readFileSync(new URL("../public/brand/logo-horizontal-light.png", import.meta.url));
  const logoOpt = { dataUrl: `data:image/png;base64,${logo.toString("base64")}`, width: 1483, height: 484 };
  const out = process.env.PDF_OUT_DIR;
  if (out) mkdirSync(out, { recursive: true });

  const a = new jsPDF({ unit: "mm", format: "a4" });
  drawOsPdf(a, data, { includePrice: true, logo: logoOpt, contacts: { phone: "(63) 99224-4254", email: "nortedronesto@gmail.com", instagram: "@nortedronespulverizacao" } });
  const bytesA = Buffer.from(a.output("arraybuffer"));
  assert.equal(bytesA.subarray(0, 5).toString(), "%PDF-");
  assert.equal(a.getNumberOfPages(), 1);
  if (out) writeFileSync(`${out}/os-com-valor.pdf`, bytesA);

  const b = new jsPDF({ unit: "mm", format: "a4" });
  drawOsPdf(b, { ...data, products: Array.from({ length: 30 }, (_, i) => ({ name: `Produto ${i + 1} (exemplo)`, dose: i + 1, unit: "mL/ha" as const, form: "solucao" as const })) }, { includePrice: false, logo: logoOpt });
  assert.ok(b.getNumberOfPages() >= 2);
  if (out) writeFileSync(`${out}/os-sem-valor-longa.pdf`, Buffer.from(b.output("arraybuffer")));
});
