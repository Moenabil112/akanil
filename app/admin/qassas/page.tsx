import type { Metadata } from "next";
import { AdminShell, NotConfigured } from "@/components/admin/shell";
import { Table, Th, Td, EmptyState, StatusSelect, formatDate } from "@/components/admin/widgets";
import { getAdminSession } from "@/lib/admin/session";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { QassasDemoRequest } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "QASSAS Demo Requests",
  robots: { index: false, follow: false },
};

const PATH = "/admin/qassas";

export default async function QassasPage() {
  const session = await getAdminSession();

  if (!isSupabaseConfigured()) {
    return (
      <AdminShell title="QASSAS Demo Requests" active={PATH} email={session?.email}>
        <NotConfigured what="QASSAS demo review" />
      </AdminShell>
    );
  }

  const { data } = await getServiceClient()
    .from("qassas_demo_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as QassasDemoRequest[];

  return (
    <AdminShell title="QASSAS Demo Requests" active={PATH} email={session?.email}>
      <p className="mb-4 text-sm text-atlas-grey">
        Demo access is kept separate from public website access. Approve, then
        provision a controlled, time-limited preview (Phase 4).
      </p>
      {rows.length === 0 ? (
        <EmptyState message="No QASSAS demo requests yet." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Received</Th>
              <Th>Requester</Th>
              <Th>Organization</Th>
              <Th>Use case</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td>{formatDate(r.created_at)}</Td>
                <Td>
                  <div className="font-medium text-ivory">{r.full_name}</div>
                  <a href={`mailto:${r.email}`} className="text-xs text-gold hover:underline">
                    {r.email}
                  </a>
                </Td>
                <Td>
                  {r.organization ?? "—"}
                  {r.role && <div className="text-xs text-atlas-grey">{r.role}</div>}
                </Td>
                <Td>
                  <p className="max-w-xs text-xs text-atlas-grey">{r.use_case ?? "—"}</p>
                </Td>
                <Td>
                  <StatusSelect
                    table="qassas_demo_requests"
                    id={r.id}
                    status={r.status}
                    path={PATH}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </AdminShell>
  );
}
