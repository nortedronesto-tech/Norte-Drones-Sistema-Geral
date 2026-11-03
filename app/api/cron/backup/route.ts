import { NextRequest, NextResponse } from "next/server";
import { sendBackupEmail } from "@/lib/backup";
import { recordHealth } from "@/lib/health-store";

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
    await recordHealth({ backup: { at: new Date().toISOString(), ok: true, by: "cron" } });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    await recordHealth({ backup: { at: new Date().toISOString(), ok: false, by: "cron", note: (err as Error).message } });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
