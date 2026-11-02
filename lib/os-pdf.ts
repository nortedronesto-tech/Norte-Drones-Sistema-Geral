// PDF da ordem de serviço para o cliente (A4, com logo). O desenho é independente de ambiente
// (recebe uma instância do jsPDF), então roda igual no navegador e nos testes em Node.
import type { jsPDF } from "jspdf";
import { osCalda, osTotal, type OsData } from "./os.ts";

export type PdfContacts = { phone?: string; email?: string; instagram?: string; address?: string };
export type PdfLogo = { dataUrl: string; width: number; height: number; format?: "PNG" | "JPEG" };
export type OsPdfOptions = { includePrice: boolean; contacts?: PdfContacts; logo?: PdfLogo };

const GREEN: [number, number, number] = [18, 63, 36];
const GOLD: [number, number, number] = [198, 163, 90];
const INK: [number, number, number] = [31, 43, 36];
const MUTED: [number, number, number] = [110, 118, 112];
const MIST: [number, number, number] = [244, 241, 232];

const M = 16; // margem
const W = 210;
const BOTTOM = 270; // limite do conteúdo (rodapé abaixo)

const num = (v: number, d = 2) => v.toLocaleString("pt-BR", { maximumFractionDigits: d });
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brDate = (iso: string) => iso.split("-").reverse().join("/");

/** Nome de arquivo seguro: "OS-12-Fazenda-Boa-Vista.pdf". */
export function osFileName(number: number, client: string): string {
  const slug = client.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return `OS-${number}${slug ? `-${slug}` : ""}.pdf`;
}

