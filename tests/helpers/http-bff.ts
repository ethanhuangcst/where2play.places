import { NextRequest } from "next/server";

const DEFAULT_HOST = "localhost:3030";
const DEFAULT_ORIGIN = "http://localhost:3030";

export function bffRequest(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    origin?: string;
    host?: string;
    cookie?: string;
    headers?: Record<string, string>;
  } = {},
): NextRequest {
  const method = init.method ?? "GET";
  const headers: Record<string, string> = {
    host: init.host ?? DEFAULT_HOST,
    ...(init.headers ?? {}),
  };
  if (method !== "GET") {
    headers.origin = init.origin ?? DEFAULT_ORIGIN;
    headers["content-type"] = headers["content-type"] ?? "application/json";
  }
  if (init.cookie) headers.cookie = init.cookie;

  return new NextRequest(`${DEFAULT_ORIGIN}${path}`, {
    method,
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

export async function readJson<T = unknown>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function invokeRoute(
  handler: (request: NextRequest) => Promise<Response | undefined>,
  request: NextRequest,
): Promise<Response> {
  const response = await handler(request);
  if (!response) throw new Error("route returned no response");
  return response;
}
