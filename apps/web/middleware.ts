import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

const PROTECTED_PATHS = ["/dashboard", "/settings", "/usage", "/sales"];

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  // Check if path is protected (starts with /(app)/* routes)
  const isProtectedPath = PROTECTED_PATHS.some(path => pathname.startsWith(path));

  if (isProtectedPath) {
    // Check if user has a session by looking for supabase session token
    const supabaseSession = request.cookies.get("sb-session") || request.cookies.get("sb-auth-token");

    if (!supabaseSession) {
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
