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

export { PROVIDER_IDS, PROVIDER_LABEL, cleanKey, detectProvider, applyOutcome } from "@/lib/ai-routing";
export type { AiConfig, AiProvider } from "@/lib/ai-routing";

type Kind = "gemini" | "openai" | "anthropic" | "cohere";
type PingKind = "models" | "chat" | { url: string };

type Meta = {
  secret: SecretName;
  /** formato da API: "openai" = chat/completions compatível com a OpenAI */
  kind: Kind;
  defaultModel: string;
  baseUrl?: string;
  keysUrl: string;
  free: string;
  /** Mistral quer a imagem como texto (data URL) em vez de objeto */
  imageAsString?: boolean;
  ping?: PingKind;
};

/**
 * Todas as IAs com API de leitura de imagem suportadas. Os nomes de modelo mudam com o tempo:
 * o administrador pode trocar em Admin → Integrações (campo "Modelo") sem mexer no código.
 */
export const PROVIDER_META: Record<AiProvider, Meta> = {
  gemini: { secret: "GEMINI_API_KEY", kind: "gemini", defaultModel: "gemini-2.5-flash", keysUrl: "https://aistudio.google.com/apikey", free: "costuma ter faixa gratuita diária" },
  grok: { secret: "XAI_API_KEY", kind: "openai", defaultModel: "grok-2-vision-latest", baseUrl: "https://api.x.ai/v1", keysUrl: "https://console.x.ai", free: "pago por uso" },
  groq: { secret: "GROQ_API_KEY", kind: "openai", defaultModel: "meta-llama/llama-4-scout-17b-16e-instruct", baseUrl: "https://api.groq.com/openai/v1", keysUrl: "https://console.groq.com/keys", free: "costuma ter faixa gratuita" },
  openrouter: { secret: "OPENROUTER_API_KEY", kind: "openai", defaultModel: "google/gemini-2.0-flash-exp:free", baseUrl: "https://openrouter.ai/api/v1", keysUrl: "https://openrouter.ai/keys", free: "tem modelos gratuitos (terminam em :free)", ping: { url: "https://openrouter.ai/api/v1/auth/key" } },
  mistral: { secret: "MISTRAL_API_KEY", kind: "openai", defaultModel: "mistral-small-latest", baseUrl: "https://api.mistral.ai/v1", keysUrl: "https://console.mistral.ai/api-keys", free: "costuma ter faixa gratuita de teste", imageAsString: true },
  together: { secret: "TOGETHER_API_KEY", kind: "openai", defaultModel: "Qwen/Qwen2.5-VL-72B-Instruct", baseUrl: "https://api.together.xyz/v1", keysUrl: "https://api.together.ai/settings/api-keys", free: "pago por uso (pode ter créditos iniciais)" },
  fireworks: { secret: "FIREWORKS_API_KEY", kind: "openai", defaultModel: "accounts/fireworks/models/qwen2p5-vl-32b-instruct", baseUrl: "https://api.fireworks.ai/inference/v1", keysUrl: "https://app.fireworks.ai/settings/users/api-keys", free: "pago por uso (pode ter créditos iniciais)" },
  nvidia: { secret: "NVIDIA_API_KEY", kind: "openai", defaultModel: "meta/llama-3.2-90b-vision-instruct", baseUrl: "https://integrate.api.nvidia.com/v1", keysUrl: "https://build.nvidia.com", free: "créditos gratuitos para testes", ping: "chat" },
  deepinfra: { secret: "DEEPINFRA_API_KEY", kind: "openai", defaultModel: "meta-llama/Llama-3.2-11B-Vision-Instruct", baseUrl: "https://api.deepinfra.com/v1/openai", keysUrl: "https://deepinfra.com/dash/api_keys", free: "pago por uso, bem barato", ping: "chat" },
  huggingface: { secret: "HUGGINGFACE_API_KEY", kind: "openai", defaultModel: "Qwen/Qwen2.5-VL-7B-Instruct", baseUrl: "https://router.huggingface.co/v1", keysUrl: "https://huggingface.co/settings/tokens", free: "faixa gratuita limitada", ping: { url: "https://huggingface.co/api/whoami-v2" } },
  cohere: { secret: "COHERE_API_KEY", kind: "cohere", defaultModel: "command-a-vision-07-2025", keysUrl: "https://dashboard.cohere.com/api-keys", free: "chave de teste gratuita (uso limitado)" },
  openai: { secret: "OPENAI_API_KEY", kind: "openai", defaultModel: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1", keysUrl: "https://platform.openai.com/api-keys", free: "pago por uso" },
  anthropic: { secret: "ANTHROPIC_API_KEY", kind: "anthropic", defaultModel: "claude-haiku-5-5", keysUrl: "https://console.anthropic.com/settings/keys", free: "pago por uso" },
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
  const meta = PROVIDER_META[p];

  if (meta.kind === "gemini") {
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

  if (meta.kind === "anthropic") {
    const text = await post(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": key, "anthropic-version": "2023-06-01" },
      {
        model,
        max_tokens: 600,
        temperature: 0,
        system,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mime, data: b64 } },
              { type: "text", text: userText },
            ],
          },
        ],
      },
    );
    const j = JSON.parse(text) as { content?: { type?: string; text?: string }[] };
    const out = j.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("") ?? "";
    if (!out) throw new ProviderCallError("resposta vazia", "other", 200);
    return out;
  }

  if (meta.kind === "cohere") {
    const text = await post(
      "https://api.cohere.com/v2/chat",
      { Authorization: `Bearer ${key}` },
      {
        model,
        temperature: 0,
        max_tokens: 600,
        messages: [
          { role: "system", content: system },
          { role: "user", content: [{ type: "text", text: userText }, { type: "image_url", image_url: { url: dataUrl } }] },
        ],
      },
    );
    const j = JSON.parse(text) as { message?: { content?: { type?: string; text?: string }[] } };
    const out = j.message?.content?.map((c) => c.text ?? "").join("") ?? "";
    if (!out) throw new ProviderCallError("resposta vazia", "other", 200);
    return out;
  }

  // Grok, Groq, OpenRouter, Mistral, Together, Fireworks, NVIDIA, DeepInfra, Hugging Face e OpenAI
  // usam o formato "chat completions" da OpenAI.
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: meta.imageAsString ? dataUrl : { url: dataUrl } },
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
  const text = await post(`${meta.baseUrl}/chat/completions`, { Authorization: `Bearer ${key}` }, body);
  const j = JSON.parse(text) as { choices?: { message?: { content?: string | { text?: string }[] } }[] };
  const c = j.choices?.[0]?.message?.content;
  const out = typeof c === "string" ? c : Array.isArray(c) ? c.map((x) => x.text ?? "").join("") : "";
  if (!out) throw new ProviderCallError("resposta vazia", "other", 200);
  return out;
}

