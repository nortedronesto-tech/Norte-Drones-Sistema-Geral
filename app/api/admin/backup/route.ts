import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { sendBackupEmail } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Backup manual (botão em Admin → Backup): mesmo envio do agendamento semanal.
export async function POST() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const result = await sendBackupEmail();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
