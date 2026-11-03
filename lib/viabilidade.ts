// Viabilidade do serviço de aplicação (custo por hectare, ponto de equilíbrio, preço mínimo) — PURAS, testadas em tests/viabilidade.test.ts.

export type Premissas = {
  /** preço cobrado por hectare (R$) */
  precoHa: number;
  /** hectares aplicados por dia de trabalho */
  haDia: number;
  /** dias de trabalho por mês */
  diasMes: number;
  /** equipamentos: drone(s), baterias, gerador, carregador… (R$) */
  investimento: number;
  /** vida útil do equipamento, em anos */
  vidaAnos: number;
  /** quanto do investimento ainda vale no fim da vida útil (%) */
  residualPct: number;
  /** custos que existem mesmo sem voar: veículo, seguro, DAS, internet, contador (R$/mês) */
  fixosMes: number;
  /** custos de cada dia de campo: ajudante, deslocamento, alimentação, hospedagem (R$/dia) */
  custoDia: number;
  /** desgaste das baterias (R$/ha) */
  bateriaHa: number;
  /** manutenção e peças (R$/ha) */
  manutencaoHa: number;
  /** combustível do gerador/carregador (R$/ha) */
  geradorHa: number;
  /** imposto sobre a receita, se houver (%) */
  impostoPct: number;
  /** margem de lucro que você quer (% da receita) */
  margemAlvoPct: number;
};

export type Resultado = {
  haMes: number;
  receitaMes: number;
  depreciacaoMes: number;
  /** fixos do mês + depreciação */
  fixosTotalMes: number;
  /** o que cada hectare custa por dia de campo (ajudante etc. ÷ ha/dia) */
  diaHa: number;
  impostoHa: number;
  /** custo que cresce com o hectare: dia de campo + bateria + manutenção + gerador + imposto */
  variavelHa: number;
  /** parte dos custos fixos que cada hectare carrega neste volume */
  fixoHa: number;
  custoHa: number;
  /** quanto sobra em cada hectare */
  lucroHa: number;
  resultadoMes: number;
  /** lucro ÷ receita, em % (null se não há receita) */
  margemPct: number | null;
  /** hectares por mês para cobrir todos os custos (null se cada ha já dá prejuízo) */
  equilibrioHa: number | null;
  /** preço por ha que zera o resultado no volume previsto */
  precoMinimo: number | null;
  /** preço por ha que dá a margem desejada no volume previsto */
  precoAlvo: number | null;
  /** meses para o resultado pagar o investimento (null se não paga) */
  paybackMeses: number | null;
  nivel: "bom" | "apertado" | "ruim";
};

export const PREMISSAS_PADRAO: Premissas = {
  precoHa: 100, haDia: 60, diasMes: 8,
  investimento: 180000, vidaAnos: 5, residualPct: 30,
  fixosMes: 4000, custoDia: 400,
  bateriaHa: 2, manutencaoHa: 2, geradorHa: 1.5,
  impostoPct: 0, margemAlvoPct: 30,
};

