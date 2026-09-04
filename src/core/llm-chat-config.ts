export type ChatLlmProvider = "qwen" | "openai_cn";

export type ChatLlmConfig = {
  provider: ChatLlmProvider;
  apiKey: string;
  baseURL: string;
  model: string;
};

function normalizeCompatibleBase(raw: string | undefined, fallback: string): string {
  const trimmed = (raw ?? "").trim();
  let base = trimmed.replace(/\/+$/, "");
  if (!base) return fallback;
  if (base.endsWith("/v1")) return base;
  try {
    const u = new URL(base);
    if (!u.pathname || u.pathname === "/") return `${base}/v1`;
  } catch {
    return fallback;
  }
  return base;
}

function firstFallbackModel(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const first = raw.split("/")[0]?.trim();
  return first || undefined;
}

/** Prefer Qwen (ADR-047). Fall back to OPENAI_CN when QWEN_API_KEY is empty. */
export function resolveChatLlmConfig(
  env: NodeJS.ProcessEnv = process.env,
): ChatLlmConfig | null {
  const qwen = env.QWEN_API_KEY?.trim();
  if (qwen && qwen !== "fixture") {
    return {
      provider: "qwen",
      apiKey: qwen,
      baseURL: normalizeCompatibleBase(env.QWEN_BASE_URL, ""),
      model: env.QWEN_CHAT_MODEL?.trim() || firstFallbackModel(env.QWEN_CHAT_MODEL_FALLBACK) || "qwen-plus",
    };
  }
  const openai = env.OPENAI_API_KEY?.trim();
  if (!openai || openai === "fixture") return null;
  return {
    provider: "openai_cn",
    apiKey: openai,
    baseURL: normalizeCompatibleBase(env.OPENAI_BASE_URL, "https://quanzil.com/v1"),
    model: env.OPENAI_CHAT_MODEL?.trim() || "gpt-5.4",
  };
}

export function chatLlmConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveChatLlmConfig(env) != null;
}
