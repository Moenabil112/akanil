import type { Metadata } from "next";
import { AdminShell, NotConfigured } from "@/components/admin/shell";
import { Table, Th, Td, EmptyState, formatDate } from "@/components/admin/widgets";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Download Log",
  robots: { index: false, follow: false },
};

const PATH = "/admin/downloads";

interface LogRow {
  id: string;
  accessed_at: string;
  user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  documents: { title: string; access_level: string } | null;
}

export default async function DownloadsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <AdminShell title="Download Log" active={PATH}>
        <NotConfigured what="The document download log" />
      </AdminShell>
    );
  }

  const { data } = await getServiceClient()
    .from("document_access_logs")
    .select("id, accessed_at, user_id, ip_address, user_agent, documents(title, access_level)")
    .order("accessed_at", { ascending: false })
    .limit(300);

  const rows = (data ?? []) as unknown as LogRow[];

  return (
    <AdminShell title="Download Log" active={PATH}>
      <p className="mb-4 text-sm text-atlas-grey">
        Every authorized signed-URL grant is recorded here. Each row represents a
        gated download that passed session, window-permission, access-level, and
        NDA checks.
      </p>
      {rows.length === 0 ? (
        <EmptyState message="No document downloads recorded yet." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Time</Th>
              <Th>Document</Th>
              <Th>Level</Th>
              <Th>User</Th>
              <Th>IP</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td>{formatDate(r.accessed_at)}</Td>
                <Td>{r.documents?.title ?? "—"}</Td>
                <Td>{r.documents?.access_level ?? "—"}</Td>
                <Td>{r.user_id ? `${r.user_id.slice(0, 8)}…` : "anonymous"}</Td>
                <Td>{r.ip_address ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </AdminShell>
  );
}
