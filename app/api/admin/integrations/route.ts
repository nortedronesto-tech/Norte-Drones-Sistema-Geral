import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-guard";
import { getSecret, removeSecret, saveSecret, secretStatus } from "@/lib/app-secrets";
import {
  PROVIDER_IDS,
  PROVIDER_LABEL,
  PROVIDER_META,
  ProviderCallError,
  applyOutcome,
  cleanKey,
  detectProvider,
  discoverGeminiModel,
  listGeminiModels,
  loadAiConfig,
  modelFor,
  pingProvider,
  saveAiConfig,
  type AiProvider,
} from "@/lib/ai-providers";
import { pickCandidates } from "@/lib/ai-routing";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const providerField = z.enum(PROVIDER_IDS);

/** Tudo que a tela precisa: nunca inclui o valor de uma chave, só se existe e o final dela. */
async function snapshot() {
  const [secrets, cfg] = await Promise.all([secretStatus(), loadAiConfig()]);
  const bySecret = new Map(secrets.map((s) => [s.name, s]));
  const has = (p: AiProvider) => !!bySecret.get(PROVIDER_META[p].secret)?.configured;
  const { first, later } = pickCandidates(cfg, has, Date.now());
  const active = first[0] ?? later[0] ?? null;

  const providers = cfg.order.map((p) => {
    const s = bySecret.get(PROVIDER_META[p].secret);
    const st = cfg.status[p];
    return {
      id: p,
      label: PROVIDER_LABEL[p],
      keysUrl: PROVIDER_META[p].keysUrl,
      free: PROVIDER_META[p].free,
      configured: !!s?.configured,
      source: s?.source ?? null,
      hint: s?.hint ?? null,
      enabled: !cfg.disabled.includes(p),
      state: st?.state ?? null,
      until: st?.until ?? null,
      message: st?.message ?? null,
      lastOkAt: st?.lastOkAt ?? null,
      model: cfg.models[p] ?? "",
      defaultModel: PROVIDER_META[p].defaultModel,
      isActive: p === active,
    };
  });
  return {
    ai: { active, activeLabel: active ? PROVIDER_LABEL[active] : null, providers, lastUsed: cfg.lastUsed ?? null },
    resend: secrets.find((s) => s.name === "RESEND_API_KEY") ?? null,
  };
}

/** Testa a chave (lista os modelos, sem gastar crédito) e grava o estado da IA. */
async function testAndRecord(p: AiProvider, key: string): Promise<{ ok: boolean; message: string }> {
  const cfg = await loadAiConfig();
  try {
    await pingProvider(p, key, cfg.models[p]);
    let note = "";
    if (p === "gemini") {
      // o Google aposenta modelos: confere se o modelo configurado ainda existe para esta chave
      const list = await listGeminiModels(key);
      const current = modelFor(cfg, p);
      const exists = list.some((m) => m.name === `models/${current}`);
      if (list.length && !exists && !cfg.models[p]?.trim()) {
        const better = await discoverGeminiModel(key);
        if (better) {
          cfg.models[p] = better;
          note = ` O modelo padrão (${current}) não está mais disponível, então troquei para ${better}.`;
        }
      } else if (list.length && !exists) {
        note = ` Atenção: o modelo "${current}" que você definiu não aparece para esta chave. Apague o campo Modelo para o sistema escolher sozinho.`;
      }
    }
    const at = new Date().toISOString();
    cfg.status[p] = { state: "ok", at, lastOkAt: at };
    await saveAiConfig(cfg).catch(() => undefined);
    return { ok: true, message: `${PROVIDER_LABEL[p]}: chave válida. Modelo usado nas leituras: ${modelFor(cfg, p)}.${note}` };
  } catch (e) {
    const err = e instanceof ProviderCallError ? e : new ProviderCallError("erro", "other", null);
    await saveAiConfig(applyOutcome(cfg, p, err)).catch(() => undefined);
    const why =
      err.failure === "invalid" ? "a chave foi recusada. Confira se copiou inteira, se escolheu a IA certa, ou gere outra."
      : err.failure === "credit" ? "créditos/cota esgotados."
      : err.failure === "rate" ? "limite de uso atingido por agora."
      : err.failure === "transient" ? "sem resposta agora, tente de novo."
      : err.message;
    return { ok: false, message: `${PROVIDER_LABEL[p]}: ${why}` };
  }
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return fail(guard.error, guard.status);
  return NextResponse.json(await snapshot());
}