/** Teste barato da chave: lista modelos / consulta a conta (sem gastar crédito; "chat" usa 1 token). */
export async function pingProvider(p: AiProvider, key: string, model?: string): Promise<void> {
  const meta = PROVIDER_META[p];
  let url: string;
  let init: RequestInit = { signal: AbortSignal.timeout(15_000) };

  if (meta.kind === "gemini") {
    url = "https://generativelanguage.googleapis.com/v1beta/models";
    init = { ...init, headers: { "x-goog-api-key": key } };
  } else if (meta.kind === "anthropic") {
    url = "https://api.anthropic.com/v1/models";
    init = { ...init, headers: { "x-api-key": key, "anthropic-version": "2023-06-01" } };
  } else if (meta.kind === "cohere") {
    url = "https://api.cohere.com/v1/models";
    init = { ...init, headers: { Authorization: `Bearer ${key}` } };
  } else if (meta.ping === "chat") {
    // sem lista de modelos que confirme a chave: pergunta "ok" e aceita no máximo 1 token
    url = `${meta.baseUrl}/chat/completions`;
    init = {
      ...init,
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: model || meta.defaultModel, messages: [{ role: "user", content: "ok" }], max_tokens: 1 }),
    };
  } else {
    url = typeof meta.ping === "object" ? meta.ping.url : `${meta.baseUrl}/models`;
    init = { ...init, headers: { Authorization: `Bearer ${key}` } };
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ProviderCallError("sem resposta", "transient", null);
  }
  if (!res.ok) {
    const text = await res.text();
    let msg = text.slice(0, 200);
    try {
      const j = JSON.parse(text);
      msg = j?.error?.message ?? j?.error ?? j?.message ?? msg;
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
