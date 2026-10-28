// Lógica PURA da IA híbrida (sem acesso a banco/rede): detectar qual IA é pela chave,
// decidir a ordem de tentativa e classificar falhas. Fica separada para ser testada
// com `node --test` (tests/ai-routing.test.ts).

export type AiProvider = "gemini" | "grok" | "groq" | "openai";

export const PROVIDER_IDS: AiProvider[] = ["gemini", "grok", "groq", "openai"];
/** Ordem padrão: gratuito primeiro, pago por último. */
export const DEFAULT_ORDER: AiProvider[] = ["gemini", "grok", "groq", "openai"];

export const PROVIDER_LABEL: Record<AiProvider, string> = {
  gemini: "Google Gemini",
  grok: "Grok (xAI)",
  groq: "Groq",
  openai: "OpenAI",
};

export type DetectResult = { ok: true; provider: AiProvider; key: string } | { ok: false; error: string };

/** Descobre de qual IA é a chave colada, pelo formato. */
export function detectProvider(raw: string): DetectResult {
  const key = raw.trim().replace(/^["']|["']$/g, "");
  if (key.length < 20) return { ok: false, error: "Cole a chave completa." };
  if (/\s/.test(key)) return { ok: false, error: "A chave não pode ter espaços. Copie de novo, só a chave." };
  if (/^AIza[0-9A-Za-z_-]{30,}$/.test(key)) return { ok: true, provider: "gemini", key };
  if (/^xai-[A-Za-z0-9_-]{20,}$/.test(key)) return { ok: true, provider: "grok", key };
  if (/^gsk_[A-Za-z0-9]{20,}$/.test(key)) return { ok: true, provider: "groq", key };
  if (/^sk-ant-/.test(key)) {
    return { ok: false, error: "Essa é uma chave da Anthropic (Claude), que ainda não é suportada aqui. Use Gemini, Grok, Groq ou OpenAI." };
  }
  if (/^sk-[A-Za-z0-9_-]{20,}$/.test(key)) return { ok: true, provider: "openai", key };
  return { ok: false, error: "Não reconheci essa chave. Aceito Gemini (AIza…), Grok (xai-…), Groq (gsk_…) e OpenAI (sk-…)." };
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

const isProvider = (v: unknown): v is AiProvider => typeof v === "string" && (PROVIDER_IDS as string[]).includes(v);

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

export type Failure = "credit" | "rate" | "invalid" | "model" | "transient" | "other";

const CREDIT_RE = /insufficient_quota|exceeded your current quota|billing|credit|balance|payment required|spending limit|out of funds/i;

/** Classifica uma resposta de erro da IA para decidir o que fazer. */
export function classifyFailure(httpStatus: number | null, body: string): Failure {
  if (httpStatus === null) return "transient"; // timeout / sem conexão
  if (httpStatus === 402) return "credit";
  if (CREDIT_RE.test(body) && [400, 403, 429].includes(httpStatus)) return "credit";
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
      message: error.failure === "model" ? "modelo indisponível (ajuste o modelo)" : error.message.slice(0, 120),
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
