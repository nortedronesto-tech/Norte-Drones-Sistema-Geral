"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Card, CardTitle, inputClass, labelClass } from "@/components/ui";
import { formatBRL, parseMoney } from "@/lib/format";
import { calcViabilidade, sensibilidade, PREMISSAS_PADRAO, type Premissas } from "@/lib/viabilidade";

const LS_KEY = "norte:viabilidade:v1";

type Campo = { key: keyof Premissas; label: string; hint?: string; suffix?: string };
const GRUPOS: { titulo: string; campos: Campo[] }[] = [
  { titulo: "Produção e preço", campos: [
    { key: "precoHa", label: "Preço cobrado", suffix: "R$/ha" },
    { key: "haDia", label: "Hectares aplicados por dia", suffix: "ha/dia", hint: "média real, contando deslocamento e troca de bateria" },
    { key: "diasMes", label: "Dias de campo por mês", suffix: "dias" },
  ] },
  { titulo: "Equipamento (investimento)", campos: [
    { key: "investimento", label: "Drone(s), baterias, gerador e carregadores", suffix: "R$" },
    { key: "vidaAnos", label: "Vida útil", suffix: "anos" },
    { key: "residualPct", label: "Valor de revenda no fim", suffix: "%" },
  ] },
  { titulo: "Custos fixos (existem mesmo sem voar)", campos: [
    { key: "fixosMes", label: "Veículo, seguro, DAS, internet, contador…", suffix: "R$/mês" },
  ] },
  { titulo: "Custos de cada dia de campo", campos: [
    { key: "custoDia", label: "Ajudante, deslocamento, alimentação, hospedagem", suffix: "R$/dia" },
  ] },
  { titulo: "Custos que crescem com o hectare", campos: [
    { key: "bateriaHa", label: "Desgaste das baterias", suffix: "R$/ha", hint: "preço do jogo ÷ ciclos de vida ÷ ha por ciclo" },
    { key: "manutencaoHa", label: "Manutenção e peças", suffix: "R$/ha" },
    { key: "geradorHa", label: "Combustível do gerador", suffix: "R$/ha" },
    { key: "impostoPct", label: "Imposto sobre a receita", suffix: "%", hint: "0 se só paga o DAS fixo do MEI" },
  ] },
  { titulo: "Meta", campos: [
    { key: "margemAlvoPct", label: "Margem de lucro desejada", suffix: "% da receita" },
  ] },
];

