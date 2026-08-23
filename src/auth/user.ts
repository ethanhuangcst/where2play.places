import "server-only";
import { NextResponse } from "next/server";
import { readSession } from "./session";
import { csrfOk } from "./csrf";
import { prisma } from "../db/client";

export function authError(key: string, status = 400, field?: string) {
  return NextResponse.json({ error: { key, ...(field ? { field } : {}) } }, { status });
}

export async function requireUser(request: Request) {
  if (request.method !== "GET" && !csrfOk(request)) {
    return { error: authError("errors.csrf", 403) as NextResponse };
  }
  const session = await readSession();
  if (!session) {
    return { error: authError("errors.session_expired", 401) as NextResponse };
  }
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { interestProfile: true },
  });
  if (!user) {
    return { error: authError("errors.session_expired", 401) as NextResponse };
  }
  return { user };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function displayName(name: string): string {
  return name.trim() || "User";
}
