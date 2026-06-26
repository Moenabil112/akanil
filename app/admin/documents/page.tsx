import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell, NotConfigured } from "@/components/admin/shell";
import { Table, Th, Td, EmptyState, formatDate } from "@/components/admin/widgets";
import { getAdminSession } from "@/lib/admin/session";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  ACCESS_LEVELS,
  SENSITIVITY_LEVELS,
  type DocumentRecord,
} from "@/lib/supabase/types";

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

      <div className="mb-3 flex items-center justify-between">
        <h2 className="heading-md text-ivory">Document index</h2>
        <Link
          href="/admin/documents/new"
          className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-obsidian transition-colors hover:bg-gold-light"
        >
          + Add document
        </Link>
      </div>
      {rows.length === 0 ? (
        <EmptyState message="No documents indexed yet. Use “Add document” to register metadata and (optionally) upload a gated file." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Title</Th>
              <Th>Window</Th>
              <Th>Access / Sensitivity</Th>
              <Th>Status</Th>
              <Th>File</Th>
              <Th>Updated</Th>
              <Th>Edit</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <Td>
                  <Link href={`/admin/documents/${d.id}`} className="font-medium text-ivory hover:text-gold">
                    {d.title}
                  </Link>
                  <div className="text-xs text-atlas-grey">
                    {d.document_type ?? "—"} · v{d.version ?? "1"}
                  </div>
                </Td>
                <Td>{d.window ?? "—"}</Td>
                <Td>
                  {ACCESS_LEVELS.find((l) => l.value === d.access_level)?.label ?? d.access_level}
                  <div className="text-xs text-atlas-grey">
                    {SENSITIVITY_LEVELS.find((s) => s.value === d.sensitivity_level)?.label ??
                      d.sensitivity_level}
                  </div>
                </Td>
                <Td>
                  <span className="capitalize">{(d.status ?? "draft").replace("_", " ")}</span>
                </Td>
                <Td>
                  <span className={d.storage_path ? "text-emerald-light" : "text-atlas-grey"}>
                    {d.storage_path ? "attached" : "none"}
                  </span>
                </Td>
                <Td>{formatDate(d.updated_at)}</Td>
                <Td>
                  <Link href={`/admin/documents/${d.id}`} className="text-sm font-medium text-gold hover:underline">
                    Edit
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </AdminShell>
  );
}
