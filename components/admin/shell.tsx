import Link from "next/link";
import { redirect } from "next/navigation";
import { AkanilMark } from "@/components/logo";
import { logoutAction } from "@/app/admin/actions";
import { getAdminUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { ADMIN_ROLES, type AdminRole } from "@/lib/supabase/types";

const NAV: { label: string; href: string; show: (r: AdminRole | null) => boolean }[] = [
  { label: "Overview", href: "/admin", show: can.viewAdmin },
  { label: "Access Requests", href: "/admin/access-requests", show: can.viewAdmin },
  { label: "Briefings", href: "/admin/briefings", show: can.viewAdmin },
  { label: "QASSAS Demos", href: "/admin/qassas", show: can.viewAdmin },
  { label: "Contacts", href: "/admin/contacts", show: can.viewAdmin },
  { label: "Organizations", href: "/admin/organizations", show: can.viewAdmin },
  { label: "Documents", href: "/admin/documents", show: can.viewAdmin },
  { label: "Access Control", href: "/admin/access-control", show: can.assignAccess },
  { label: "Downloads", href: "/admin/downloads", show: can.reviewRequests },
  { label: "Audit Log", href: "/admin/audit", show: can.reviewRequests },
];

function roleLabel(role: AdminRole | null): string {
  return ADMIN_ROLES.find((r) => r.value === role)?.label ?? "—";
}

export async function AdminShell({
  children,
  title,
  active,
}: {
  children: React.ReactNode;
  title: string;
  active: string;
  /** @deprecated role/email now resolved internally */
  email?: string;
}) {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  const items = NAV.filter((item) => item.show(user.role));

  return (
    <div className="min-h-screen bg-obsidian text-ivory lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-atlas-line bg-obsidian-900 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2.5 px-6 py-5">
          <AkanilMark className="h-7 w-7 text-gold" />
          <div>
            <p className="font-display text-sm font-semibold tracking-[0.16em] text-ivory">
              AKANIL
            </p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-atlas-grey">
              Admin Console
            </p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0">
          {items.map((item) => {
            const isActive = item.href === active;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-gold/10 text-gold"
                    : "text-ivory-muted hover:bg-obsidian-700 hover:text-ivory"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between border-b border-atlas-line px-6 py-4">
          <h1 className="heading-md text-ivory">{title}</h1>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-atlas-grey sm:inline">
              {user.email}
              <span className="ml-2 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-gold">
                {roleLabel(user.role)}
              </span>
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-md border border-atlas-line px-3 py-1.5 text-xs text-ivory-muted transition-colors hover:border-gold/40 hover:text-gold"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}

export function NotConfigured({ what }: { what: string }) {
  return (
    <div className="rounded-xl border border-copper/40 bg-copper/10 p-6">
      <h3 className="heading-md text-ivory">Supabase not configured</h3>
      <p className="mt-2 max-w-2xl text-sm text-atlas-grey">
        {what} requires a Supabase connection. Set{" "}
        <code className="text-copper-light">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="text-copper-light">SUPABASE_SERVICE_ROLE_KEY</code>, then
        run the migrations in <code className="text-copper-light">supabase/migrations</code>.
      </p>
    </div>
  );
}

export function Forbidden({ action }: { action: string }) {
  return (
    <div className="rounded-xl border border-copper/40 bg-copper/10 p-6">
      <h3 className="heading-md text-ivory">Insufficient permissions</h3>
      <p className="mt-2 text-sm text-atlas-grey">
        Your role does not allow {action}.
      </p>
    </div>
  );
}
