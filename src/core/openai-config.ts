/** Normalize operator Quanzil gateway base URL for `/chat/completions`. */
export function openaiApiBaseUrl(): string {
  const raw = (process.env.OPENAI_BASE_URL ?? "https://quanzil.com/v1").trim();
  let base = raw.replace(/\/+$/, "");
  if (!base) return "https://quanzil.com/v1";
  if (base.endsWith("/v1")) return base;

  try {
    const u = new URL(base);
    if (!u.pathname || u.pathname === "/") {
      return `${base}/v1`;
    }
  } catch {
    return "https://quanzil.com/v1";
  }

  return base;
}
