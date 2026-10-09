/**
 * Reduz a foto antes do upload: celulares geram 3–8 MB por foto e o sinal no
 * campo é ruim. 1600 px no maior lado e JPEG 80% mantêm recibo/placa legíveis
 * em ~200–400 KB. Se o navegador não conseguir decodificar (ex.: HEIC fora do
 * Safari), devolve o arquivo original sem tocar nele.
 */
export async function compressImage(file: File, maxSide = 1600, quality = 0.8): Promise<{ blob: Blob; ext: string; type: string }> {
  const original = { blob: file as Blob, ext: extOf(file), type: file.type || "application/octet-stream" };
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
    // Se a versão reduzida não for menor (ex.: print pequeno), mantém o original.
    if (!blob || blob.size >= file.size) return original;
    return { blob, ext: "jpg", type: "image/jpeg" };
  } catch {
    return original;
  }
}

function extOf(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  return file.type.split("/")[1] || "jpg";
}
