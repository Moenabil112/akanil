import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell, NotConfigured } from "@/components/admin/shell";
import { RequestFilters } from "@/components/admin/request-filters";
import { Table, Th, Td, EmptyState, StatusSelect, QuickStatus, formatDate } from "@/components/admin/widgets";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  ACCESS_LEVELS,
  REQUEST_STATUSES,
  type AccessRequest,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Access Requests",
  robots: { index: false, follow: false },
};

const PATH = "/admin/access-requests";

function levelLabel(value: string | null): string {
  return ACCESS_LEVELS.find((l) => l.value === value)?.label ?? "—";
}

export default async function AccessRequestsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  if (!isSupabaseConfigured()) {
    return (
      <AdminShell title="Access Requests" active={PATH}>
        <NotConfigured what="Access request review" />
      </AdminShell>
    );
  }

  let query = getServiceClient()
    .from("access_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const status = searchParams.status;
  if (status && (REQUEST_STATUSES as string[]).includes(status)) {
    query = query.eq("status", status);
  }
  const q = searchParams.q?.trim();
  if (q) {
    query = query.or(
      `full_name.ilike.%${q}%,email.ilike.%${q}%,organization.ilike.%${q}%`
    );
  }

  const { data } = await query;
  const rows = (data ?? []) as AccessRequest[];

  return (
    <AdminShell title="Access Requests" active={PATH}>
      <RequestFilters basePath={PATH} q={searchParams.q} status={searchParams.status} />
      {rows.length === 0 ? (
        <EmptyState message="No access requests match your filters. Submissions from the public site appear here." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Received</Th>
              <Th>Applicant</Th>
              <Th>Organization</Th>
              <Th>Window / Level</Th>
              <Th>NDA</Th>
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
                  {r.requested_window ?? "—"}
                  <div className="text-xs text-atlas-grey">{levelLabel(r.requested_level)}</div>
                </Td>
                <Td>{r.nda_acknowledged ? "Acknowledged" : "—"}</Td>
                <Td>
                  <div className="space-y-2">
                    <StatusSelect table="access_requests" id={r.id} status={r.status} path={PATH} />
                    <QuickStatus table="access_requests" id={r.id} path={PATH} />
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </AdminShell>
  );
}
