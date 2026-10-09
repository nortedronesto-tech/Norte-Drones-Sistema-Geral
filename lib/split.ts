// Espelho em TypeScript da regra de rateio do banco (apply_income_split), usado
// apenas para PRÉ-VISUALIZAR na tela. A fonte da verdade é o trigger no Postgres.

/** Distribui `total` centavos entre pesos pelo método do maior resto. */
export function allocateCents(total: number, weights: number[]): number[] {
  const wsum = weights.reduce((a, b) => a + b, 0);
  if (!weights.length || wsum === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / wsum);
  const res = raw.map(Math.floor);
  const frac = raw.map((r, i) => r - res[i]);
  let rem = total - res.reduce((a, b) => a + b, 0);
  while (rem > 0) {
    let best = 0;
    for (let i = 1; i < frac.length; i++) if (frac[i] > frac[best]) best = i;
    res[best] += 1;
    frac[best] = -1;
    rem -= 1;
  }
  return res;
}

export interface SplitPreview {
  reserve: number;
  distributable: number;
  partners: { id: string; name: string; share: number; pct: number; reserve: number }[];
}

export function previewSplit(
  amount: number,
  reservePct: number,
  partners: { id: string; name: string; share_pct: number; created_at: string }[],
): SplitPreview {
  // Mesma ordenação do banco (share_pct desc, created_at, id): é ela que decide
  // quem recebe o centavo que sobra quando a divisão não é exata.
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const sorted = [...partners].sort(
    (a, b) => b.share_pct - a.share_pct || cmp(a.created_at, b.created_at) || cmp(a.id, b.id),
  );
  const weights = sorted.map((p) => p.share_pct);
  const totalC = Math.round(amount * 100);
  const reserveC = Math.round((totalC * reservePct) / 100);
  const distC = totalC - reserveC;
  const resAlloc = allocateCents(reserveC, weights);
  const distAlloc = allocateCents(distC, weights);
  return {
    reserve: reserveC / 100,
    distributable: distC / 100,
    partners: sorted.map((p, i) => ({
      id: p.id,
      name: p.name,
      pct: p.share_pct,
      share: distAlloc[i] / 100,
      reserve: resAlloc[i] / 100,
    })),
  };
}