const num = (n: number) => String(n).replace(".", ",");
const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function ViabilidadeSimulador({ inicial }: { inicial?: Partial<Premissas> }) {
  const [p, setP] = useState<Premissas>({ ...PREMISSAS_PADRAO, ...inicial });
  const [texto, setTexto] = useState<Partial<Record<keyof Premissas, string>>>({});

  // lembra os números neste aparelho (sem banco); se não der, segue com os padrões
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) ?? "null") as Partial<Premissas> | null;
      if (saved && typeof saved === "object") setP((cur) => ({ ...cur, ...saved }));
    } catch { /* sem armazenamento: usa os padrões */ }
  }, []);

  const r = useMemo(() => calcViabilidade(p), [p]);
  const s = useMemo(() => sensibilidade(p), [p]);

  const set = (key: keyof Premissas, raw: string) => {
    setTexto((t) => ({ ...t, [key]: raw }));
    const v = parseMoney(raw);
    setP((cur) => {
      const next = { ...cur, [key]: v === null || v < 0 ? 0 : v };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* ignora */ } // só guarda o que a pessoa mexeu
      return next;
    });
  };
  const reset = () => { setP({ ...PREMISSAS_PADRAO, ...inicial }); setTexto({}); try { localStorage.removeItem(LS_KEY); } catch { /* ignora */ } };

  const tom = r.nivel === "bom" ? "border-brand-green/30 bg-brand-green/5 text-brand-green" : r.nivel === "apertado" ? "border-brand-amber/40 bg-brand-amber/10 text-[#9a5a00]" : "border-danger/30 bg-danger/5 text-danger";
  const veredito = r.nivel === "bom" ? "Viável" : r.nivel === "apertado" ? "Apertado" : "Não fecha a conta";
  const cel = (v: number) => (v < 0 ? "bg-danger/10 text-danger" : v < p.precoHa * r.haMes * 0.1 ? "bg-brand-amber/15 text-[#9a5a00]" : "bg-brand-green/10 text-brand-green");

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Card className="order-2 lg:order-1">
        <CardTitle aside={<button type="button" onClick={reset} className="inline-flex items-center gap-1 text-xs font-bold text-brand-graphite/70 hover:text-brand-dark"><RotateCcw className="size-3.5" aria-hidden /> Voltar ao padrão</button>}>Seus números</CardTitle>
        <p className="mb-4 rounded-xl bg-brand-amber/10 px-3 py-2 text-xs text-[#7a4a00]">Os valores iniciais são só um ponto de partida. Troque pelos seus de verdade; eles ficam salvos neste aparelho.</p>
        <div className="space-y-5">
          {GRUPOS.map((g) => (
            <div key={g.titulo}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-graphite/60">{g.titulo}</h3>
              <div className="space-y-3">
                {g.campos.map((c) => (
                  <div key={c.key}>
                    <label className={labelClass} htmlFor={`v-${c.key}`}>{c.label}</label>
                    <div className="flex items-center gap-2">
                      <input id={`v-${c.key}`} inputMode="decimal" className={inputClass} value={texto[c.key] ?? num(p[c.key])} onChange={(e) => set(c.key, e.target.value)} onBlur={() => setTexto((t) => { const n = { ...t }; delete n[c.key]; return n; })} />
                      <span className="w-20 shrink-0 text-xs font-semibold text-brand-graphite/60">{c.suffix}</span>
                    </div>
                    {c.hint && <p className="mt-1 text-xs text-brand-graphite/55">{c.hint}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="order-1 space-y-4 lg:order-2">
        <section className={`rounded-2xl border p-4 md:p-5 ${tom}`} aria-live="polite">
          <p className="text-xs font-bold uppercase tracking-wide opacity-80">Resultado do simulador</p>
          <p className="mt-1 text-2xl font-extrabold">{veredito}{r.margemPct !== null && <span className="ml-2 text-base font-bold">margem de {String(r.margemPct).replace(".", ",")}%</span>}</p>
          <p className="mt-1 text-sm text-brand-graphite/80">
            Cada hectare custa <b>{formatBRL(r.custoHa)}</b> e você cobra <b>{formatBRL(p.precoHa)}</b>: sobram <b className={r.lucroHa < 0 ? "text-danger" : ""}>{formatBRL(r.lucroHa)}</b> por ha.
          </p>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <Card><p className="text-xs font-semibold text-brand-graphite/60">Resultado no mês</p><p className={`num mt-1 text-lg font-extrabold sm:text-xl ${r.resultadoMes < 0 ? "text-danger" : "text-brand-green"}`}>{formatBRL(r.resultadoMes)}</p><p className="text-xs text-brand-graphite/60">{nf.format(r.haMes)} ha · receita {formatBRL(r.receitaMes)}</p></Card>
          <Card><p className="text-xs font-semibold text-brand-graphite/60">Ponto de equilíbrio</p><p className="num mt-1 text-xl font-extrabold">{r.equilibrioHa === null ? "—" : `${nf.format(r.equilibrioHa)} ha/mês`}</p><p className="text-xs text-brand-graphite/60">{r.equilibrioHa === null ? "preço abaixo do custo por ha" : `${nf.format(Math.ceil(r.equilibrioHa / Math.max(p.haDia, 1)))} ${Math.ceil(r.equilibrioHa / Math.max(p.haDia, 1)) === 1 ? "dia" : "dias"} de campo só para empatar`}</p></Card>
          <Card><p className="text-xs font-semibold text-brand-graphite/60">Preço mínimo</p><p className="num mt-1 text-xl font-extrabold">{r.precoMinimo === null ? "—" : formatBRL(r.precoMinimo)}</p><p className="text-xs text-brand-graphite/60">por ha, para não perder dinheiro</p></Card>
          <Card><p className="text-xs font-semibold text-brand-graphite/60">Preço para {p.margemAlvoPct}% de margem</p><p className="num mt-1 text-xl font-extrabold">{r.precoAlvo === null ? "—" : formatBRL(r.precoAlvo)}</p><p className="text-xs text-brand-graphite/60">por ha</p></Card>
        </div>

        <Card>
          <CardTitle>Para onde vai cada hectare</CardTitle>
          <ul className="space-y-1.5 text-sm">
            {[
              ["Dia de campo (ajudante, deslocamento…)", r.diaHa],
              ["Baterias, manutenção e gerador", p.bateriaHa + p.manutencaoHa + p.geradorHa],
              ...(r.impostoHa ? [["Imposto", r.impostoHa] as [string, number]] : []),
              [`Custos fixos e equipamento (${formatBRL(r.fixosTotalMes)}/mês ÷ ${nf.format(r.haMes)} ha)`, r.fixoHa],
            ].map(([nome, v]) => (
              <li key={nome as string} className="flex items-baseline justify-between gap-3 border-b border-black/5 pb-1.5"><span>{nome}</span><span className="num font-bold">{formatBRL(v as number)}</span></li>
            ))}
            <li className="flex items-baseline justify-between gap-3 pt-1 font-extrabold"><span>Custo total por ha</span><span className="num">{formatBRL(r.custoHa)}</span></li>
          </ul>
          <p className="mt-3 text-xs text-brand-graphite/60">
            Equipamento se desgasta {formatBRL(r.depreciacaoMes)} por mês.{" "}
            {r.paybackMeses === null ? "Com esses números o investimento não se paga." : `Com esse resultado, o investimento se paga em cerca de ${r.paybackMeses} meses.`}
          </p>
        </Card>

        <Card>
          <CardTitle>E se? Resultado do mês</CardTitle>
          <p className="mb-2 text-xs text-brand-graphite/60">Linhas: preço por ha. Colunas: quantos hectares você faz no mês.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-separate border-spacing-1 text-center text-xs">
              <thead>
                <tr><th className="text-left font-semibold text-brand-graphite/60">Preço</th>{s.colunas.map((c) => <th key={c.pct} className="font-semibold text-brand-graphite/60">{nf.format(c.haMes)} ha<br /><span className="font-normal">{c.pct > 0 ? "+" : ""}{c.pct}%</span></th>)}</tr>
              </thead>
              <tbody>
                {s.linhas.map((l) => (
                  <tr key={l.preco}>
                    <th className={`text-left font-bold ${l.preco === p.precoHa ? "text-brand-dark" : "text-brand-graphite/70"}`}>{formatBRL(l.preco)}</th>
                    {l.celulas.map((v, i) => <td key={i} className={`num rounded-lg px-1 py-2 font-bold ${cel(v)} ${l.preco === p.precoHa && s.colunas[i].pct === 0 ? "ring-2 ring-brand-dark/40" : ""}`}>{formatBRL(Math.round(v))}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
