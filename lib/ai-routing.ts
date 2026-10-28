// Lógica PURA da IA híbrida (sem acesso a banco/rede): detectar qual IA é pela chave,
// decidir a ordem de tentativa e classificar falhas. Fica separada para ser testada
// com `node --test` (tests/ai-routing.test.ts).

export const PROVIDER_IDS = [
  "gemini",
  "grok",
  "groq",
  "openrouter",
  "mistral",
  "together",
  "fireworks",
  "nvidia",
  "deepinfra",
  "huggingface",
  "cohere",
  "openai",
  "anthropic",
] as const;
export type AiProvider = (typeof PROVIDER_IDS)[number];

/** Ordem padrão: as que costumam ter faixa gratuita primeiro, as pagas por último. */
export const DEFAULT_ORDER: AiProvider[] = [...PROVIDER_IDS];

export const PROVIDER_LABEL: Record<AiProvider, string> = {
  gemini: "Google Gemini",
  grok: "Grok (xAI)",
  groq: "Groq",
  openrouter: "OpenRouter",
  mistral: "Mistral",
  together: "Together AI",
  fireworks: "Fireworks AI",
  nvidia: "NVIDIA NIM",
  deepinfra: "DeepInfra",
  huggingface: "Hugging Face",
  cohere: "Cohere",
  openai: "OpenAI",
  anthropic: "Claude (Anthropic)",
};

