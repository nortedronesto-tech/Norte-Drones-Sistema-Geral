/**
 * Formata um telefone brasileiro enquanto a pessoa digita, só com os
 * dígitos — (DD) DDDDD-DDDD pra celular (11 dígitos) ou (DD) DDDD-DDDD
 * pra fixo (10 dígitos). Os parênteses/traço são só visuais: o QR code
 * usa `buildWhatsAppLinkClient`, que já extrai só os dígitos antes de
 * montar o link, então a formatação nunca muda o número real.
 */
export function formatPhoneBR(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
