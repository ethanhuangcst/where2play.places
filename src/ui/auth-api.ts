"use client";

export class AuthApiError extends Error {
  key: string;
  field?: string;
  constructor(key: string, field?: string) {
    super(key);
    this.key = key;
    this.field = field;
  }
}

export function errorKeyFromBody(body: unknown): { key: string; field?: string } {
  if (body && typeof body === "object" && "error" in body) {
    const err = (body as { error?: { key?: string; field?: string } }).error;
    if (err?.key) return { key: err.key, field: err.field };
  }
  return { key: "errors.validation" };
}

export async function authJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const { key, field } = errorKeyFromBody(body);
    throw new AuthApiError(key, field);
  }
  return body as T;
}
