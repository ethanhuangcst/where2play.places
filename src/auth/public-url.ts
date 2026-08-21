export function absoluteAppUrl(path: string): string {
  const base = (process.env.PUBLIC_BASE_URL ?? "http://localhost:3030").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function setPasswordUrl(token: string): string {
  return absoluteAppUrl(`/set-password?token=${encodeURIComponent(token)}`);
}
