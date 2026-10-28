import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-guard";
import { SECRET_NAMES, getSecret, removeSecret, saveSecret, secretStatus, type SecretName } from "@/lib/app-secrets";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

// Formato esperado de cada chave (evita colar o texto errado por engano).
const FORMAT: Record<SecretName, { re: RegExp; dica: string }> = {
  OPENAI_API_KEY: { re: /^sk-[A-Za-z0-9._-]{20,}$/, dica: "A chave da OpenAI começa com “sk-”." },
  RESEND_API_KEY: { re: /^re_[A-Za-z0-9._-]{16,}$/, dica: "A chave do Resend começa com “re_”." },
};

const nameField = z.enum(SECRET_NAMES);

// Nada aqui devolve o valor de uma chave: só se existe, de onde vem e o final dela.
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return fail(guard.error, guard.status);
  return NextResponse.json({ items: await secretStatus() });
}

export async function PUT(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return fail(guard.error, guard.status);
  const parsed = z.object({ name: nameField, value: z.string().trim().min(10).max(300) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Cole a chave completa.");
  const { name, value } = parsed.data;
  if (!FORMAT[name].re.test(value)) return fail(`Essa chave parece inválida. ${FORMAT[name].dica}`);
  try {
    await saveSecret(name, value, guard.access.userId);
  } catch (e) {
    return fail((e as Error).message, 500);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return fail(guard.error, guard.status);
  const parsed = nameField.safeParse(request.nextUrl.searchParams.get("name"));
  if (!parsed.success) return fail("Chave desconhecida.");
  try {
    await removeSecret(parsed.data);
  } catch (e) {
    return fail((e as Error).message, 500);
  }
  return NextResponse.json({ ok: true });
}

// Testa se a chave guardada funciona (sem gastar créditos: só lista modelos).
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return fail(guard.error, guard.status);
  const parsed = nameField.safeParse((await request.json().catch(() => null))?.name);
  if (!parsed.success) return fail("Chave desconhecida.");
  if (parsed.data !== "OPENAI_API_KEY") return fail("O teste direto existe só para a OpenAI. Para o Resend, use Backup → Enviar backup agora.");

  const key = await getSecret("OPENAI_API_KEY");
  if (!key) return fail("Nenhuma chave da OpenAI cadastrada ainda.");
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return NextResponse.json({ ok: true, message: "Chave válida: a OpenAI respondeu normalmente." });
    if (res.status === 401) return fail("A OpenAI recusou a chave (401). Confira se copiou inteira ou gere outra.");
    if (res.status === 429) return fail("A chave é válida, mas o saldo/limite da OpenAI acabou (429).");
    return fail(`A OpenAI respondeu com erro ${res.status}.`);
  } catch {
    return fail("Não foi possível falar com a OpenAI agora. Tente de novo.", 504);
  }
}
