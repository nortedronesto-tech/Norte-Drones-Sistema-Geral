import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { runDailyJobs } from "@/lib/daily";

export const dynamic = "force-dynamic";

// Rotina diária (a Vercel gratuita permite poucas): mantém o Supabase acordado (ele pausa sem uso por ~7 dias),
// cria os lançamentos recorrentes que vencem nos próximos dias e manda o lembrete de vencimentos por e-mail.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const admin = createAdminClient();
  const client = admin ?? createPublicClient();
  if (!client) return NextResponse.json({ error: "Supabase não configurado." }, { status: 500 });
  const { error } = await client.from("site_settings").select("key").limit(1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // As tarefas abaixo nunca derrubam a rotina: cada uma informa o próprio resultado.
  let recurring: unknown = "sem chave de serviço";
  let reminder: unknown = "sem chave de serviço";
  if (admin) ({ recurring, reminder } = await runDailyJobs(admin));
  return NextResponse.json({ ok: true, at: new Date().toISOString(), recurring, reminder });
}
