import { CheckCircle2, CircleAlert, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSecret } from "@/lib/app-secrets";
import { readHealth } from "@/lib/health-store";
import { ageText, MIGRATION_PROBES, runLevel, worst, type Level } from "@/lib/health";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { RunDailyButton } from "@/components/RunDailyButton";

export const metadata = { title: "Saúde do sistema" };
export const dynamic = "force-dynamic";

type Item = { level: Level; title: string; detail?: string; hint?: string };

const ICON = { ok: <CheckCircle2 className="size-5 text-brand-green" aria-label="ok" />, warn: <TriangleAlert className="size-5 text-[#b07a00]" aria-label="atenção" />, fail: <CircleAlert className="size-5 text-danger" aria-label="problema" /> };
const BANNER: Record<Level, [string, string]> = {
  ok: ["border-brand-green bg-brand-green text-white", "Tudo certo"],
  warn: ["border-brand-amber bg-brand-amber text-brand-dark", "Atenção"],
  fail: ["border-danger bg-danger text-white", "Há problemas para resolver"],
};

function Section({ title, items }: { title: string; items: Item[] }) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <ul className="divide-y divide-black/[0.06]">
        {items.map((i) => (
          <li key={i.title} className="flex gap-3 py-3">
            <span className="mt-0.5 shrink-0">{ICON[i.level]}</span>
            <div className="min-w-0">
              <p className="font-semibold leading-snug">{i.title}</p>
              {i.detail && <p className="text-sm text-brand-graphite/70">{i.detail}</p>}
              {i.level !== "ok" && i.hint && <p className="mt-0.5 text-sm font-semibold text-[#7a4a00]">{i.hint}</p>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default async function HealthPage() {
  const now = new Date();
  const admin = createAdminClient();
  const client = admin ?? (await createClient());

  // 1. Chaves e variáveis (só se existem; o valor nunca é lido nem mostrado)
  const resend = await getSecret("RESEND_API_KEY");
  const env: Item[] = [
    { level: process.env.SUPABASE_SERVICE_ROLE_KEY ? "ok" : "fail", title: "Chave de serviço do Supabase", detail: process.env.SUPABASE_SERVICE_ROLE_KEY ? "cadastrada na Vercel" : "não cadastrada", hint: "Vercel → Settings → Environment Variables → SUPABASE_SERVICE_ROLE_KEY, depois Redeploy." },
    { level: process.env.CRON_SECRET ? "ok" : "fail", title: "Segredo das rotinas automáticas (CRON_SECRET)", detail: process.env.CRON_SECRET ? "cadastrado na Vercel" : "não cadastrado", hint: "Sem ele a Vercel não consegue acionar o backup semanal nem a rotina diária." },
    { level: resend ? "ok" : "warn", title: "Chave do Resend (e-mails)", detail: resend ? "cadastrada" : "não cadastrada", hint: "Sistema → Integrações. Sem ela não saem o backup nem o lembrete de vencimentos." },
  ];

  // 2. Migrations (cada uma é provada por uma tabela/coluna que ela cria)
  const probes = await Promise.all(MIGRATION_PROBES.map(async (m) => {
    const { error } = await client.from(m.table).select(m.column).limit(1);
    return { m, ok: !error };
  }));
  const op = await client.rpc("can_operate");
  const mig: Item[] = [
    ...probes.map(({ m, ok }) => ({ level: (ok ? "ok" : "fail") as Level, title: `Migration ${m.id} — ${m.label}`, detail: ok ? "aplicada" : "não aplicada", hint: `Rode o arquivo supabase/migrations/${m.id}_*.sql no SQL Editor do Supabase.` })),
    { level: (op.error ? "fail" : "ok") as Level, title: "Migration 0012 — Nível Operador", detail: op.error ? "não aplicada" : "aplicada", hint: "Rode o arquivo supabase/migrations/0012_nivel_operador.sql no SQL Editor do Supabase." },
  ];

  // 3. Rotinas automáticas
  const h = await readHealth();
  const daily = h?.daily ?? null;
  const backup = h?.backup ?? null;
  const dailyLevel = h === null ? "fail" : runLevel(daily, now, 36, 72);
  const backupLevel = h === null ? "fail" : runLevel(backup, now, 9 * 24, 16 * 24);
  const jobs: Item[] = [
    { level: dailyLevel, title: "Rotina diária (recorrentes e lembrete de vencimentos)", detail: daily ? `última execução ${ageText(daily.at, now)}${daily.note ? ` — ${daily.note}` : ""}` : "ainda não rodou", hint: "Confira CRON_SECRET e a chave de serviço, ou use o botão abaixo para executar agora." },
    { level: backupLevel, title: "Backup por e-mail", detail: backup ? `último ${backup.by === "manual" ? "(manual)" : "(semanal)"} ${ageText(backup.at, now)}${backup.ok ? "" : ` — falhou: ${backup.note ?? "erro"}`}` : "nenhum backup registrado ainda", hint: "Sistema → Backup: use o envio manual para testar; confira a chave do Resend." },
  ];

  const overall = worst([...env, ...mig, ...jobs].map((i) => i.level));
  const [bannerCls, bannerText] = BANNER[overall];

  return (
    <>
      <PageHeader title="Saúde do sistema" subtitle="Chaves, migrations do banco e rotinas automáticas, de uma vez." />
      <div className="space-y-4">
        <div role="status" className={`rounded-2xl border-2 p-4 ${bannerCls}`}><p className="text-2xl font-extrabold">{bannerText}</p><p className="text-sm font-medium opacity-95">Confira os itens abaixo; os que precisam de ação mostram o que fazer.</p></div>
        <Section title="Chaves e variáveis" items={env} />
        <Section title="Migrations do banco" items={mig} />
        <Section title="Rotinas automáticas" items={jobs} />
        <Card><CardTitle>Testar agora</CardTitle><RunDailyButton /><p className="mt-2 text-xs text-brand-graphite/60">Executa os recorrentes e o lembrete de vencimentos como a rotina diária. O backup tem o botão próprio em Sistema → Backup.</p></Card>
      </div>
    </>
  );
}
