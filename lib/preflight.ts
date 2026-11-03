// Checklist rápido de pré-voo — um toque por item, registrado na OS. Puro e testado em tests/preflight.test.ts.

export const PREFLIGHT_ITEMS = [
  { id: "epi", label: "EPI completo (luvas, máscara, óculos, avental, botas)" },
  { id: "bateria", label: "Baterias carregadas e sem danos" },
  { id: "helices", label: "Hélices e fixações conferidas" },
  { id: "tanque", label: "Tanque, mangueiras e bicos sem vazamento nem entupimento" },
  { id: "filtros", label: "Filtros limpos" },
  { id: "area", label: "Área livre de pessoas, animais e colmeias; distâncias de casas e água respeitadas" },
  { id: "clima", label: "Clima conferido (vento, temperatura, umidade, chuva)" },
  { id: "receita", label: "Receituário e produtos separados e conferidos" },
] as const;

export type PreflightCheck = { id: string; ok: boolean };

export function preflightSummary(checks: PreflightCheck[] | null | undefined): { done: number; total: number; complete: boolean; missing: string[] } {
  const done = new Set((checks ?? []).filter((c) => c.ok).map((c) => c.id));
  const known = PREFLIGHT_ITEMS.filter((i) => done.has(i.id));
  const missing = PREFLIGHT_ITEMS.filter((i) => !done.has(i.id)).map((i) => i.label);
  return { done: known.length, total: PREFLIGHT_ITEMS.length, complete: known.length === PREFLIGHT_ITEMS.length, missing };
}

/** Só guarda o que foi marcado (lista vazia vira null: a OS não ganha coluna à toa). */
export function toStored(done: Set<string>): PreflightCheck[] | null {
  const list = PREFLIGHT_ITEMS.filter((i) => done.has(i.id)).map((i) => ({ id: i.id, ok: true }));
  return list.length ? list : null;
}

// ---- Checklist do dia: fica guardado no aparelho e zera no dia seguinte.
export type KV = { getItem(k: string): string | null; setItem(k: string, v: string): void };
export const PREFLIGHT_DAY_KEY = "norte:prevoo:v1";

export function loadDayChecks(kv: KV, today: string): Set<string> {
  try {
    const saved = JSON.parse(kv.getItem(PREFLIGHT_DAY_KEY) ?? "null") as { day?: string; ids?: unknown } | null;
    if (!saved || saved.day !== today || !Array.isArray(saved.ids)) return new Set();
    const valid = new Set<string>(PREFLIGHT_ITEMS.map((i) => i.id));
    return new Set((saved.ids as unknown[]).filter((x): x is string => typeof x === "string" && valid.has(x)));
  } catch {
    return new Set();
  }
}

export function saveDayChecks(kv: KV, today: string, ids: Set<string>) {
  kv.setItem(PREFLIGHT_DAY_KEY, JSON.stringify({ day: today, ids: [...ids] }));
}
