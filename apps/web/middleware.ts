import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

const PROTECTED_PATHS = [
  "/dashboard",
  "/settings",
  "/usage",
  "/sales",
  "/playground",
  "/keys",
  "/reference",
  "/billing",
];

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  // Check if path is protected (starts with /(app)/* routes)
  const isProtectedPath = PROTECTED_PATHS.some(path => pathname.startsWith(path));

  if (isProtectedPath) {
    // Supabase SSR uses project-scoped auth cookie names (e.g. sb-<ref>-auth-token).
    const hasSupabaseAuthCookie = request.cookies
      .getAll()
      .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));

    if (!hasSupabaseAuthCookie) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
