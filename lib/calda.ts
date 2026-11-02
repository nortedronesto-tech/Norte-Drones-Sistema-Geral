// Cálculo da calda de pulverização por tanque do drone — PURO (sem rede), testado em tests/calda.test.ts.
// O sistema NÃO sugere doses: quem define produto e dose é a bula + o receituário do agrônomo.
// Aqui só se faz a conta (área × dose, dividida em tanques) e se organiza a ordem de mistura.

export type DoseUnit = "L/ha" | "mL/ha" | "kg/ha" | "g/ha";

/** Formulação do produto (aparece no rótulo, em siglas). */
export type Formulation =
  | "pre-diluir" // pós/granulados (WP, WG, SP, SG): pré-diluir antes de ir ao tanque
  | "suspensao" // SC, SE, OD
  | "emulsao" // EC, EW
  | "solucao" // SL e fertilizantes foliares
  | "adjuvante" // óleos, espalhantes, antiespumantes
  | "corretivo"; // acidificante / condicionador de água

export const FORMULATIONS: { id: Formulation; label: string; hint: string }[] = [
  { id: "corretivo", label: "Corretivo de água (acidificante/condicionador)", hint: "ajusta pH/dureza antes de tudo" },
  { id: "pre-diluir", label: "Pó ou granulado (WP, WG, SP, SG)", hint: "pré-diluir em balde" },
  { id: "suspensao", label: "Suspensão (SC, SE, OD)", hint: "líquido leitoso" },
  { id: "emulsao", label: "Emulsão (EC, EW)", hint: "concentrado emulsionável" },
  { id: "solucao", label: "Solução / fertilizante foliar (SL)", hint: "líquido solúvel" },
  { id: "adjuvante", label: "Adjuvante (óleo, espalhante, antiespumante)", hint: "sempre por último" },
];

/** Ordem de mistura padrão (a bula do produto sempre manda mais do que esta regra geral). */
const ORDER: Record<Formulation, number> = { corretivo: 0, "pre-diluir": 1, suspensao: 2, emulsao: 3, solucao: 4, adjuvante: 5 };

export type Product = { name: string; dose: number; unit: DoseUnit; form: Formulation };

const toBase = (dose: number, unit: DoseUnit): { value: number; base: "L" | "kg" } =>
  unit === "L/ha" ? { value: dose, base: "L" }
  : unit === "mL/ha" ? { value: dose / 1000, base: "L" }
  : unit === "kg/ha" ? { value: dose, base: "kg" }
  : { value: dose / 1000, base: "kg" };

/** 0,35 L → "350 mL"; 1,5 kg → "1,5 kg"; 0,08 kg → "80 g". */
export function formatAmount(value: number, base: "L" | "kg"): string {
  const small = base === "L" ? "mL" : "g";
  const num = (n: number, d = 2) => n.toLocaleString("pt-BR", { maximumFractionDigits: d });
  if (value > 0 && value < 1) return `${num(value * 1000, value * 1000 < 10 ? 1 : 0)} ${small}`;
  return `${num(value, value < 10 ? 2 : 1)} ${base}`;
}

export type CaldaInput = { areaHa: number; rateLHa: number; tankL: number; products: Product[] };

export type TankLine = { name: string; form: Formulation; amount: number; base: "L" | "kg"; text: string };
export type Tank = { index: number; ha: number; volumeL: number; waterL: number; lines: TankLine[]; full: boolean };

export type CaldaResult = {
  ok: true;
  totalVolumeL: number;
  haPerFullTank: number;
  tankCount: number;
  fullTanks: number;
  tanks: Tank[];
  totals: { name: string; amount: number; base: "L" | "kg"; text: string }[];
  warnings: string[];
};

const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * Divide a área em tanques: cada tanque cheio cobre (volume do tanque ÷ volume de calda por ha) hectares,
 * e o último pode ser parcial. Produto por tanque = dose × hectares daquele tanque.
 * "Água aproximada" = volume do tanque − produtos líquidos (pós quase não ocupam volume).
 */
