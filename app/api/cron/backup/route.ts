import { NextRequest, NextResponse } from "next/server";
import { sendBackupEmail } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Agendado em vercel.json (toda segunda, 08h de Brasília). A Vercel envia
// "Authorization: Bearer <CRON_SECRET>"; sem o segredo certo, ninguém executa.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  try {
    const result = await sendBackupEmail();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
