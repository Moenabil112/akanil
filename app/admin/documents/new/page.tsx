import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell, NotConfigured } from "@/components/admin/shell";
import { DocumentForm } from "@/components/admin/document-form";
import { getAdminSession } from "@/lib/admin/session";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "New Document",
  robots: { index: false, follow: false },
};

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await getAdminSession();

  return (
    <AdminShell title="New Document" active="/admin/documents" email={session?.email}>
      <Link href="/admin/documents" className="text-sm text-atlas-grey hover:text-gold">
        ← Back to documents
      </Link>
      <div className="mt-4 max-w-3xl">
        {!isSupabaseConfigured() ? (
          <NotConfigured what="Creating documents" />
        ) : (
          <>
            {searchParams.error && (
              <div className="mb-4 rounded-md border border-copper/40 bg-copper/10 px-4 py-3 text-sm text-copper-light">
                {searchParams.error === "title"
                  ? "Title is required."
                  : "Could not save the document. Please try again."}
              </div>
            )}
            <DocumentForm />
          </>
        )}
      </div>
    </AdminShell>
  );
}
