import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell, NotConfigured } from "@/components/admin/shell";
import { DocumentForm } from "@/components/admin/document-form";
import { getAdminSession } from "@/lib/admin/session";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { DocumentRecord } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Edit Document",
  robots: { index: false, follow: false },
};

export default async function EditDocumentPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const session = await getAdminSession();

  if (!isSupabaseConfigured()) {
    return (
      <AdminShell title="Edit Document" active="/admin/documents" email={session?.email}>
        <NotConfigured what="Editing documents" />
      </AdminShell>
    );
  }

  const { data } = await getServiceClient()
    .from("documents")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!data) notFound();
  const doc = data as DocumentRecord;

  return (
    <AdminShell title="Edit Document" active="/admin/documents" email={session?.email}>
      <Link href="/admin/documents" className="text-sm text-atlas-grey hover:text-gold">
        ← Back to documents
      </Link>
      <div className="mt-4 max-w-3xl">
        {searchParams.error && (
          <div className="mb-4 rounded-md border border-copper/40 bg-copper/10 px-4 py-3 text-sm text-copper-light">
            {searchParams.error === "title"
              ? "Title is required."
              : "Could not save the document. Please try again."}
          </div>
        )}
        <DocumentForm doc={doc} />
      </div>
    </AdminShell>
  );
}
