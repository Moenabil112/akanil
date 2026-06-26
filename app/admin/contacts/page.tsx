import type { Metadata } from "next";
import { AdminShell, NotConfigured } from "@/components/admin/shell";
import { Table, Th, Td, EmptyState, StatusSelect, formatDate } from "@/components/admin/widgets";
import { getAdminSession } from "@/lib/admin/session";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ContactMessage } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Contact Messages",
  robots: { index: false, follow: false },
};

const PATH = "/admin/contacts";

export default async function ContactsPage() {
  const session = await getAdminSession();

  if (!isSupabaseConfigured()) {
    return (
      <AdminShell title="Contact Messages" active={PATH} email={session?.email}>
        <NotConfigured what="Contact message review" />
      </AdminShell>
    );
  }

  const { data } = await getServiceClient()
    .from("contact_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as ContactMessage[];

  return (
    <AdminShell title="Contact Messages" active={PATH} email={session?.email}>
      {rows.length === 0 ? (
        <EmptyState message="No contact messages yet." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Received</Th>
              <Th>From</Th>
              <Th>Organization</Th>
              <Th>Reason / Message</Th>
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
                  {r.reason && <div className="text-ivory-muted">{r.reason}</div>}
                  {r.message && (
                    <p className="mt-1 max-w-sm text-xs text-atlas-grey">{r.message}</p>
                  )}
                </Td>
                <Td>
                  <StatusSelect table="contact_messages" id={r.id} status={r.status} path={PATH} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </AdminShell>
  );
}
