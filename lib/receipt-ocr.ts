import { parseReceiptText } from "@/lib/receipt-parse";
import { todayBR } from "@/lib/format";
import type { ScanResult } from "@/lib/receipt-scan";

/** Foto em tons de cinza, com contraste e tamanho bom para o OCR (cupom térmico é claro e fino). */
async function preprocess(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(2.2, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  // cinza + esticar o contraste (ignora 2% mais escuros/claros)
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    d[i] = d[i + 1] = d[i + 2] = g;
    hist[g]++;
  }
  const total = canvas.width * canvas.height;
  let lo = 0, hi = 255, acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > total * 0.02) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > total * 0.02) { hi = v; break; } }
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / range));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Lê a nota NO PRÓPRIO APARELHO (OCR Tesseract, português). Sem IA, sem chave, sem cota; a foto não sai do aparelho.
 * Demora alguns segundos e baixa o motor de leitura na primeira vez. Menos precisa que a IA: o usuário confere.
 */
export async function ocrReceipt(file: File, onStatus?: (s: string) => void): Promise<ScanResult & { rawText: string }> {
  onStatus?.("Preparando a foto…");
  const canvas = await preprocess(file);
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("por", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onStatus?.(`Lendo a foto no aparelho… ${Math.round(m.progress * 100)}%`);
      else if (/loading|initializ/.test(m.status)) onStatus?.("Baixando o leitor de notas (só na primeira vez)…");
    },
  });
  try {
    const { data } = await worker.recognize(canvas);
    const text = data.text ?? "";
    if (text.replace(/\s/g, "").length < 12) throw new Error("Não consegui ler texto nessa foto. Tente com mais luz, a nota esticada e inteira no quadro.");
    return { ...parseReceiptText(text, todayBR()), rawText: text, provider: "leitura no aparelho (sem IA)" };
  } finally {
    await worker.terminate();
  }
}
