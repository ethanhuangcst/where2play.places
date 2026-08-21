export function csrfOk(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");
  if (!host) return false;
  const allowed = new Set([`http://${host}`, `https://${host}`]);
  const devOrigins =
    process.env.ALLOWED_DEV_ORIGINS?.split(",")
      .map((v) => v.trim())
      .filter(Boolean) ?? [];
  for (const dev of devOrigins) {
    allowed.add(`http://${dev}`);
    allowed.add(`https://${dev}`);
  }
  if (origin) return allowed.has(origin);
  if (referer) {
    try {
      const url = new URL(referer);
      return allowed.has(url.origin);
    } catch {
      return false;
    }
  }
  return false;
}
