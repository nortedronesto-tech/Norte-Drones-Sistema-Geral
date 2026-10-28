import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const TABLES = [
  "settings",
  "partners",
  "bank_accounts",
  "transactions",
  "transaction_splits",
  "reserve_fund_entries",
  "site_settings",
  "user_access",
] as const;

type Row = Record<string, unknown>;

async function readAll(admin: NonNullable<ReturnType<typeof createAdminClient>>, table: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select("*").range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Lê todas as tabelas (com a chave de serviço) e monta os arquivos do backup. */
export async function buildBackup() {
  const admin = createAdminClient();
  if (!admin) throw new Error("Falta a SUPABASE_SERVICE_ROLE_KEY na Vercel.");

  const data: Record<string, Row[]> = {};
  for (const t of TABLES) data[t] = await readAll(admin, t);

  const accountName = new Map(data.bank_accounts.map((a) => [a.id, a.name]));
  const header = ["data", "tipo", "valor", "conta", "categoria", "descricao", "situacao", "pago_em", "foto"];
  const lines = [header.join(";")].concat(
    data.transactions.map((t) =>
      [t.date, t.type, t.amount, accountName.get(t.account_id) ?? "", t.category, t.description, t.status, t.paid_at, t.receipt_path]
        .map(csvCell)
        .join(";"),
    ),
  );

  const counts = Object.fromEntries(TABLES.map((t) => [t, data[t].length]));
  const generatedAt = new Date().toISOString();
  return {
    generatedAt,
    counts,
    json: JSON.stringify({ generatedAt, counts, tables: data }, null, 2),
    // BOM para o Excel abrir os acentos corretamente
    csv: "﻿" + lines.join("\n"),
  };
}

/** Envia o backup por e-mail (Resend). Os arquivos seguem em anexo. */
export async function sendBackupEmail() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Falta a RESEND_API_KEY na Vercel (veja o guia de backup no README).");
  const to = process.env.BACKUP_EMAIL_TO || "nortedronesto@gmail.com";
  const from = process.env.BACKUP_EMAIL_FROM || "Norte Drones <onboarding@resend.dev>";

  const backup = await buildBackup();
  const day = backup.generatedAt.slice(0, 10);
  const total = Object.values(backup.counts).reduce((a, b) => a + b, 0);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Backup Norte Drones — ${day}`,
      html:
        `<p>Backup semanal do sistema Norte Drones (${day}).</p>` +
        `<p>Registros: ${Object.entries(backup.counts).map(([t, n]) => `${t}: ${n}`).join(" · ")}.</p>` +
        `<p>Anexos: <strong>backup-${day}.json</strong> (tudo) e <strong>lancamentos-${day}.csv</strong> (planilha). ` +
        `As fotos de recibo ficam no Supabase Storage e não vão no anexo.</p>` +
        `<p style="color:#666">Guarde este e-mail em local seguro: ele contém dados financeiros.</p>`,
      attachments: [
        { filename: `backup-${day}.json`, content: Buffer.from(backup.json, "utf-8").toString("base64") },
        { filename: `lancamentos-${day}.csv`, content: Buffer.from(backup.csv, "utf-8").toString("base64") },
      ],
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) throw new Error(`Resend: ${body.message ?? res.status}`);
  return { id: body.id, to, total, counts: backup.counts };
}
