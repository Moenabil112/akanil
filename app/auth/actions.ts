"use server";

import { redirect } from "next/navigation";
import { isAuthConfigured, getSupabaseAuthClient } from "@/lib/auth/supabase-ssr";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/data-room");

  if (!isAuthConfigured()) {
    redirect("/auth/sign-in?error=not_configured");
  }

  const supabase = getSupabaseAuthClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/auth/sign-in?error=invalid&next=${encodeURIComponent(next)}`);
  }

  redirect(next.startsWith("/") ? next : "/data-room");
}

export async function signOutAction() {
  if (isAuthConfigured()) {
    const supabase = getSupabaseAuthClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
