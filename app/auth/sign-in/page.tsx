import type { Metadata } from "next";
import Link from "next/link";
import { AkanilMark } from "@/components/logo";
import { signInAction } from "@/app/auth/actions";
import { isAuthConfigured } from "@/lib/auth/supabase-ssr";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sign In",
  robots: { index: false, follow: false },
};

export default function SignInPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  const configured = isAuthConfigured();

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <AkanilMark className="h-10 w-10 text-gold" />
          <h1 className="heading-md mt-4 text-ivory">Institutional Sign In</h1>
          <p className="mt-1 text-sm text-atlas-grey">
            Access your controlled data room.
          </p>
        </div>

        {!configured && (
          <div className="mb-5 rounded-md border border-copper/40 bg-copper/10 px-4 py-3 text-sm text-copper-light">
            Authentication is not configured in this environment. Set the Supabase
            URL and anon key to enable sign in. Administrators can use the{" "}
            <Link href="/admin/login" className="underline">
              admin gate
            </Link>{" "}
            in development.
          </div>
        )}

        {searchParams.error === "invalid" && (
          <div className="mb-5 rounded-md border border-copper/40 bg-copper/10 px-4 py-3 text-sm text-copper-light">
            Invalid email or password.
          </div>
        )}
        {searchParams.error === "not_configured" && (
          <div className="mb-5 rounded-md border border-copper/40 bg-copper/10 px-4 py-3 text-sm text-copper-light">
            Sign in is unavailable until Supabase Auth is configured.
          </div>
        )}

        <form
          action={signInAction}
          className="space-y-4 rounded-xl border border-atlas-line bg-obsidian-800 p-6"
        >
          <input type="hidden" name="next" value={searchParams.next || "/data-room"} />
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ivory-muted">
              Email
            </label>
            <input id="email" name="email" type="email" required
              className="w-full rounded-md border border-atlas-line bg-obsidian-900 px-3.5 py-2.5 text-sm text-ivory outline-none focus:border-gold/60" />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ivory-muted">
              Password
            </label>
            <input id="password" name="password" type="password" required
              className="w-full rounded-md border border-atlas-line bg-obsidian-900 px-3.5 py-2.5 text-sm text-ivory outline-none focus:border-gold/60" />
          </div>
          <button type="submit" disabled={!configured}
            className="w-full rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-obsidian transition-colors hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-50">
            Sign in
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-atlas-grey/70">
          Don’t have access yet?{" "}
          <Link href="/data-room" className="text-gold hover:underline">
            Apply for data room access
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
