import { resolveChatLlmConfig } from "./llm-chat-config";

/** Chat completions base URL — Qwen compatible-mode first (ADR-047). */
export function openaiApiBaseUrl(): string {
  const cfg = resolveChatLlmConfig();
  if (cfg?.baseURL) return cfg.baseURL;
  return "https://quanzil.com/v1";
}
