export function resolveErrorKey(key: string): string {
  if (key.startsWith("errors.")) {
    return `play.errors.${key.slice("errors.".length)}`;
  }
  return key;
}
