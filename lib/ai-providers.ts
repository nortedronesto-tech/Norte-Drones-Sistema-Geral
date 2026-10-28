import "server-only";
import { getSecret, type SecretName } from "@/lib/app-secrets";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PROVIDER_IDS,
  applyOutcome,
  classifyFailure,
  normalizeConfig,
  orchestrate,
  type AiConfig,
  type AiProvider,
  type Attempt,
  type Failure,
} from "@/lib/ai-routing";

export { PROVIDER_IDS, PROVIDER_LABEL, detectProvider, applyOutcome } from "@/lib/ai-routing";
export type { AiConfig, AiProvider } from "@/lib/ai-routing";

/** Onde a chave de cada IA fica guardada (cofre do Supabase) e o que cada uma usa. */
export const PROVIDER_META: Record<
  AiProvider,
  { secret: SecretName; defaultModel: string; baseUrl?: string; keysUrl: string; free: string }
> = {
  gemini: {
    secret: "GEMINI_API_KEY",
    defaultModel: "gemini-2.5-flash",
    keysUrl: "https://aistudio.google.com/apikey",
    free: "tem faixa gratuita diária",
  },
  grok: {
    secret: "XAI_API_KEY",
    defaultModel: "grok-2-vision-latest",
    baseUrl: "https://api.x.ai/v1",
    keysUrl: "https://console.x.ai",
    free: "pago por uso",
  },
  groq: {
    secret: "GROQ_API_KEY",
    defaultModel: "meta-llama/llama-4-scout-17b-16e-instruct",
    baseUrl: "https://api.groq.com/openai/v1",
    keysUrl: "https://console.groq.com/keys",
    free: "tem faixa gratuita",
  },
  openai: {
    secret: "OPENAI_API_KEY",
    defaultModel: "gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1",
    keysUrl: "https://platform.openai.com/api-keys",
    free: "pago por uso",
  },
};

// ------------------------------------------------------------ configuração salva
const CONFIG_KEY = "ai_providers";

/** Ordem, ligado/desligado, modelo e estado de cada IA. Fica em site_settings (só o servidor lê). */
export async function loadAiConfig(): Promise<AiConfig> {
  const admin = createAdminClient();
  if (!admin) return normalizeConfig(null);
  const { data } = await admin.from("site_settings").select("value").eq("key", CONFIG_KEY).maybeSingle();
  return normalizeConfig(data?.value);
}

export async function saveAiConfig(cfg: AiConfig) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Falta a SUPABASE_SERVICE_ROLE_KEY na Vercel.");
  const { error } = await admin
    .from("site_settings")
    .upsert({ key: CONFIG_KEY, value: cfg, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export function modelFor(cfg: AiConfig, p: AiProvider) {
  return cfg.models[p]?.trim() || PROVIDER_META[p].defaultModel;
}

// ------------------------------------------------------------ chamadas às IAs
export class ProviderCallError extends Error {
  constructor(
    message: string,
    public failure: Failure,
    public status: number | null,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 14_000;

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ProviderCallError("sem resposta (demorou ou a conexão falhou)", "transient", null);
  }
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 300);
    try {
      const j = JSON.parse(text);
      msg = j?.error?.message ?? j?.error ?? j?.message ?? msg;
    } catch {
      /* usa o texto cru */
    }
    throw new ProviderCallError(String(msg).slice(0, 200), classifyFailure(res.status, text), res.status);
  }
  return text;
}

/** Pede à IA para ler a imagem e devolve o texto da resposta (que deve ser um JSON). */
export async function callVision(
  p: AiProvider,
  key: string,
  model: string,
  system: string,
  userText: string,
  dataUrl: string,
): Promise<string> {
  const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new ProviderCallError("imagem inválida", "other", 400);
  const [, mime, b64] = m;

  if (p === "gemini") {
    const text = await post(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      { "x-goog-api-key": key },
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: userText }, { inline_data: { mime_type: mime, data: b64 } }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: 600 },
      },
    );
    const j = JSON.parse(text) as { candidates?: { content?: { parts?: { text?: string }[] } }[]; promptFeedback?: { blockReason?: string } };
    const out = j.candidates?.[0]?.content?.parts?.map((x) => x.text ?? "").join("") ?? "";
    if (!out) throw new ProviderCallError(j.promptFeedback?.blockReason ? `bloqueado (${j.promptFeedback.blockReason})` : "resposta vazia", "other", 200);
    return out;
  }

  // Grok (xAI), Groq e OpenAI usam o formato "chat completions" da OpenAI.
  const base = PROVIDER_META[p].baseUrl!;
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  };
  if (p === "openai") {
    body.max_completion_tokens = 600;
    body.response_format = { type: "json_object" };
  } else {
    body.max_tokens = 600;
    body.temperature = 0;
  }
  const text = await post(`${base}/chat/completions`, { Authorization: `Bearer ${key}` }, body);
  const j = JSON.parse(text) as { choices?: { message?: { content?: string } }[] };
  const out = j.choices?.[0]?.message?.content ?? "";
  if (!out) throw new ProviderCallError("resposta vazia", "other", 200);
  return out;
}

/** Teste barato: lista os modelos da conta (não gasta crédito). */
export async function pingProvider(p: AiProvider, key: string): Promise<void> {
  const url = p === "gemini" ? "https://generativelanguage.googleapis.com/v1beta/models" : `${PROVIDER_META[p].baseUrl}/models`;
  const headers: Record<string, string> = p === "gemini" ? { "x-goog-api-key": key } : { Authorization: `Bearer ${key}` };
  let res: Response;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new ProviderCallError("sem resposta", "transient", null);
  }
  if (!res.ok) {
    const text = await res.text();
    let msg = text.slice(0, 200);
    try {
      const j = JSON.parse(text);
      msg = j?.error?.message ?? j?.error ?? msg;
    } catch {
      /* texto cru */
    }
    throw new ProviderCallError(String(msg).slice(0, 200), classifyFailure(res.status, text), res.status);
  }
}

// ------------------------------------------------------------ estado e troca automática
export async function keysPresent(): Promise<Record<AiProvider, boolean>> {
  const entries = await Promise.all(PROVIDER_IDS.map(async (p) => [p, !!(await getSecret(PROVIDER_META[p].secret))] as const));
  return Object.fromEntries(entries) as Record<AiProvider, boolean>;
}

export type { Attempt };

/**
 * Roda `fn` na primeira IA disponível; se ela estiver sem crédito, com chave
 * inválida ou fora do ar, passa para a próxima da ordem. Salva o estado de cada uma.
 */
export async function runHybrid<T>(
  fn: (p: AiProvider, key: string, model: string) => Promise<T>,
  isFatal: (e: unknown) => boolean = () => false,
) {
  const hasKey = await keysPresent();
  return orchestrate(
    { load: loadAiConfig, save: saveAiConfig, hasKey, getKey: (p) => getSecret(PROVIDER_META[p].secret), modelFor, now: Date.now },
    fn,
    isFatal,
  );
}
