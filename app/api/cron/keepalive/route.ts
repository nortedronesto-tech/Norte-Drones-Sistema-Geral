import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

// Uma consulta leve por dia: o Supabase gratuito pausa projetos sem uso por ~7 dias.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const client = createAdminClient() ?? createPublicClient();
  if (!client) return NextResponse.json({ error: "Supabase não configurado." }, { status: 500 });
  const { error } = await client.from("site_settings").select("key").limit(1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
