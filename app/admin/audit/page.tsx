import type { Metadata } from "next";
import { AdminShell, NotConfigured } from "@/components/admin/shell";
import { Table, Th, Td, EmptyState, formatDate } from "@/components/admin/widgets";
import { getAdminSession } from "@/lib/admin/session";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { AuditLog } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Audit Log",
  robots: { index: false, follow: false },
};

const PATH = "/admin/audit";

export default async function AuditPage() {
  const session = await getAdminSession();

  if (!isSupabaseConfigured()) {
    return (
      <AdminShell title="Audit Log" active={PATH} email={session?.email}>
        <NotConfigured what="The audit log" />
      </AdminShell>
    );
  }

  const { data } = await getServiceClient()
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);

  const rows = (data ?? []) as AuditLog[];

  return (
    <AdminShell title="Audit Log" active={PATH} email={session?.email}>
      <p className="mb-4 text-sm text-atlas-grey">
        Traceable record of submissions and admin actions. Document download
        tracking joins this stream once signed-URL delivery ships.
      </p>
      {rows.length === 0 ? (
        <EmptyState message="No audit events yet." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Time</Th>
              <Th>Actor</Th>
              <Th>Action</Th>
              <Th>Target</Th>
              <Th>Detail</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <Td>{formatDate(a.created_at)}</Td>
                <Td>{a.actor ?? "system"}</Td>
                <Td>
                  <span className="capitalize">{a.action_type.replace(/_/g, " ")}</span>
                </Td>
                <Td>
                  {a.target_type ?? "—"}
                  {a.target_id && (
                    <div className="text-xs text-atlas-grey">{a.target_id.slice(0, 8)}…</div>
                  )}
                </Td>
                <Td>
                  {a.metadata ? (
                    <code className="text-xs text-atlas-grey">
                      {JSON.stringify(a.metadata)}
                    </code>
                  ) : (
                    a.notes ?? "—"
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </AdminShell>
  );
}
