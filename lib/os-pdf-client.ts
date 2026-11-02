// Gera o PDF da OS no navegador (sem servidor) e entrega como arquivo, pronto para compartilhar.
import { drawOsPdf, osFileName, type PdfContacts, type PdfLogo } from "./os-pdf.ts";
import type { OsData } from "./os.ts";

let logoPromise: Promise<PdfLogo | undefined> | null = null;

/** Logo reduzida (900 px, JPEG sobre fundo branco) para o PDF ficar leve; sem logo se falhar. */
function loadLogo(): Promise<PdfLogo | undefined> {
  logoPromise ??= (async () => {
    try {
      const res = await fetch("/brand/logo-horizontal-light.png");
      if (!res.ok) return undefined;
      const bmp = await createImageBitmap(await res.blob());
      const width = 900;
      const height = Math.round((bmp.height * width) / bmp.width);
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return undefined;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bmp, 0, 0, width, height);
      return { dataUrl: canvas.toDataURL("image/jpeg", 0.9), width, height, format: "JPEG" as const };
    } catch { return undefined; }
  })();
  return logoPromise;
}

export async function makeOsPdf(data: OsData, opts: { includePrice: boolean; contacts?: PdfContacts }): Promise<File> {
  const [{ jsPDF }, logo] = await Promise.all([import("jspdf"), loadLogo()]);
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.setProperties({ title: `OS nº ${data.number} — ${data.client}`, author: "Norte Drones", creator: "Norte Drones" });
  drawOsPdf(doc, data, { ...opts, logo });
  return new File([doc.output("blob")], osFileName(data.number, data.client), { type: "application/pdf" });
}

/** Só dígitos, com DDI 55 quando vier DDD+número (10 ou 11 dígitos). */
export function whatsappDigits(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d.length >= 12 && d.length <= 15 ? d : null;
}
