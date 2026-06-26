import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAuthConfigured, getSupabaseAuthClient } from "@/lib/auth/supabase-ssr";
import { ADMIN_COOKIE } from "@/lib/admin/auth";

// Signs out of both the Supabase session and the dev admin gate, then returns home.
async function signOut(req: NextRequest) {
  if (isAuthConfigured()) {
    const supabase = getSupabaseAuthClient();
    await supabase.auth.signOut();
  }
  cookies().delete(ADMIN_COOKIE);
  return NextResponse.redirect(new URL("/", req.url));
}

export async function GET(req: NextRequest) {
  return signOut(req);
}

export async function POST(req: NextRequest) {
  return signOut(req);
}
