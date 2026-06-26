import type { Metadata } from "next";
import { AdminShell, NotConfigured } from "@/components/admin/shell";
import { Table, Th, Td, EmptyState, formatDate } from "@/components/admin/widgets";
import { getAdminSession } from "@/lib/admin/session";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { ACCESS_LEVELS, type DocumentRecord } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Documents",
  robots: { index: false, follow: false },
};

const PATH = "/admin/documents";

export default async function DocumentsPage() {
  const session = await getAdminSession();

  if (!isSupabaseConfigured()) {
    return (
      <AdminShell title="Documents" active={PATH} email={session?.email}>
        <NotConfigured what="Document metadata management" />
      </AdminShell>
    );
  }

  const { data } = await getServiceClient()
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);

  const rows = (data ?? []) as DocumentRecord[];
  const counts = Object.fromEntries(
    ACCESS_LEVELS.map((l) => [l.value, rows.filter((d) => d.access_level === l.value).length])
  );

  return (
    <AdminShell title="Documents" active={PATH} email={session?.email}>
      {/* Data Room layer structure (step 4) — files stay gated. */}
      <section className="mb-8">
        <h2 className="heading-md mb-3 text-ivory">Data Room layers</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {ACCESS_LEVELS.map((l, i) => (
            <div key={l.value} className="rounded-xl border border-atlas-line bg-obsidian-800 p-4">
              <span className="font-display text-xs text-teal-light">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="mt-1 text-sm font-medium text-ivory">{l.label}</p>
              <p className="mt-2 font-display text-2xl font-semibold text-ivory">
                {counts[l.value] ?? 0}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="mb-4 rounded-md border border-teal/30 bg-teal/5 px-4 py-3 text-sm text-teal-light">
        File access is gated. This view manages document <strong>metadata</strong>{" "}
        only — storage paths are never exposed and no download links are issued.
        Authenticated, NDA-checked, signed-URL delivery arrives in Phase 3.
      </div>

      <h2 className="heading-md mb-3 text-ivory">Document index</h2>
      {rows.length === 0 ? (
        <EmptyState message="No documents indexed yet. Metadata is added as the data room is populated." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Title</Th>
              <Th>Window</Th>
              <Th>Type</Th>
              <Th>Access level</Th>
              <Th>Ver.</Th>
              <Th>Active</Th>
              <Th>Updated</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <Td>
                  <div className="font-medium text-ivory">{d.title}</div>
                  {d.description && (
                    <p className="max-w-xs text-xs text-atlas-grey">{d.description}</p>
                  )}
                </Td>
                <Td>{d.window ?? "—"}</Td>
                <Td>{d.document_type ?? "—"}</Td>
                <Td>{ACCESS_LEVELS.find((l) => l.value === d.access_level)?.label ?? d.access_level}</Td>
                <Td>{d.version ?? "—"}</Td>
                <Td>{d.is_active ? "Yes" : "No"}</Td>
                <Td>{formatDate(d.updated_at)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </AdminShell>
  );
}