export function calcCalda(input: CaldaInput): CaldaResult | { ok: false; error: string } {
  const { areaHa, rateLHa, tankL, products } = input;
  if (!(areaHa > 0)) return { ok: false, error: "Informe a área em hectares." };
  if (!(rateLHa > 0)) return { ok: false, error: "Informe o volume de calda por hectare (L/ha)." };
  if (!(tankL > 0)) return { ok: false, error: "Informe o volume do tanque (L)." };
  if (rateLHa > tankL) return { ok: false, error: "O volume de calda por hectare não pode ser maior que o tanque." };
  const valid = products.filter((p) => p.name.trim() && p.dose > 0);

  const haPerTank = tankL / rateLHa;
  const fullTanks = Math.floor(round(areaHa / haPerTank, 6));
  const rest = round(areaHa - fullTanks * haPerTank, 6);
  const hasPartial = rest > 0.0005;
  const tankCount = fullTanks + (hasPartial ? 1 : 0);

  const order = [...valid].sort((a, b) => ORDER[a.form] - ORDER[b.form]);
  const makeTank = (index: number, ha: number, full: boolean): Tank => {
    const volumeL = full ? tankL : round(ha * rateLHa, 2);
    let liquids = 0;
    const lines = order.map((p) => {
      const b = toBase(p.dose, p.unit);
      const amount = round(b.value * ha, 4);
      if (b.base === "L") liquids += amount;
      return { name: p.name.trim(), form: p.form, amount, base: b.base, text: formatAmount(amount, b.base) };
    });
    return { index, ha: round(ha, 3), volumeL, waterL: round(Math.max(0, volumeL - liquids), 2), lines, full };
  };

  const tanks: Tank[] = [];
  for (let i = 1; i <= fullTanks; i++) tanks.push(makeTank(i, haPerTank, true));
  if (hasPartial) tanks.push(makeTank(tankCount, rest, false));

  const totals = order.map((p) => {
    const b = toBase(p.dose, p.unit);
    const amount = round(b.value * areaHa, 4);
    return { name: p.name.trim(), amount, base: b.base, text: formatAmount(amount, b.base) };
  });

  const warnings: string[] = [];
  if (rateLHa < 5 || rateLHa > 30) warnings.push("Volume de calda fora do usual para drone (em geral 8 a 20 L/ha). Confira a bula e o receituário.");
  if (tankCount > 60) warnings.push("Muitos tanques: confira se a área e o volume do tanque estão certos.");
  const liquidsPerHa = order.reduce((s, p) => { const b = toBase(p.dose, p.unit); return s + (b.base === "L" ? b.value : 0); }, 0);
  if (liquidsPerHa > rateLHa) warnings.push("Os produtos líquidos somam mais que o volume de calda por hectare: confira as doses e as unidades.");
  if (!valid.length) warnings.push("Nenhum produto informado: só foi calculado o volume de calda.");

  return { ok: true, totalVolumeL: round(areaHa * rateLHa, 2), haPerFullTank: round(haPerTank, 3), tankCount, fullTanks, tanks, totals, warnings };
}

/** Texto pronto para copiar/enviar no WhatsApp. */
export function recipeText(title: string, input: CaldaInput, r: Extract<CaldaResult, { ok: true }>): string {
  const n = (x: number, d = 2) => x.toLocaleString("pt-BR", { maximumFractionDigits: d });
  const lines: string[] = [];
  lines.push(`CALDA — ${title || "sem nome"}`);
  lines.push(`Área: ${n(input.areaHa)} ha · Calda: ${n(input.rateLHa)} L/ha · Tanque: ${n(input.tankL)} L`);
  lines.push(`Total de calda: ${n(r.totalVolumeL)} L em ${r.tankCount} tanque(s) (cada tanque cheio cobre ${n(r.haPerFullTank)} ha)`);
  lines.push("");
  const t = r.tanks[0];
  if (t) {
    lines.push(`POR TANQUE CHEIO (${n(t.volumeL)} L):`);
    lines.push(`• Água: ~${n(t.waterL)} L (comece com 70–80% e agitação ligada)`);
    t.lines.forEach((l, i) => lines.push(`${i + 1}º ${l.name}: ${l.text}`));
  }
  const last = r.tanks[r.tanks.length - 1];
  if (last && !last.full) {
    lines.push("");
    lines.push(`ÚLTIMO TANQUE (${n(last.ha, 3)} ha, ${n(last.volumeL)} L):`);
    last.lines.forEach((l) => lines.push(`• ${l.name}: ${l.text}`));
  }
  lines.push("");
  lines.push("Siga a bula e o receituário agronômico. Faça o teste de compatibilidade antes. Use EPI.");
  return lines.join("\n");
}
