// Vários anexos num lançamento: os caminhos ficam juntos na coluna receipt_path, separados por "|".
// (um caminho só continua sendo só o caminho; "|" nunca aparece num caminho válido). PURO, testado.

export const MAX_ANEXOS = 10;

export function receiptList(value: string | null | undefined): string[] {
  return (value ?? "").split("|").map((s) => s.trim()).filter(Boolean);
}

export function receiptJoin(paths: string[]): string | null {
  const uniq = [...new Set(paths.map((s) => s.trim()).filter(Boolean))];
  return uniq.length ? uniq.join("|") : null;
}

/** Junta um caminho novo aos que já existem. Repetido não duplica (reenvio da fila). */
export function addReceipt(current: string | null | undefined, path: string): string | null {
  return receiptJoin([...receiptList(current), path]);
}
