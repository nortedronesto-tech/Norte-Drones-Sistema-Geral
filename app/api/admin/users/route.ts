import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLES } from "@/lib/access";

export const dynamic = "force-dynamic";

const NO_SERVICE_KEY =
  "Falta configurar a SUPABASE_SERVICE_ROLE_KEY na Vercel (Settings → Environment Variables) e fazer Redeploy.";

const roleEnum = z.enum(ROLES as [string, ...string[]]);
const emailField = z.string().trim().toLowerCase().email("E-mail inválido").max(160);
const passwordField = z.string().min(8, "A senha precisa ter pelo menos 8 caracteres").max(72);

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

type AccessRow = { user_id: string; email: string; name: string; role: string; active: boolean; created_at: string };

/** Garante que sempre sobre ao menos 1 administrador ativo. */
async function otherActiveAdmins(admin: NonNullable<ReturnType<typeof createAdminClient>>, exceptId: string) {
  const { count } = await admin
    .from("user_access")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("active", true)
    .neq("user_id", exceptId);
  return count ?? 0;
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return fail(guard.error, guard.status);
  const admin = createAdminClient();
  if (!admin) return fail(NO_SERVICE_KEY, 500);

  const [{ data: rows, error }, listed] = await Promise.all([
    admin.from("user_access").select("*").order("created_at"),
    admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
  ]);
  if (error) return fail(error.message, 500);

  const auth = new Map((listed.data?.users ?? []).map((u) => [u.id, u]));
  const known = new Set((rows ?? []).map((r) => r.user_id));
  const users = (rows as AccessRow[]).map((r) => ({
    ...r,
    last_sign_in_at: auth.get(r.user_id)?.last_sign_in_at ?? null,
  }));
  // Logins que existem no Supabase mas ainda não têm nível definido.
  const semNivel = (listed.data?.users ?? [])
    .filter((u) => !known.has(u.id))
    .map((u) => ({ user_id: u.id, email: u.email ?? "", last_sign_in_at: u.last_sign_in_at ?? null }));

  return NextResponse.json({ users, semNivel, me: guard.access.userId });
}

const createSchema = z.object({
  email: emailField,
  name: z.string().trim().min(1, "Informe o nome").max(100),
  role: roleEnum,
  password: passwordField,
});

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return fail(guard.error, guard.status);
  const admin = createAdminClient();
  if (!admin) return fail(NO_SERVICE_KEY, 500);

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const v = parsed.data;

  const created = await admin.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: true,
    user_metadata: { name: v.name },
  });
  if (created.error || !created.data.user) {
    const already = /already|registered|exists/i.test(created.error?.message ?? "");
    return fail(already ? "Já existe um usuário com esse e-mail." : `Não foi possível criar: ${created.error?.message}`);
  }
  const user = created.data.user;

  const { error } = await admin
    .from("user_access")
    .insert({ user_id: user.id, email: v.email, name: v.name, role: v.role, active: true, created_by: guard.access.userId });
  if (error) {
    await admin.auth.admin.deleteUser(user.id); // não deixa login sem nível
    return fail(`Não foi possível salvar o nível de acesso: ${error.message}`, 500);
  }
  return NextResponse.json({ ok: true, user_id: user.id });
}

const patchSchema = z.object({
  user_id: z.uuid(),
  name: z.string().trim().min(1).max(100).optional(),
  role: roleEnum.optional(),
  active: z.boolean().optional(),
  password: passwordField.optional(),
});

export async function PATCH(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return fail(guard.error, guard.status);
  const admin = createAdminClient();
  if (!admin) return fail(NO_SERVICE_KEY, 500);

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const v = parsed.data;
  const isSelf = v.user_id === guard.access.userId;

  const { data: current } = await admin.from("user_access").select("*").eq("user_id", v.user_id).maybeSingle();

  // não permite tirar o próprio acesso de administrador nem ficar sem nenhum administrador
  const losesAdmin =
    (v.role !== undefined && v.role !== "admin") || v.active === false;
  if (current?.role === "admin" && losesAdmin) {
    if (isSelf) return fail("Você não pode rebaixar nem desativar o seu próprio acesso de administrador.");
    if ((await otherActiveAdmins(admin, v.user_id)) === 0) return fail("Precisa existir pelo menos 1 administrador ativo.");
  }
  if (isSelf && v.active === false) return fail("Você não pode desativar o seu próprio acesso.");

  if (v.password) {
    const { error } = await admin.auth.admin.updateUserById(v.user_id, { password: v.password });
    if (error) return fail(`Não foi possível trocar a senha: ${error.message}`);
  }

  const changes: Record<string, unknown> = {};
  if (v.name !== undefined) changes.name = v.name;
  if (v.role !== undefined) changes.role = v.role;
  if (v.active !== undefined) changes.active = v.active;

  if (Object.keys(changes).length) {
    if (current) {
      const { error } = await admin.from("user_access").update(changes).eq("user_id", v.user_id);
      if (error) return fail(error.message, 500);
    } else {
      // login que existia sem nível: define agora
      const { data: au } = await admin.auth.admin.getUserById(v.user_id);
      if (!au.user?.email) return fail("Usuário não encontrado.", 404);
      const { error } = await admin.from("user_access").insert({
        user_id: v.user_id,
        email: au.user.email.toLowerCase(),
        name: (changes.name as string) ?? au.user.email,
        role: (changes.role as string) ?? "consulta",
        active: (changes.active as boolean) ?? true,
        created_by: guard.access.userId,
      });
      if (error) return fail(error.message, 500);
    }
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return fail(guard.error, guard.status);
  const admin = createAdminClient();
  if (!admin) return fail(NO_SERVICE_KEY, 500);

  const id = request.nextUrl.searchParams.get("user_id") ?? "";
  if (!z.uuid().safeParse(id).success) return fail("Usuário inválido.");
  if (id === guard.access.userId) return fail("Você não pode excluir o seu próprio acesso.");

  const { data: current } = await admin.from("user_access").select("role").eq("user_id", id).maybeSingle();
  if (current?.role === "admin" && (await otherActiveAdmins(admin, id)) === 0) {
    return fail("Precisa existir pelo menos 1 administrador ativo.");
  }
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return fail(`Não foi possível excluir: ${error.message}`, 500);
  return NextResponse.json({ ok: true });
}
