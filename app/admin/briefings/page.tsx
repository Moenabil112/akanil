import type { Metadata } from "next";
import { AdminShell, NotConfigured } from "@/components/admin/shell";
import { Table, Th, Td, EmptyState, StatusSelect, formatDate } from "@/components/admin/widgets";
import { getAdminSession } from "@/lib/admin/session";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { BriefingRequest } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Briefing Requests",
  robots: { index: false, follow: false },
};

const PATH = "/admin/briefings";

export default async function BriefingsPage() {
  const session = await getAdminSession();

  if (!isSupabaseConfigured()) {
    return (
      <AdminShell title="Briefing Requests" active={PATH} email={session?.email}>
        <NotConfigured what="Briefing request review" />
      </AdminShell>
    );
  }

  const { data } = await getServiceClient()
    .from("briefing_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as BriefingRequest[];

  return (
    <AdminShell title="Briefing Requests" active={PATH} email={session?.email}>
      {rows.length === 0 ? (
        <EmptyState message="No briefing requests yet." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Received</Th>
              <Th>Requester</Th>
              <Th>Organization</Th>
              <Th>Topic / Window</Th>
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
                  {r.message && (
                    <p className="mt-1 max-w-xs text-xs text-atlas-grey">{r.message}</p>
                  )}
                </Td>
                <Td>
                  {r.organization ?? "—"}
                  {r.role && <div className="text-xs text-atlas-grey">{r.role}</div>}
                </Td>
                <Td>
                  {r.requested_topic ?? "—"}
                  {r.related_window && (
                    <div className="text-xs text-atlas-grey">{r.related_window}</div>
                  )}
                </Td>
                <Td>
                  <StatusSelect table="briefing_requests" id={r.id} status={r.status} path={PATH} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </AdminShell>
  );
}
