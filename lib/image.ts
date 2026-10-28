import { isHeicBytes, looksHeicByName } from "@/lib/heic";

/**
 * Foto do iPhone (HEIC) → JPEG no próprio navegador. O Chrome/Firefox não abrem HEIC, e muita
 * foto chega como ".jpeg" mas é HEIC por dentro, por isso olhamos o conteúdo, não só o nome.
 * Qualquer outro formato volta sem mudança. A biblioteca (pesada) só é baixada quando precisa.
 */
export async function normalizeImageFile(file: File): Promise<File> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!looksHeicByName(file.name, file.type) && !isHeicBytes(head)) return file;
  try {
    const { default: heic2any } = await import("heic2any");
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
    const blob = Array.isArray(out) ? out[0] : out;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    throw new Error("Não consegui converter essa foto do iPhone (HEIC). Tire a foto de novo pelo botão “Tirar foto” ou envie como JPG.");
  }
}

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
