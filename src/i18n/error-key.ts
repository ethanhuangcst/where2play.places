export function resolveErrorKey(key: unknown): string {
  if (typeof key !== "string" || !key.trim()) {
    return "play.errors.provider_failed";
  }
  if (key.startsWith("errors.")) {
    return `play.errors.${key.slice("errors.".length)}`;
  }
  return key;
}
