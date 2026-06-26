import type { Metadata } from "next";
import { AdminShell, NotConfigured } from "@/components/admin/shell";
import { Table, Th, Td, EmptyState, formatDate } from "@/components/admin/widgets";
import { getAdminSession } from "@/lib/admin/session";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Organization } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Organizations",
  robots: { index: false, follow: false },
};

const PATH = "/admin/organizations";

export default async function OrganizationsPage() {
  const session = await getAdminSession();

  if (!isSupabaseConfigured()) {
    return (
      <AdminShell title="Organizations" active={PATH} email={session?.email}>
        <NotConfigured what="Organization & contact records" />
      </AdminShell>
    );
  }

  const { data } = await getServiceClient()
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as Organization[];

  return (
    <AdminShell title="Organizations" active={PATH} email={session?.email}>
      <p className="mb-4 text-sm text-atlas-grey">
        Institutional entities (banks, funds, partners). Records are linked to
        profiles, NDA records, and CRM opportunities as the data room matures.
      </p>
      {rows.length === 0 ? (
        <EmptyState message="No organizations recorded yet. These are created during institutional review." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Type</Th>
              <Th>Country</Th>
              <Th>Website</Th>
              <Th>Added</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <Td>
                  <div className="font-medium text-ivory">{o.name}</div>
                  {o.notes && <p className="max-w-xs text-xs text-atlas-grey">{o.notes}</p>}
                </Td>
                <Td>{o.type ?? "—"}</Td>
                <Td>{o.country ?? "—"}</Td>
                <Td>
                  {o.website ? (
                    <a href={o.website} className="text-gold hover:underline" target="_blank" rel="noreferrer">
                      {o.website}
                    </a>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td>{formatDate(o.created_at)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </AdminShell>
  );
}
