import type { Metadata } from "next";
import { AdminShell, NotConfigured } from "@/components/admin/shell";
import { StatCard, EmptyState, Table, Th, Td, formatDate, StatusBadge } from "@/components/admin/widgets";
import { getAdminSession } from "@/lib/admin/session";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin Overview",
  robots: { index: false, follow: false },
};

async function count(table: string): Promise<number> {
  const { count } = await getServiceClient()
    .from(table)
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}

async function pendingCount(table: string): Promise<number> {
  const { count } = await getServiceClient()
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}

export default async function AdminOverview() {
  const session = await getAdminSession();

  if (!isSupabaseConfigured()) {
    return (
      <AdminShell title="Overview" active="/admin" email={session?.email}>
        <NotConfigured what="The review dashboard" />
      </AdminShell>
    );
  }

  const supabase = getServiceClient();
  const [access, briefings, qassas, contacts, pendingAccess] = await Promise.all([
    count("access_requests"),
    count("briefing_requests"),
    count("qassas_demo_requests"),
    count("contact_messages"),
    pendingCount("access_requests"),
  ]);

  const { data: recent } = await supabase
    .from("access_requests")
    .select("id, full_name, organization, requested_window, status, created_at")
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <AdminShell title="Overview" active="/admin" email={session?.email}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Access Requests" value={access} href="/admin/access-requests" />
        <StatCard label="Briefings" value={briefings} href="/admin/briefings" accent="teal" />
        <StatCard label="QASSAS Demos" value={qassas} href="/admin/qassas" accent="teal" />
        <StatCard label="Contacts" value={contacts} href="/admin/contacts" accent="emerald" />
      </div>

      <div className="mt-4">
        <StatCard label="Access requests pending review" value={pendingAccess} accent="copper" />
      </div>

      <section className="mt-10">
        <h2 className="heading-md mb-4 text-ivory">Recent access requests</h2>
        {recent && recent.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Organization</Th>
                <Th>Window</Th>
                <Th>Status</Th>
                <Th>Received</Th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <Td>{r.full_name}</Td>
                  <Td>{r.organization ?? "—"}</Td>
                  <Td>{r.requested_window ?? "—"}</Td>
                  <Td>
                    <StatusBadge status={r.status} />
                  </Td>
                  <Td>{formatDate(r.created_at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState message="No access requests yet. Submissions from the public site appear here." />
        )}
      </section>
    </AdminShell>
  );
}