const r2 = (n: number) => Math.round(n * 100) / 100;
/** para cima, ao centavo: o preço mínimo nunca fica um tiquinho abaixo do necessário */
const up2 = (n: number) => Math.ceil(n * 100 - 1e-9) / 100;
const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/** Contas completas do simulador. Valores inválidos/negativos viram 0, e nunca devolve NaN. */
export function calcViabilidade(p: Premissas): Resultado {
  const preco = pos(p.precoHa), haDia = pos(p.haDia), dias = pos(p.diasMes);
  const imp = Math.min(pos(p.impostoPct), 100) / 100;
  const haMes = haDia * dias;
  const receitaMes = haMes * preco;

  const meses = Math.max(pos(p.vidaAnos), 0.1) * 12;
  const depreciacaoMes = pos(p.investimento) * (1 - Math.min(pos(p.residualPct), 100) / 100) / meses;
  const fixosTotalMes = pos(p.fixosMes) + depreciacaoMes;

  const diaHa = haDia > 0 ? pos(p.custoDia) / haDia : 0;
  const impostoHa = preco * imp;
  const variavelHa = diaHa + pos(p.bateriaHa) + pos(p.manutencaoHa) + pos(p.geradorHa) + impostoHa;
  const fixoHa = haMes > 0 ? fixosTotalMes / haMes : 0;
  const custoHa = variavelHa + fixoHa;
  const lucroHa = preco - custoHa;
  const resultadoMes = receitaMes - (variavelHa * haMes + fixosTotalMes);
  const margemPct = receitaMes > 0 ? r2((resultadoMes / receitaMes) * 100) : null;

  // margem de contribuição por ha (preço − custos que variam com o ha)
  const contribuicao = preco - variavelHa;
  const equilibrioHa = contribuicao > 0 ? Math.ceil(fixosTotalMes / contribuicao) : null;

  // preço que zera / dá a margem alvo no volume previsto (o imposto cresce com o preço)
  const semImposto = diaHa + pos(p.bateriaHa) + pos(p.manutencaoHa) + pos(p.geradorHa) + fixoHa;
  const alvo = Math.min(pos(p.margemAlvoPct), 99) / 100;
  const precoMinimo = haMes > 0 && 1 - imp > 0 ? up2(semImposto / (1 - imp)) : null;
  const precoAlvo = haMes > 0 && 1 - imp - alvo > 0 ? up2(semImposto / (1 - imp - alvo)) : null;

  const paybackMeses = resultadoMes > 0 ? Math.ceil(pos(p.investimento) / resultadoMes) : null;
  const nivel: Resultado["nivel"] = margemPct === null || margemPct < 10 ? "ruim" : margemPct < 25 ? "apertado" : "bom";

  return {
    haMes, receitaMes: r2(receitaMes), depreciacaoMes: r2(depreciacaoMes), fixosTotalMes: r2(fixosTotalMes),
    diaHa: r2(diaHa), impostoHa: r2(impostoHa), variavelHa: r2(variavelHa), fixoHa: r2(fixoHa), custoHa: r2(custoHa),
    lucroHa: r2(lucroHa), resultadoMes: r2(resultadoMes), margemPct, equilibrioHa, precoMinimo, precoAlvo, paybackMeses, nivel,
  };
}

/** Quadro "e se?": resultado mensal para variações de preço e de volume (cada célula refaz a conta inteira). */
export function sensibilidade(p: Premissas, precoPassos = [-20, -10, 0, 10, 20], volumePct = [-50, -25, 0, 25, 50]) {
  const colunas = volumePct.map((v) => ({ pct: v, haMes: Math.max(0, Math.round(pos(p.haDia) * pos(p.diasMes) * (1 + v / 100))) }));
  const linhas = precoPassos.map((d) => {
    const preco = Math.max(0, pos(p.precoHa) + d);
    return {
      preco,
      celulas: colunas.map((c) => {
        const dias = pos(p.haDia) > 0 ? c.haMes / pos(p.haDia) : 0;
        return calcViabilidade({ ...p, precoHa: preco, diasMes: dias }).resultadoMes;
      }),
    };
  });
  return { colunas, linhas };
}

// ---------- o que já aconteceu de verdade (OS concluídas + despesas pagas) ----------

export type RealEntrada = {
  /** hectares das OS concluídas no período */
  ha: number;
  /** valor das OS concluídas no período (R$) */
  receitaOS: number;
  /** despesas pagas no período, por categoria */
  despesas: { category: string; amount: number }[];
  /** quantos meses o período cobre */
  meses: number;
};

export type RealResultado = {
  ha: number;
  haMes: number;
  precoMedio: number | null;
  totalDespesas: number;
  custoHa: number | null;
  lucroHa: number | null;
  resultado: number;
  margemPct: number | null;
  porCategoria: { category: string; amount: number; porHa: number | null; pct: number }[];
};

export function calcReal(e: RealEntrada): RealResultado {
  const ha = pos(e.ha);
  const total = r2(e.despesas.reduce((s, d) => s + pos(d.amount), 0));
  const m = new Map<string, number>();
  for (const d of e.despesas) m.set(d.category, (m.get(d.category) ?? 0) + pos(d.amount));
  const porCategoria = [...m.entries()].sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({
    category, amount: r2(amount), porHa: ha > 0 ? r2(amount / ha) : null, pct: total > 0 ? r2((amount / total) * 100) : 0,
  }));
  const receita = pos(e.receitaOS);
  const resultado = r2(receita - total);
  const precoMedio = ha > 0 ? r2(receita / ha) : null;
  const custoHa = ha > 0 ? r2(total / ha) : null;
  return {
    ha, haMes: e.meses > 0 ? r2(ha / e.meses) : 0, precoMedio, totalDespesas: total, custoHa,
    lucroHa: precoMedio !== null && custoHa !== null ? r2(precoMedio - custoHa) : null,
    resultado, margemPct: receita > 0 ? r2((resultado / receita) * 100) : null, porCategoria,
  };
}
