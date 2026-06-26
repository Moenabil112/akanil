import type { Metadata } from "next";
import { AkanilMark } from "@/components/logo";
import { loginAction } from "@/app/admin/actions";
import { isAdminConfigured } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Sign In",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  const configured = isAdminConfigured();

  return (
    <div className="flex min-h-screen items-center justify-center bg-obsidian px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <AkanilMark className="h-10 w-10 text-gold" />
          <h1 className="heading-md mt-4 text-ivory">Akanil Admin Console</h1>
          <p className="mt-1 text-sm text-atlas-grey">
            Authorized institutional access only.
          </p>
        </div>

        {!configured && (
          <div className="mb-5 rounded-md border border-copper/40 bg-copper/10 px-4 py-3 text-sm text-copper-light">
            Admin access is not configured. Set{" "}
            <code>ADMIN_DASHBOARD_PASSWORD</code> (and optionally{" "}
            <code>ADMIN_ALLOWED_EMAILS</code>) to enable sign in.
          </div>
        )}

        {searchParams.error && (
          <div className="mb-5 rounded-md border border-copper/40 bg-copper/10 px-4 py-3 text-sm text-copper-light">
            Invalid credentials. Please try again.
          </div>
        )}

        <form
          action={loginAction}
          className="space-y-4 rounded-xl border border-atlas-line bg-obsidian-800 p-6"
        >
          <input type="hidden" name="next" value={searchParams.next || "/admin"} />
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ivory-muted">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-md border border-atlas-line bg-obsidian-900 px-3.5 py-2.5 text-sm text-ivory outline-none focus:border-gold/60"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ivory-muted">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full rounded-md border border-atlas-line bg-obsidian-900 px-3.5 py-2.5 text-sm text-ivory outline-none focus:border-gold/60"
            />
          </div>
          <button
            type="submit"
            disabled={!configured}
            className="w-full rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-obsidian transition-colors hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sign in
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-atlas-grey/70">
          Phase 2A session gate. Full Supabase Auth + RBAC arrives in Phase 3.
        </p>
      </div>
    </div>
  );
}
