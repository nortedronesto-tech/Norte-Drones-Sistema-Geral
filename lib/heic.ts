// Detecção PURA de fotos HEIC/HEIF (formato padrão do iPhone). Separada para poder ser testada.
// Muitas fotos chegam como "IMG_1234.jpeg" mas com conteúdo HEIC, então o nome não basta:
// olhamos o cabeçalho do arquivo (bytes 4–7 = "ftyp", bytes 8–11 = marca do formato).

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"]);

export function isHeicBytes(head: Uint8Array): boolean {
  if (head.length < 12) return false;
  const text = (from: number, to: number) => String.fromCharCode(...head.slice(from, to));
  return text(4, 8) === "ftyp" && HEIC_BRANDS.has(text(8, 12).toLowerCase());
}

export function looksHeicByName(name: string, type: string): boolean {
  return /\.(heic|heif)$/i.test(name) || /image\/hei[cf]/i.test(type);
}
