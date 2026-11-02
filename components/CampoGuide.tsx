"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Copy, Plus, Search, Share2, Trash2, TriangleAlert } from "lucide-react";
import { calcCalda, calcSolidos, FORMULATIONS, recipeText, solidosText, type DoseUnit, type Formulation, type Product } from "@/lib/calda";
import { DISCLAIMER, EMERGENCY, FAQ, FAQ_CATEGORIES, SECOES, SOURCES, STEPS, type Secao } from "@/lib/campo-content";
import { saveRecipe, deleteRecipe } from "@/app/gestao/campo/actions";
import { btn, Card, CardTitle, EmptyState, FormError, inputClass, labelClass } from "@/components/ui";

export type SavedRecipe = {
  id: string;
  name: string;
  crop: string | null;
  target: string | null;
  rate_l_ha: number;
  tank_l: number;
  products: Product[];
  notes: string | null;
};

type Row = { name: string; dose: string; unit: DoseUnit; form: Formulation };
const UNITS: DoseUnit[] = ["L/ha", "mL/ha", "kg/ha", "g/ha"];
const TANKS = [10, 16, 20, 30, 40, 50];

const num = (s: string) => Number(s.replace(",", "."));
const emptyRow = (): Row => ({ name: "", dose: "", unit: "L/ha", form: "emulsao" });
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Exemplo só para entender a conta: nomes e doses FICTÍCIOS, não são recomendação de uso.
const EXAMPLE = {
  area: "25", rate: "10", tank: "40",
  rows: [
    { name: "Produto A (exemplo)", dose: "0,5", unit: "L/ha", form: "emulsao" },
    { name: "Produto B (exemplo)", dose: "150", unit: "g/ha", form: "pre-diluir" },
    { name: "Adjuvante (exemplo)", dose: "50", unit: "mL/ha", form: "adjuvante" },
  ] as Row[],
};

const TIPO_INFO: Record<"pulverizacao" | "foliar", { form: Formulation; dica: string }> = {
  pulverizacao: { form: "emulsao", dica: "Defensivos (fungicida, inseticida, herbicida): a dose e a mistura são as do receituário. Faça sempre o teste de jarra." },
  foliar: { form: "solucao", dica: "Adubo foliar e nutrientes: confira a compatibilidade com os defensivos antes de misturar e respeite a concentração máxima da bula, que evita queima de folha." },
};

