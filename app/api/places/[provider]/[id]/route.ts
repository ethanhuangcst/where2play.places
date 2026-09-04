import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/src/auth/user";
import { normalizeLocale } from "@/src/core/locales";
import { getPlaceDetails } from "@/src/places-agent/client";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ provider: string; id: string }> },
) {
  const gate = await requireUser(request);
  if ("error" in gate) return gate.error;

  const { provider, id } = await ctx.params;
  const locale = normalizeLocale(request.nextUrl.searchParams.get("locale") ?? gate.user.locale);
  const res = await getPlaceDetails({
    provider,
    native_id: decodeURIComponent(id),
    locale,
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: { key: res.outcome?.key ?? "errors.provider_failed" } },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, data: res.data });
}
