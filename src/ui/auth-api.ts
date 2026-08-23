"use client";

export class AuthApiError extends Error {
  key: string;
  field?: string;
  fields?: Record<string, string>;
  body?: unknown;
  constructor(key: string, field?: string, fields?: Record<string, string>, body?: unknown) {
    super(key);
    this.key = key;
    this.field = field;
    this.fields = fields;
    this.body = body;
  }
}

export function errorKeyFromBody(body: unknown): {
  key: string;
  field?: string;
  fields?: Record<string, string>;
} {
  if (body && typeof body === "object" && "error" in body) {
    const err = (
      body as { error?: { key?: string; field?: string; fields?: Record<string, string> } }
    ).error;
    if (err?.key) return { key: err.key, field: err.field, fields: err.fields };
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
    const { key, field, fields } = errorKeyFromBody(body);
    throw new AuthApiError(key, field, fields, body);
  }
  return body as T;
}

/** Consume application/x-ndjson plan progress events (ADR-032 day-by-day). */
export async function authNdjsonEvents<T extends { type: string }>(
  url: string,
  init: RequestInit | undefined,
  onEvent: (event: T) => void,
): Promise<void> {
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/x-ndjson",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const { key, field, fields } = errorKeyFromBody(body);
    throw new AuthApiError(key, field, fields, body);
  }
  if (!res.body) {
    throw new AuthApiError("errors.provider_failed");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl = buffer.indexOf("\n");
    while (nl >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) {
        try {
          onEvent(JSON.parse(line) as T);
        } catch {
          throw new AuthApiError("errors.provider_failed");
        }
      }
      nl = buffer.indexOf("\n");
    }
  }
  const tail = buffer.trim();
  if (tail) {
    onEvent(JSON.parse(tail) as T);
  }
}