export function drawOsPdf(doc: jsPDF, o: OsData, opts: OsPdfOptions): void {
  let y = 0;

  const header = () => {
    if (opts.logo) {
      const h = 19;
      const w = (h * opts.logo.width) / opts.logo.height;
      doc.addImage(opts.logo.dataUrl, opts.logo.format ?? "PNG", M - 2, 10, w, h);
    } else {
      doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(...GREEN).text("NORTE DRONES", M, 22);
    }
    doc.setTextColor(...GREEN).setFont("helvetica", "bold").setFontSize(10).text("RELATÓRIO DE APLICAÇÃO", W - M, 15, { align: "right" });
    doc.setFontSize(22).text(`OS nº ${o.number}`, W - M, 25, { align: "right" });
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED).text(brDate(o.date), W - M, 31, { align: "right" });
    doc.setDrawColor(...GOLD).setLineWidth(0.8).line(M, 36, W - M, 36);
    y = 44;
  };

  const ensure = (h: number) => {
    if (y + h > BOTTOM) { doc.addPage(); header(); }
  };

  const title = (t: string) => {
    ensure(14);
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...GREEN).text(t.toUpperCase(), M, y);
    doc.setDrawColor(...GOLD).setLineWidth(0.5).line(M, y + 1.8, M + 12, y + 1.8);
    y += 8;
  };

  /** Pares rótulo/valor em duas colunas. */
  const pairs = (items: [string, string | null | undefined][]) => {
    const list = items.filter(([, v]) => v);
    const colW = (W - 2 * M) / 2;
    for (let i = 0; i < list.length; i += 2) {
      ensure(12);
      for (let c = 0; c < 2; c++) {
        const it = list[i + c];
        if (!it) continue;
        const x = M + c * colW;
        doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED).text(it[0], x, y);
        doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...INK);
        const lines = doc.splitTextToSize(it[1] as string, colW - 6).slice(0, 2) as string[];
        doc.text(lines, x, y + 5);
      }
      y += 12;
    }
    y += 2;
  };

  header();

  // Cliente e área em destaque
  doc.setFillColor(...MIST).roundedRect(M, y, W - 2 * M, 30, 2.5, 2.5, "F");
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED).text("CLIENTE", M + 6, y + 7);
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...GREEN).text(doc.splitTextToSize(o.client, 105)[0] as string, M + 6, y + 15);
  if (o.farm) doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...INK).text(doc.splitTextToSize(o.farm, 105)[0] as string, M + 6, y + 22);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED).text("ÁREA APLICADA", W - M - 6, y + 7, { align: "right" });
  doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(...GREEN).text(`${num(o.areaHa)} ha`, W - M - 6, y + 19, { align: "right" });
  y += 40;

  const clima = [o.windKmh != null && `vento ${num(o.windKmh, 1)} km/h`, o.tempC != null && `${num(o.tempC, 1)} °C`, o.humidityPct != null && `umidade ${num(o.humidityPct, 0)}%`].filter(Boolean).join("  ·  ");
  title("Dados da aplicação");
  pairs([["Data do serviço", brDate(o.date)], ["Cultura", o.crop], ["Alvo / praga", o.target], ["Drone", o.drone], ["Operador", o.operator], ["Condições do tempo", clima || null]]);
  y += 4;

  if (o.products.length > 0) {
    title("Produtos aplicados (conforme receituário)");
    const rowH = 7.5;
    ensure(rowH * 2);
    doc.setFillColor(...GREEN).rect(M, y - 5, W - 2 * M, rowH, "F");
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(255, 255, 255).text("Produto", M + 3, y);
    doc.text("Dose", W - M - 3, y, { align: "right" });
    y += rowH;
    o.products.forEach((p, i) => {
      ensure(rowH + 2);
      if (i % 2 === 0) doc.setFillColor(...MIST).rect(M, y - 5, W - 2 * M, rowH, "F");
      doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...INK).text(doc.splitTextToSize(p.name, 120)[0] as string, M + 3, y);
      doc.setFont("helvetica", "bold").text(`${num(p.dose, 3)} ${p.unit}`, W - M - 3, y, { align: "right" });
      y += rowH;
    });
    const c = osCalda(o);
    if (c) {
      y += 1;
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED)
        .text(`Calda: ${num(o.rateLHa ?? 0)} L/ha  ·  tanque de ${num(o.tankL ?? 0)} L  ·  ${c.result.tankCount} tanque(s)`, M, y);
      y += 5;
    }
    y += 5;
  }

  if (opts.includePrice) {
    ensure(28);
    title("Valor do serviço");
    doc.setFillColor(...GREEN).roundedRect(M, y - 3, W - 2 * M, 20, 2.5, 2.5, "F");
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(255, 255, 255).text(`${num(o.areaHa)} ha  ×  ${brl(o.pricePerHa)} por hectare`, M + 6, y + 8);
    doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(...[217, 190, 130] as [number, number, number]).text(brl(osTotal(o.areaHa, o.pricePerHa)), W - M - 6, y + 9.5, { align: "right" });
    y += 26;
  }

  if (o.notes) {
    title("Observações");
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...INK);
    const lines = doc.splitTextToSize(o.notes, W - 2 * M) as string[];
    for (const l of lines) { ensure(6); doc.text(l, M, y); y += 5; }
    y += 4;
  }

  // Assinaturas
  ensure(34);
  y += 12;
  doc.setDrawColor(...INK).setLineWidth(0.3);
  doc.line(M, y, M + 75, y).line(W - M - 75, y, W - M, y);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
  doc.text(`Operador${o.operator ? ` — ${o.operator}` : ""}`, M, y + 5);
  doc.text(`Cliente — ${o.client}`, W - M - 75, y + 5);

  // Rodapé em todas as páginas
  const pages = doc.getNumberOfPages();
  const c = opts.contacts ?? {};
  const contact = [c.phone, c.email, c.instagram, c.address].filter(Boolean).join("  ·  ");
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...GOLD).setLineWidth(0.5).line(M, 280, W - M, 280);
    doc.setFont("helvetica", "italic").setFontSize(7.5).setTextColor(...MUTED)
      .text("Aplicação realizada conforme receituário agronômico e bula dos produtos.", M, 285);
    if (contact) doc.setFont("helvetica", "normal").text(contact, M, 289.5);
    doc.text(`Página ${p} de ${pages}`, W - M, 289.5, { align: "right" });
  }
}