/** Limpa a chave colada (aspas, espaços nas pontas) e recusa o que claramente não é uma chave. */
export function cleanKey(raw: string): { ok: true; key: string } | { ok: false; error: string } {
  const key = raw.trim().replace(/^["']|["']$/g, "");
  if (key.length < 20) return { ok: false, error: "Cole a chave completa." };
  if (key.length > 400) return { ok: false, error: "Esse texto é grande demais para ser uma chave." };
  if (/\s/.test(key)) return { ok: false, error: "A chave não pode ter espaços ou quebras de linha. Copie de novo, só a chave." };
  return { ok: true, key };
}

export type DetectResult = { ok: true; provider: AiProvider; key: string } | { ok: false; error: string };

// Formato de cada chave. Ordem importa: "sk-ant-" e "sk-or-v1-" vêm antes do "sk-" genérico da OpenAI.
// Mistral, Cohere e DeepInfra usam chaves sem prefixo: nesses casos a tela pede para escolher a IA.
const DETECTORS: [AiProvider, RegExp][] = [
  ["gemini", /^AIza[0-9A-Za-z_-]{30,}$/],
  ["gemini", /^AQ\.[A-Za-z0-9_.-]{30,}$/], // formato novo do Google AI Studio
  ["grok", /^xai-[A-Za-z0-9_-]{20,}$/],
  ["groq", /^gsk_[A-Za-z0-9]{20,}$/],
  ["anthropic", /^sk-ant-[A-Za-z0-9_-]{20,}$/],
  ["openrouter", /^sk-or-v1-[A-Za-z0-9_-]{20,}$/],
  ["fireworks", /^fw_[A-Za-z0-9]{20,}$/],
  ["huggingface", /^hf_[A-Za-z0-9]{20,}$/],
  ["nvidia", /^nvapi-[A-Za-z0-9_-]{20,}$/],
  ["together", /^[a-f0-9]{64}$/],
  ["openai", /^sk-[A-Za-z0-9_-]{20,}$/],
];

/** Descobre de qual IA é a chave colada, pelo formato. */
export function detectProvider(raw: string): DetectResult {
  const c = cleanKey(raw);
  if (!c.ok) return c;
  for (const [provider, re] of DETECTORS) if (re.test(c.key)) return { ok: true, provider, key: c.key };
  return { ok: false, error: "Não reconheci o formato dessa chave. Escolha de qual IA ela é na lista que aparece abaixo do campo." };
}

export type ProviderState = {
  state: "ok" | "limit" | "invalid" | "error";
  /** até quando esperar antes de tentar de novo (só para "limit") */
  until?: string;
  message?: string;
  at: string;
  lastOkAt?: string;
};

export type AiConfig = {
  order: AiProvider[];
  disabled: AiProvider[];
  models: Partial<Record<AiProvider, string>>;
  status: Partial<Record<AiProvider, ProviderState>>;
  lastUsed?: { provider: AiProvider; at: string };
};

const isProvider = (v: unknown): v is AiProvider => typeof v === "string" && (PROVIDER_IDS as readonly string[]).includes(v);

/** Lê a configuração salva (JSON qualquer) e devolve uma válida e completa. */
export function normalizeConfig(raw: unknown): AiConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<AiConfig>;
  const order = Array.isArray(r.order) ? r.order.filter(isProvider) : [];
  // garante que todas as IAs existam na ordem, mesmo as novas
  const full = [...new Set([...order, ...DEFAULT_ORDER])];
  return {
    order: full,
    disabled: Array.isArray(r.disabled) ? r.disabled.filter(isProvider) : [],
    models: r.models && typeof r.models === "object" ? r.models : {},
    status: r.status && typeof r.status === "object" ? r.status : {},
    lastUsed: r.lastUsed && isProvider(r.lastUsed.provider) ? r.lastUsed : undefined,
  };
}

export type Failure = "credit" | "rate" | "invalid" | "model" | "transient" | "empty" | "other";

const CREDIT_RE = /insufficient_quota|exceeded your current quota|billing|credit|balance|payment required|spending limit|out of funds/i;

/** Classifica uma resposta de erro da IA para decidir o que fazer. */
export function classifyFailure(httpStatus: number | null, body: string): Failure {
  if (httpStatus === null) return "transient"; // timeout / sem conexão
  if (httpStatus === 402) return "credit";
  if (CREDIT_RE.test(body) && [400, 403, 429].includes(httpStatus)) return "credit";
  // modelo aposentado (ex.: "no longer available to new users"): não é chave inválida
  if ([400, 403, 404].includes(httpStatus) && /no longer available|no longer supported|decommission|deprecated|retired|is not found for api version|model.{0,40}(not found|does not exist)|not a valid model|model_not_found|no endpoints found/i.test(body)) return "model";
  if (httpStatus === 429 || /RESOURCE_EXHAUSTED/i.test(body)) return "rate";
  if (httpStatus === 401 || httpStatus === 403) return "invalid";
  if (httpStatus === 404 || (httpStatus === 400 && /model/i.test(body) && /not found|does not exist|unsupported|deprecated/i.test(body))) return "model";
  if (httpStatus >= 500) return "transient";
  return "other";
}

/** Quanto tempo uma IA sem crédito/limite fica de molho antes de tentarmos de novo. */
export const COOLDOWN_MS: Record<"credit" | "rate", number> = {
  credit: 3 * 60 * 60 * 1000,
  rate: 15 * 60 * 1000,
};

export type Candidates = { first: AiProvider[]; later: AiProvider[] };

/**
 * Ordem de tentativa. `first`: ativas, com chave, sem chave inválida e fora do "de molho".
 * `later`: ativas com chave que estão de molho (última chance se todas as outras falharem).
 */
export function pickCandidates(cfg: AiConfig, hasKey: (p: AiProvider) => boolean, now: number): Candidates {
  const first: AiProvider[] = [];
  const later: AiProvider[] = [];
  for (const p of cfg.order) {
    if (cfg.disabled.includes(p) || !hasKey(p)) continue;
    const st = cfg.status[p];
    if (st?.state === "invalid") continue;
    const resting = st?.state === "limit" && st.until && Date.parse(st.until) > now;
    (resting ? later : first).push(p);
  }
  return { first, later };
}

// ---------------------------------------------------------------- troca automática
export type CallError = { failure: Failure; message: string };
export type Attempt = { provider: AiProvider; error: CallError };

/** Atualiza o estado de uma IA depois de uma tentativa (sucesso ou falha). */
export function applyOutcome(cfg: AiConfig, p: AiProvider, error: CallError | null, now = Date.now()): AiConfig {
  const at = new Date(now).toISOString();
  const prev = cfg.status[p];
  const next: AiConfig = { ...cfg, status: { ...cfg.status } };
  if (!error) {
    next.status[p] = { state: "ok", at, lastOkAt: at };
    next.lastUsed = { provider: p, at };
    return next;
  }
  const lastOkAt = prev?.lastOkAt;
  if (error.failure === "credit" || error.failure === "rate") {
    next.status[p] = {
      state: "limit",
      until: new Date(now + COOLDOWN_MS[error.failure]).toISOString(),
      message: error.failure === "credit" ? "créditos/cota esgotados" : "limite de uso atingido",
      at,
      lastOkAt,
    };
  } else if (error.failure === "invalid") {
    next.status[p] = { state: "invalid", message: "chave recusada pela IA", at, lastOkAt };
  } else {
    next.status[p] = {
      state: "error",
      message:
        error.failure === "model" ? "modelo indisponível (ajuste o modelo)"
        : error.failure === "transient" ? "sobrecarregada ou sem resposta agora (temporário)"
        : error.failure === "empty" ? "o modelo não devolveu texto (vou tentar outro)"
        : error.message.slice(0, 120),
      at,
      lastOkAt,
    };
  }
  return next;
}

export type OrchestrateDeps = {
  load: () => Promise<AiConfig>;
  save: (cfg: AiConfig) => Promise<void>;
  hasKey: Record<AiProvider, boolean>;
  getKey: (p: AiProvider) => Promise<string | null>;
  modelFor: (cfg: AiConfig, p: AiProvider) => string;
  now: () => number;
};

const asCallError = (e: unknown): CallError => {
  const f = (e as { failure?: Failure } | null)?.failure;
  return { failure: f ?? "other", message: e instanceof Error ? e.message : "erro" };
};

/**
 * Tenta `fn` na primeira IA disponível; se falhar por falta de crédito, chave inválida ou
 * indisponibilidade, passa para a próxima, registrando o estado de cada uma.
 * `isFatal`: erros em que trocar de IA não adianta (ex.: foto ilegível) — são relançados.
 */
export async function orchestrate<T>(
  deps: OrchestrateDeps,
  fn: (p: AiProvider, key: string, model: string) => Promise<T>,
  isFatal: (e: unknown) => boolean = () => false,
): Promise<{ value: T; provider: AiProvider } | { attempts: Attempt[]; none: boolean }> {
  let cfg = await deps.load();
  const started = deps.now();
  const { first, later } = pickCandidates(cfg, (p) => deps.hasKey[p], started);
  const queue = [...first, ...later];
  const attempts: Attempt[] = [];

  for (const p of queue) {
    if (deps.now() - started > 40_000) break; // não estoura o tempo da função
    const key = await deps.getKey(p);
    if (!key) continue;
    try {
      const value = await fn(p, key, deps.modelFor(cfg, p));
      cfg = applyOutcome(cfg, p, null, deps.now());
      await deps.save(cfg).catch(() => undefined);
      return { value, provider: p };
    } catch (e) {
      if (isFatal(e)) throw e;
      const error = asCallError(e);
      attempts.push({ provider: p, error });
      cfg = applyOutcome(cfg, p, error, deps.now());
    }
  }
  if (attempts.length) await deps.save(cfg).catch(() => undefined);
  return { attempts, none: queue.length === 0 };
}

// ---------------------------------------------------------------- modelo do Gemini
export type GeminiModelInfo = { name: string; methods?: string[] };

/**
 * Ordena os modelos "flash" do Gemini que a conta enxerga, do mais novo para o mais antigo
 * (estável antes de preview). Os nomes do Google mudam a cada poucos meses (2.5 → 3.8 …) e modelos
 * antigos saem do ar para contas novas; por isso o sistema descobre sozinho em vez de usar nome fixo.
 */
export function rankGeminiModels(list: GeminiModelInfo[]): string[] {
  const BAD = /lite|8b|image|tts|live|audio|embed|thinking|robotics|computer|learnlm|gemma|aqa|imagen|veo|native/i;
  const candidates = list
    .filter((m) => /^models\/gemini-\d/.test(m.name) && /flash/.test(m.name) && !BAD.test(m.name))
    .filter((m) => !m.methods || m.methods.includes("generateContent"))
    .map((m) => {
      const id = m.name.replace(/^models\//, "");
      const version = Number(/^gemini-(\d+(?:\.\d+)?)/.exec(id)?.[1] ?? 0);
      const preview = /preview|exp|latest\b/i.test(id) && !/latest$/i.test(id) ? 1 : 0; // estável vale mais que preview
      return { id, version, preview };
    });
  candidates.sort((a, b) => b.version - a.version || a.preview - b.preview || a.id.length - b.id.length);
  return candidates.map((c) => c.id);
}

/** O flash mais novo (ou null). */
export function pickGeminiModel(list: GeminiModelInfo[]): string | null {
  return rankGeminiModels(list)[0] ?? null;
}

// ---------------------------------------------------------------- escolha de modelo (todas as IAs)
export type ModelInfo = {
  id: string;
  /** timestamp em segundos (quando a IA informa) — usado para preferir o mais novo */
  created?: number;
  /** a IA diz explicitamente que o modelo lê imagem */
  vision?: boolean;
  /** modelo gratuito (OpenRouter) */
  free?: boolean;
};

const NOT_CHAT = /embed|whisper|tts|audio|speech|guard|moderat|rerank|transcri|realtime|dall|flux|stable|image-gen|imagen|sora|video|search|instruct-turbo-ft|bge|e5-/i;
const VISION_HINT = /vl\b|-vl-|vision|llava|pixtral|molmo|llama-?4|gemma-?3|qwen.*vl|phi-.*vision|paligemma|internvl|minicpm-v/i;
const byNewest = (a: ModelInfo, b: ModelInfo) => (b.created ?? 0) - (a.created ?? 0);

const AVOID = /safety|guard|lyria|veo|music|moderation|reasoning|thinking|-r1\b|\bo[13]\b|omni|note-preview/i;

/** Famílias de modelo que já se mostraram boas em ler nota/recibo, da melhor para a pior. */
const TRUSTED: RegExp[] = [
  /gemini.*flash/i,
  /gemma-?\d.*-it/i,
  /qwen.*vl/i,
  /llama.*(vision|-4-|4-)/i,
  /mistral.*(small|medium)|pixtral/i,
  /gpt-.*mini/i,
  /claude.*haiku/i,
];
const familyRank = (id: string) => {
  const i = TRUSTED.findIndex((re) => re.test(id));
  return i === -1 ? TRUSTED.length : i;
};
/** Ordena: família confiável primeiro; dentro dela, o mais novo. */
const byTrust = (a: ModelInfo, b: ModelInfo) => familyRank(a.id) - familyRank(b.id) || byNewest(a, b);
const ids = (xs: ModelInfo[]) => [...new Set(xs.map((m) => m.id))];

/**
 * Lista, do melhor para o pior, os modelos que LEEM IMAGEM entre os que a chave enxerga.
 * Os nomes mudam o tempo todo e modelos antigos são aposentados; por isso o sistema procura em vez de
 * depender de um nome fixo. Modelos "de raciocínio" ficam por último/fora (gastam o limite pensando e
 * devolvem resposta vazia) e o mais novo NÃO é automaticamente o melhor: famílias já testadas vêm antes.
 */
export function rankVisionModels(provider: AiProvider, models: ModelInfo[]): string[] {
  const list = models.filter((m) => m.id && !NOT_CHAT.test(m.id) && !AVOID.test(m.id));

  switch (provider) {
    case "openrouter": {
      const vision = list.filter((m) => m.vision);
      const free = vision.filter((m) => m.free || /:free$/.test(m.id)).sort(byTrust);
      const cheap = vision.filter((m) => !free.includes(m) && /gemini.*flash|gpt-.*mini|haiku/.test(m.id)).sort(byNewest);
      return ids([...free, ...cheap]);
    }
    case "mistral": {
      const vision = list.filter((m) => m.vision).sort(byNewest);
      return ids([...vision.filter((m) => /small/.test(m.id)), ...vision.filter((m) => /medium/.test(m.id)), ...vision]);
    }
    case "groq": {
      const out: ModelInfo[] = [];
      for (const re of [/llama-4-scout/, /llama-4-maverick/, /vision/, /llava/]) out.push(...list.filter((m) => re.test(m.id)).sort(byNewest));
      out.push(...list.filter((m) => VISION_HINT.test(m.id)).sort(byTrust));
      return ids(out);
    }
    case "grok":
      return ids(list.filter((m) => /vision|grok-[4-9]/.test(m.id) && !/image|imagine/.test(m.id)).sort(byNewest));
    case "openai": {
      const have = new Set(list.map((m) => m.id));
      return ["gpt-5-mini", "gpt-4.1-mini", "gpt-4o-mini"].filter((id) => have.has(id));
    }
    case "anthropic": {
      const claude = list.filter((m) => m.id.startsWith("claude-")).sort(byNewest);
      return ids([...claude.filter((m) => /haiku/.test(m.id)), ...claude.filter((m) => /sonnet/.test(m.id))]);
    }
    case "cohere":
      return ids(list.filter((m) => /vision/.test(m.id)).sort(byNewest));
    case "gemini": {
      const r = rankGeminiModels(list.map((m) => ({ name: m.id.startsWith("models/") ? m.id : `models/${m.id}` })));
      return r;
    }
    default: {
      // together, fireworks, nvidia, deepinfra, huggingface
      const hit = list.filter((m) => VISION_HINT.test(m.id));
      const instruct = hit.filter((m) => /instruct|chat|it\b/i.test(m.id));
      return ids([...instruct.sort(byTrust), ...hit.sort(byTrust)]);
    }
  }
}

/** O melhor modelo com leitura de imagem (ou null). */
export function pickVisionModel(provider: AiProvider, models: ModelInfo[]): string | null {
  return rankVisionModels(provider, models)[0] ?? null;
}