// Cola a chave: o sistema descobre sozinho de qual IA é pelo formato; se não reconhecer,
// a tela deixa escolher a IA na mão ({ provider }). Com { name: "RESEND_API_KEY" } cadastra a do backup.
export async function PUT(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return fail(guard.error, guard.status);
  const body = (await request.json().catch(() => null)) as { name?: string; value?: string; provider?: unknown } | null;
  const value = typeof body?.value === "string" ? body.value.trim() : "";
  if (!value) return fail("Cole a chave completa.");

  try {
    if (body?.name === "RESEND_API_KEY") {
      if (!/^re_[A-Za-z0-9._-]{16,}$/.test(value)) return fail("Essa chave parece inválida. A chave do Resend começa com “re_”.");
      await saveSecret("RESEND_API_KEY", value, guard.access.userId);
      return NextResponse.json({ ok: true });
    }

    let provider: AiProvider;
    let key: string;
    const chosen = providerField.safeParse(body?.provider);
    if (chosen.success) {
      const c = cleanKey(value);
      if (!c.ok) return fail(c.error);
      provider = chosen.data;
      key = c.key;
    } else {
      const d = detectProvider(value);
      if (!d.ok) return fail(d.error);
      provider = d.provider;
      key = d.key;
    }
    await saveSecret(PROVIDER_META[provider].secret, key, guard.access.userId);

    // chave nova: zera o estado anterior e já testa para avisar se funcionou
    const cfg = await loadAiConfig();
    delete cfg.status[provider];
    await saveAiConfig(cfg);
    const test = await testAndRecord(provider, key);
    return NextResponse.json({ ok: true, provider, label: PROVIDER_LABEL[provider], tested: test.ok, message: test.message });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("order"), order: z.array(providerField).length(PROVIDER_IDS.length) }),
  z.object({ action: z.literal("toggle"), provider: providerField, enabled: z.boolean() }),
  z.object({ action: z.literal("model"), provider: providerField, model: z.string().trim().max(120) }),
]);

export async function PATCH(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return fail(guard.error, guard.status);
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Pedido inválido.");
  const v = parsed.data;
  try {
    const cfg = await loadAiConfig();
    if (v.action === "order") {
      if (new Set(v.order).size !== PROVIDER_IDS.length) return fail("Ordem inválida.");
      cfg.order = v.order;
    } else if (v.action === "toggle") {
      cfg.disabled = v.enabled ? cfg.disabled.filter((p) => p !== v.provider) : [...new Set([...cfg.disabled, v.provider])];
    } else {
      if (v.model) cfg.models[v.provider] = v.model;
      else delete cfg.models[v.provider];
    }
    await saveAiConfig(cfg);
  } catch (e) {
    return fail((e as Error).message, 500);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return fail(guard.error, guard.status);
  try {
    if (request.nextUrl.searchParams.get("name") === "RESEND_API_KEY") {
      await removeSecret("RESEND_API_KEY");
      return NextResponse.json({ ok: true });
    }
    const p = providerField.safeParse(request.nextUrl.searchParams.get("provider"));
    if (!p.success) return fail("Chave desconhecida.");
    await removeSecret(PROVIDER_META[p.data].secret);
    const cfg = await loadAiConfig();
    delete cfg.status[p.data];
    await saveAiConfig(cfg);
  } catch (e) {
    return fail((e as Error).message, 500);
  }
  return NextResponse.json({ ok: true });
}

// Botão "Testar": confere a chave guardada e registra o estado.
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return fail(guard.error, guard.status);
  const parsed = providerField.safeParse((await request.json().catch(() => null))?.provider);
  if (!parsed.success) return fail("IA desconhecida.");
  const p = parsed.data;
  const key = await getSecret(PROVIDER_META[p].secret);
  if (!key) return fail(`Nenhuma chave do ${PROVIDER_LABEL[p]} cadastrada ainda.`);
  const t = await testAndRecord(p, key);
  return t.ok ? NextResponse.json({ ok: true, message: t.message }) : fail(t.message);
}