export function CampoGuide({ secao, recipes, recipesEnabled, canWrite, canManage }: {
  secao: Secao; recipes: SavedRecipe[]; recipesEnabled: boolean; canWrite: boolean; canManage: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {SECOES.map((t) => (
          <Link key={t.id} href={`/gestao/campo/${t.id}`} aria-current={secao === t.id ? "page" : undefined}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold ${secao === t.id ? "border-brand-green bg-brand-green text-white" : "border-black/15 bg-white text-brand-graphite/80"}`}>
            {t.label}
          </Link>
        ))}
      </div>

      <p className="flex gap-2 rounded-xl border border-brand-amber/40 bg-brand-amber/10 px-4 py-3 text-sm text-[#7a4a00]">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> <span>{DISCLAIMER}</span>
      </p>

      {(secao === "pulverizacao" || secao === "foliar") && (
        <CaldaCalculator key={secao} tipo={secao} recipes={recipes} recipesEnabled={recipesEnabled} canWrite={canWrite} canManage={canManage} />
      )}
      {secao === "solidos" && <SolidosCalculator />}
      {secao === "passo-a-passo" && <Steps />}
      {secao === "duvidas" && <Faq />}

      <Card>
        <CardTitle>Fontes de referência</CardTitle>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {SOURCES.map((s) => (
            <li key={s.href}><a href={s.href} target="_blank" rel="noopener noreferrer" className="text-brand-green underline">{s.label}</a></li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-brand-graphite/60">Resumo em linguagem própria. Leia as páginas originais e a bula do produto.</p>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ calculadora
function CaldaCalculator({ tipo, recipes, recipesEnabled, canWrite, canManage }: {
  tipo: "pulverizacao" | "foliar"; recipes: SavedRecipe[]; recipesEnabled: boolean; canWrite: boolean; canManage: boolean;
}) {
  const [area, setArea] = useState("");
  const [rate, setRate] = useState("10");
  const [tank, setTank] = useState("40");
  const newRow = (): Row => ({ ...emptyRow(), form: TIPO_INFO[tipo].form });
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [title, setTitle] = useState("");
  const [crop, setCrop] = useState("");
  const [target, setTarget] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const products: Product[] = rows
    .filter((r) => r.name.trim() && num(r.dose) > 0)
    .map((r) => ({ name: r.name.trim(), dose: num(r.dose), unit: r.unit, form: r.form }));
  const input = { areaHa: num(area), rateLHa: num(rate), tankL: num(tank), products };
  const result = useMemo(() => (area.trim() ? calcCalda(input) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [area, rate, tank, JSON.stringify(products)]);
  const text = result?.ok ? recipeText(title.trim() || "Calda", input, result) : "";

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const flash = (ok: boolean, t: string) => { setMsg({ ok, text: t }); setTimeout(() => setMsg(null), 4000); };

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); flash(true, "Receita copiada."); } catch { flash(false, "Não deu para copiar. Selecione o texto e copie."); }
  };
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ text }); } catch { /* cancelado */ } } else await copy();
  };
  const load = (r: SavedRecipe) => {
    setTitle(r.name); setCrop(r.crop ?? ""); setTarget(r.target ?? ""); setNotes(r.notes ?? "");
    setRate(String(r.rate_l_ha).replace(".", ",")); setTank(String(r.tank_l).replace(".", ","));
    setRows(r.products.length ? r.products.map((p) => ({ name: p.name, dose: String(p.dose).replace(".", ","), unit: p.unit, form: p.form })) : [emptyRow()]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const save = () => start(async () => {
    const res = await saveRecipe({ name: title, crop, target, notes, rate_l_ha: num(rate), tank_l: num(tank), products });
    flash(res.ok, res.ok ? "Receita salva." : res.error);
  });
  const remove = (id: string) => { if (confirm("Apagar esta receita salva?")) start(async () => { const res = await deleteRecipe(id); if (!res.ok) flash(false, res.error); }); };

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-brand-green/10 px-4 py-3 text-sm font-medium text-brand-dark">{TIPO_INFO[tipo].dica}</p>
      <Card>
        <CardTitle aside={
          <button type="button" className="text-sm font-bold text-brand-green underline"
            onClick={() => { setArea(EXAMPLE.area); setRate(EXAMPLE.rate); setTank(EXAMPLE.tank); setRows(EXAMPLE.rows); setTitle("Exemplo (valores fictícios)"); }}>
            Ver exemplo
          </button>}>Dados da aplicação</CardTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="area">Área (ha)</label>
            <input id="area" inputMode="decimal" className={inputClass} value={area} onChange={(e) => setArea(e.target.value)} placeholder="ex.: 25" />
          </div>
          <div>
            <label className={labelClass} htmlFor="rate">Calda por hectare (L/ha)</label>
            <input id="rate" inputMode="decimal" className={inputClass} value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="tank">Tanque do drone (L)</label>
            <input id="tank" inputMode="decimal" className={inputClass} value={tank} onChange={(e) => setTank(e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TANKS.map((t) => (
                <button key={t} type="button" onClick={() => setTank(String(t))}
                  className={`rounded-full border px-2.5 py-1 text-xs font-bold ${num(tank) === t ? "border-brand-green bg-brand-green text-white" : "border-black/15 bg-white"}`}>{t} L</button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Produtos (dose da bula / receituário)</CardTitle>
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="rounded-xl border border-black/10 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_7rem_6rem]">
                <input aria-label="Nome do produto" className={inputClass} placeholder="Nome do produto" value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} />
                <input aria-label="Dose" inputMode="decimal" className={inputClass} placeholder="Dose" value={r.dose} onChange={(e) => setRow(i, { dose: e.target.value })} />
                <select aria-label="Unidade" className={inputClass} value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value as DoseUnit })}>
                  {UNITS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <select aria-label="Tipo de formulação" className={`${inputClass} text-sm`} value={r.form} onChange={(e) => setRow(i, { form: e.target.value as Formulation })}>
                  {FORMULATIONS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
                {rows.length > 1 && (
                  <button type="button" aria-label="Tirar produto" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="rounded-lg p-2 text-danger/70 hover:bg-danger/5">
                    <Trash2 className="size-5" aria-hidden />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {rows.length < 20 && (
          <button type="button" className={`${btn.ghost} mt-3`} onClick={() => setRows((rs) => [...rs, newRow()])}><Plus className="size-5" aria-hidden /> Adicionar produto</button>
        )}
      </Card>

      {result && !result.ok && <FormError message={result.error} />}
      {result?.ok && (
        <Card>
          <CardTitle>Resultado</CardTitle>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Calda total" value={`${result.totalVolumeL.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L`} />
            <Stat label="Cada tanque cobre" value={`${result.haPerFullTank.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha`} />
            <Stat label="Tanques" value={`${result.tankCount}`} />
          </div>
          {result.warnings.map((w) => (
            <p key={w} className="mt-3 flex gap-2 rounded-xl bg-brand-amber/10 px-3 py-2 text-sm text-[#7a4a00]"><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {w}</p>
          ))}
          <div className="mt-4 space-y-3">
            {result.tanks.map((t) => (
              <div key={t.index} className="rounded-xl border border-black/10 p-3">
                <p className="text-sm font-bold text-brand-dark">
                  Tanque {t.index} {t.full ? "" : "(parcial)"} · {t.volumeL.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L · {t.ha.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha
                </p>
                <ol className="mt-2 space-y-1 text-sm">
                  <li>1. Água: cerca de <strong>{(t.volumeL * 0.75).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L</strong> (70–80%), agitação ligada</li>
                  {t.lines.map((l, k) => <li key={l.name + k}>{k + 2}. {l.name}: <strong>{l.text}</strong></li>)}
                  <li>{t.lines.length + 2}. Complete com água até {t.volumeL.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L e mantenha a agitação</li>
                </ol>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><label className={labelClass} htmlFor="rname">Nome da receita</label>
              <input id="rname" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex.: Soja — fungicida" /></div>
            <div><label className={labelClass} htmlFor="rcrop">Cultura (opcional)</label>
              <input id="rcrop" className={inputClass} value={crop} onChange={(e) => setCrop(e.target.value)} /></div>
            <div><label className={labelClass} htmlFor="rtarget">Alvo / praga (opcional)</label>
              <input id="rtarget" className={inputClass} value={target} onChange={(e) => setTarget(e.target.value)} /></div>
            <div><label className={labelClass} htmlFor="rnotes">Observações (opcional)</label>
              <input id="rnotes" className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={btn.primary} onClick={share}><Share2 className="size-5" aria-hidden /> Enviar (WhatsApp)</button>
            <button type="button" className={btn.ghost} onClick={copy}><Copy className="size-5" aria-hidden /> Copiar</button>
            {canWrite && recipesEnabled && (
              <button type="button" className={btn.cta} disabled={pending || !title.trim()} onClick={save}>Salvar receita</button>
            )}
          </div>
          {msg && <p role="status" className={`mt-3 text-sm font-semibold ${msg.ok ? "text-brand-green" : "text-danger"}`}>{msg.text}</p>}
        </Card>
      )}

      <Card>
        <CardTitle>Receitas salvas</CardTitle>
        {!recipesEnabled ? (
          <EmptyState>Receitas salvas ainda não estão ativas. O administrador precisa rodar a migration 0007 no Supabase.</EmptyState>
        ) : recipes.length === 0 ? (
          <EmptyState>Nenhuma receita salva ainda. Faça a conta acima, dê um nome e toque em “Salvar receita”.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {recipes.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-black/10 p-3">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => load(r)}>
                  <p className="truncate font-bold text-brand-dark">{r.name}</p>
                  <p className="truncate text-xs text-brand-graphite/60">
                    {[r.crop, r.target].filter(Boolean).join(" · ") || "—"} · {r.rate_l_ha} L/ha · tanque {r.tank_l} L · {r.products.length} produto(s)
                  </p>
                </button>
                {canManage && (
                  <button type="button" aria-label={`Apagar ${r.name}`} disabled={pending} onClick={() => remove(r.id)} className="rounded-lg p-2 text-danger/70 hover:bg-danger/5">
                    <Trash2 className="size-5" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-brand-mist px-2 py-3">
      <p className="num text-lg font-extrabold text-brand-dark">{value}</p>
      <p className="text-[11px] font-semibold text-brand-graphite/60">{label}</p>
    </div>
  );
}

// ------------------------------------------------------------------ sólidos (granulado / pó seco)
function SolidosCalculator() {
  const [area, setArea] = useState("");
  const [dose, setDose] = useState("");
  const [hopper, setHopper] = useState("");
  const [bag, setBag] = useState("25");
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const input = { areaHa: num(area), doseKgHa: num(dose), hopperKg: num(hopper), bagKg: num(bag) || undefined };
  const result = area.trim() || dose.trim() || hopper.trim() ? calcSolidos(input) : null;
  const text = result?.ok ? solidosText(title.trim() || "Aplicação de sólidos", input, result) : "";
  const copy = async () => { try { await navigator.clipboard.writeText(text); setMsg("Copiado."); } catch { setMsg("Não deu para copiar."); } setTimeout(() => setMsg(null), 3000); };
  const share = async () => { if (navigator.share) { try { await navigator.share({ text }); } catch { /* cancelado */ } } else await copy(); };

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-brand-green/10 px-4 py-3 text-sm font-medium text-brand-dark">
        Granulados e pós aplicados secos, sem água (adubo, corretivo, isca): a conta é em kg por hectare e por carga da caçamba do drone. Dose da bula ou do receituário.
      </p>
      <Card>
        <CardTitle aside={<button type="button" className="text-sm font-bold text-brand-green underline" onClick={() => { setArea("12"); setDose("50"); setHopper("40"); setTitle("Exemplo (valores fictícios)"); }}>Ver exemplo</button>}>Dados da aplicação</CardTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={labelClass} htmlFor="sarea">Área (ha)</label><input id="sarea" inputMode="decimal" className={inputClass} value={area} onChange={(e) => setArea(e.target.value)} /></div>
          <div><label className={labelClass} htmlFor="sdose">Dose (kg por hectare)</label><input id="sdose" inputMode="decimal" className={inputClass} value={dose} onChange={(e) => setDose(e.target.value)} /></div>
          <div><label className={labelClass} htmlFor="shop">Caçamba do drone (kg)</label><input id="shop" inputMode="decimal" className={inputClass} value={hopper} onChange={(e) => setHopper(e.target.value)} /></div>
          <div><label className={labelClass} htmlFor="sbag">Saco do produto (kg, opcional)</label><input id="sbag" inputMode="decimal" className={inputClass} value={bag} onChange={(e) => setBag(e.target.value)} /></div>
        </div>
      </Card>
      {result && !result.ok && <FormError message={result.error} />}
      {result?.ok && (
        <Card>
          <CardTitle>Resultado</CardTitle>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Produto total" value={`${result.totalKg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`} />
            <Stat label="Cada carga cobre" value={`${result.haPerLoad.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha`} />
            <Stat label="Cargas" value={`${result.loadCount}`} />
          </div>
          {result.bags && <p className="mt-3 text-sm font-semibold">Leve pelo menos <strong>{result.bags} saco(s)</strong> de {num(bag)} kg.</p>}
          {result.warnings.map((w) => <p key={w} className="mt-3 rounded-xl bg-brand-amber/10 px-3 py-2 text-sm text-[#7a4a00]">{w}</p>)}
          <ol className="mt-3 space-y-1 text-sm">
            {result.loads.map((l) => <li key={l.index}>Carga {l.index}{l.full ? "" : " (parcial)"}: <strong>{l.kg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg</strong> · {l.ha.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha</li>)}
          </ol>
          <div className="mt-4"><label className={labelClass} htmlFor="stitle">Nome (para o resumo)</label><input id="stitle" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex.: Pasto fazenda X" /></div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={btn.primary} onClick={share}><Share2 className="size-5" aria-hidden /> Enviar (WhatsApp)</button>
            <button type="button" className={btn.ghost} onClick={copy}><Copy className="size-5" aria-hidden /> Copiar</button>
          </div>
          {msg && <p role="status" className="mt-2 text-sm font-semibold text-brand-green">{msg}</p>}
        </Card>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ passo a passo
function Steps() {
  return (
    <Card>
      <CardTitle>Como preparar a calda</CardTitle>
      <ol className="space-y-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-green text-sm font-extrabold text-white">{i + 1}</span>
            <div>
              <h3 className="font-bold text-brand-dark">{s.title}</h3>
              <p className="mt-0.5 text-sm text-brand-graphite/85">{s.body}</p>
              {s.tip && <p className="mt-1 text-sm font-semibold text-brand-green">Dica: {s.tip}</p>}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-5 rounded-xl bg-danger/5 px-4 py-3 text-sm font-semibold text-danger">{EMERGENCY}</p>
    </Card>
  );
}

// ------------------------------------------------------------------ tira-dúvidas
function Faq() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const words = norm(q).split(/\s+/).filter(Boolean);
  const list = FAQ.filter((f) => (!cat || f.cat === cat) && words.every((w) => norm(`${f.q} ${f.a} ${f.tags ?? ""}`).includes(w)));
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-brand-graphite/40" aria-hidden />
        <input aria-label="Buscar dúvida" className={`${inputClass} pl-11`} placeholder="Buscar: ordem, pH, vento, EPI, tríplice lavagem…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {["", ...FAQ_CATEGORIES].map((c) => (
          <button key={c || "todas"} type="button" onClick={() => setCat(c)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${cat === c ? "border-brand-green bg-brand-green text-white" : "border-black/15 bg-white"}`}>{c || "Todas"}</button>
        ))}
      </div>
      {list.length === 0 ? <EmptyState>Nada encontrado. Tente outra palavra ou pergunte ao agrônomo.</EmptyState> : (
        <div className="space-y-2">
          {list.map((f) => (
            <details key={f.q} className="group rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
              <summary className="cursor-pointer list-none font-bold text-brand-dark marker:hidden">
                <span className="mr-2 text-[11px] font-bold uppercase tracking-wide text-brand-green">{f.cat}</span><br />{f.q}
              </summary>
              <p className="mt-2 text-sm text-brand-graphite/90">{f.a}</p>
            </details>
          ))}
        </div>
      )}
      <p className="text-sm font-semibold text-danger">{EMERGENCY}</p>
    </div>
  );
}
