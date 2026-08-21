import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE } from "@/src/auth/cookie-names";

const PROTECTED = ["/plan", "/saved", "/profile"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  const token = request.cookies.get(COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/plan", "/plan/:path*", "/profile", "/profile/:path*", "/saved", "/saved/:path*"],
};
