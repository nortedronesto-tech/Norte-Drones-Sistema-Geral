import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/admin-guard";
import { csvLine } from "@/lib/dashboard";
import { loadMonthRows, validMonth } from "@/lib/report-data";
import { monthKey, todayBR } from "@/lib/format";
import { statusLabel } from "@/lib/constants";

export const dynamic = "force-dynamic";

// Planilha (CSV com ; e vírgula decimal, abre direto no Excel) dos lançamentos do mês. Qualquer nível com acesso.
export async function GET(request: NextRequest) {
  const guard = await requireRole(["admin", "socio", "financeiro", "consulta"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const month = validMonth(request.nextUrl.searchParams.get("mes") ?? undefined) ?? monthKey(todayBR());
  const rows = await loadMonthRows(guard.supabase, month);
  const br = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "");
  const lines = [csvLine(["Data", "Tipo", "Situação", "Categoria", "Descrição", "Conta", "Valor"])];
  for (const t of rows) {
    lines.push(csvLine([br(t.paid_at ?? t.date), t.type === "entrada" ? "Entrada" : "Saída", statusLabel(t.status, t.type), t.category, t.description ?? "", t.account, t.type === "entrada" ? t.amount : -t.amount]));
  }
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="norte-drones-${month}.csv"`, "Cache-Control": "no-store" },
  });
}
