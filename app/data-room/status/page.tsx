import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section, Eyebrow } from "@/components/ui";
import { WindowAccessCards } from "@/components/data-room/window-cards";
import { getSessionUser } from "@/lib/auth/session";
import { getWindowAccessSummary } from "@/lib/data-room";
import { ndaSatisfied } from "@/lib/auth/roles";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { ADMIN_ROLES } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Access Status",
  robots: { index: false, follow: false },
};

export default async function StatusPage() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <Section className="flex min-h-[60vh] items-center">
        <div className="mx-auto max-w-md text-center">
          <Eyebrow>
            <span className="mx-auto">Restricted</span>
          </Eyebrow>
          <h1 className="heading-lg mt-4 text-ivory">Your Access Status</h1>
          <p className="mt-4 text-atlas-grey">
            Sign in to view your institutional access status, approved windows,
            and NDA state.
          </p>
          <Link
            href="/auth/sign-in?next=/data-room/status"
            className="mt-7 inline-block rounded-md bg-gold px-6 py-3 text-sm font-semibold text-obsidian transition-colors hover:bg-gold-light"
          >
            Sign in
          </Link>
        </div>
      </Section>
    );
  }

  const windows = await getWindowAccessSummary(user);

  // Pending / recent access requests for this user (by email).
  let requests: { requested_window: string | null; requested_level: string | null; status: string; created_at: string }[] = [];
  if (isSupabaseConfigured() && user.email) {
    const { data } = await getServiceClient()
      .from("access_requests")
      .select("requested_window, requested_level, status, created_at")
      .eq("email", user.email)
      .order("created_at", { ascending: false })
      .limit(10);
    requests = data ?? [];
  }

  const ndaOk = ndaSatisfied(user.ndaStatus);
  const roleLabel = ADMIN_ROLES.find((r) => r.value === user.role)?.label;

  return (
    <>
      <PageHeader
        eyebrow="Your Access"
        title="Access Status"
        intro="A live view of your institutional access, approved windows, NDA state, and pending requests."
        accent="teal"
        badge="Controlled Institutional Access Layer"
      />

      <Section>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatusTile label="Signed in as" value={user.email} />
          <StatusTile label="NDA status" value={user.ndaStatus ?? "pending"} ok={ndaOk} warn={!ndaOk} />
          <StatusTile label="Role" value={roleLabel ?? "Institutional user"} />
        </div>

        {!ndaOk && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-gold/40 bg-gold/10 px-5 py-4 text-sm text-gold">
            <span>An approved NDA is required to access NDA-level and higher documents.</span>
            <Link href="/data-room/access-control" className="rounded-md border border-gold/50 px-4 py-2 font-medium hover:bg-gold hover:text-obsidian">
              Complete NDA / request access
            </Link>
          </div>
        )}
      </Section>

      <Section className="border-t border-atlas-line bg-obsidian-900">
        <div className="flex items-center justify-between">
          <Eyebrow>Approved windows</Eyebrow>
          <Link href="/data-room/access-control" className="text-sm font-medium text-gold hover:underline">
            Request additional access →
          </Link>
        </div>
        <div className="mt-8">
          <WindowAccessCards windows={windows} />
        </div>
      </Section>

      <Section>
        <Eyebrow>Your access requests</Eyebrow>
        <div className="mt-6">
          {requests.length === 0 ? (
            <p className="text-sm text-atlas-grey">
              No access requests on record.{" "}
              <Link href="/data-room/access-control" className="text-gold hover:underline">
                Request access
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-2">
              {requests.map((r, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-atlas-line bg-obsidian-800 px-4 py-3 text-sm">
                  <span className="text-ivory">
                    {r.requested_window ?? "General"}
                    {r.requested_level && <span className="text-atlas-grey"> · {r.requested_level}</span>}
                  </span>
                  <span className="capitalize text-atlas-grey">{r.status.replace("_", " ")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-8 text-sm">
          <Link href="/auth/sign-out" className="text-atlas-grey hover:text-gold">
            Sign out
          </Link>
        </p>
      </Section>
    </>
  );
}

function StatusTile({
  label,
  value,
  ok,
  warn,
}: {
  label: string;
  value: string;
  ok?: boolean;
  warn?: boolean;
}) {
  const color = ok ? "text-emerald-light" : warn ? "text-gold" : "text-ivory";
  return (
    <div className="rounded-xl border border-atlas-line bg-obsidian-800 p-5">
      <p className="text-xs uppercase tracking-[0.14em] text-atlas-grey">{label}</p>
      <p className={`mt-2 font-display text-lg font-semibold capitalize ${color}`}>{value}</p>
    </div>
  );
}
