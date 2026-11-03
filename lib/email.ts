import "server-only";
import { getSecret } from "@/lib/app-secrets";

/** Envia um e-mail pelo Resend (a chave fica em Sistema → Integrações). Nunca lança: devolve ok/erro. */
export async function sendEmail(opts: { to: string; subject: string; html: string; text: string }): Promise<{ ok: boolean; error?: string }> {
  const apiKey = await getSecret("RESEND_API_KEY");
  if (!apiKey) return { ok: false, error: "Falta a chave do Resend (Sistema → Integrações)." };
  const from = process.env.BACKUP_EMAIL_FROM || "Norte Drones <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, html: opts.html, text: opts.text }),
    });
    if (!res.ok) return { ok: false, error: `Resend ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "falha de rede" };
  }
}
