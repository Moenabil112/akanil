import Link from "next/link";
import { AkanilMark } from "@/components/logo";
import { logoutAction } from "@/app/admin/actions";

const NAV = [
  { label: "Overview", href: "/admin" },
  { label: "Access Requests", href: "/admin/access-requests" },
  { label: "Briefings", href: "/admin/briefings" },
  { label: "QASSAS Demos", href: "/admin/qassas" },
  { label: "Contacts", href: "/admin/contacts" },
  { label: "Organizations", href: "/admin/organizations" },
  { label: "Documents", href: "/admin/documents" },
  { label: "Audit Log", href: "/admin/audit" },
];

export function AdminShell({
  children,
  title,
  active,
  email,
}: {
  children: React.ReactNode;
  title: string;
  active: string;
  email?: string;
}) {
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
          {NAV.map((item) => {
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
            {email && (
              <span className="hidden text-xs text-atlas-grey sm:inline">
                {email}
              </span>
            )}
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
        run the migration in <code className="text-copper-light">supabase/migrations</code>.
      </p>
    </div>
  );
}
