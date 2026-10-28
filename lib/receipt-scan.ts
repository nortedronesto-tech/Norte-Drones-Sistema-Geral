export type ScanResult = {
  tipo: "saida" | "entrada" | null;
  amount: number | null;
  date: string | null;
  description: string | null;
  category: string | null;
  /** qual IA leu a nota (ex.: "Google Gemini") */
  provider?: string;
};

/** Versão pequena da foto (1400 px, JPEG) só para a leitura automática: rápida no 4G e barata. */
async function toScanDataUrl(file: File): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    // navegador não decodificou (ex.: HEIC): tenta mandar o original se for um formato aceito
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      throw new Error("Não consegui abrir essa foto (formato não suportado). Tire de novo pelo botão “Tirar foto” ou escolha um JPG/PNG.");
    }
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("Não consegui abrir essa foto. Tire de novo ou escolha outra em JPG/PNG."));
      r.readAsDataURL(file);
    });
  }
}

/** Pede ao servidor para ler a nota. Lança Error com mensagem pronta para mostrar. */
export async function scanReceipt(file: File): Promise<ScanResult> {
  const image = await toScanDataUrl(file);
  const res = await fetch("/api/gestao/receipt-scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: ScanResult; provider?: string; error?: string };
  if (!res.ok || !json.data) throw new Error(json.error ?? "Não foi possível ler a nota.");
  return { ...json.data, provider: json.provider };
}
