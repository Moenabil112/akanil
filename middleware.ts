import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifySession } from "@/lib/admin/auth";

// Gate every /admin route except the login page. This is the first line of
// defense; authoritative role checks run in the admin layout and server actions
// via getAdminUser(). A request is allowed through if EITHER the dev HMAC admin
// cookie is valid, OR a Supabase auth session cookie is present (its role is
// then verified in-page). Data Room routes are guarded in-page so anonymous
// visitors still see the public request page.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  const devValid = await verifySession(req.cookies.get(ADMIN_COOKIE)?.value);
  const hasSupabaseSession = req.cookies
    .getAll()
    .some((c) => /^sb-.*-auth-token/.test(c.name));

  if (!devValid && !hasSupabaseSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
