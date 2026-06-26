import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Section, Eyebrow } from "@/components/ui";
import { DocumentList } from "@/components/data-room/document-list";
import { getSessionUser } from "@/lib/auth/session";
import {
  windowBySlug,
  getGrantedLevel,
  listWindowDocuments,
} from "@/lib/data-room";
import { ACCESS_LEVELS } from "@/lib/supabase/types";
import { ndaSatisfied } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Data Room",
  robots: { index: false, follow: false },
};

export default async function DataRoomWindowPage({
  params,
}: {
  params: { window: string };
}) {
  const win = windowBySlug(params.window);
  if (!win) notFound();

  const user = await getSessionUser();

  // Gate: anonymous visitors are prompted to sign in (the public request page
  // remains at /data-room as the static fallback).
  if (!user) {
    return (
      <Gate
        title={`${win.label} Data Room`}
        body="This is a private data room window. Please sign in with your institutional account to view available documents."
        cta={{ href: `/auth/sign-in?next=/data-room/${win.slug}`, label: "Sign in" }}
      />
    );
  }

  const grantedLevel = await getGrantedLevel(user.profileId, win.label);
  const documents = await listWindowDocuments(win.label, user, grantedLevel);

  const grantedLabel = grantedLevel
    ? ACCESS_LEVELS.find((l) => l.value === grantedLevel)?.label
    : null;

  return (
    <>
      <PageHeader
        eyebrow={`Controlled Data Room · ${win.label}`}
        title={`${win.label} Data Room`}
        intro="Documents are listed according to your granted access level. Each download is authorized and logged. Raw file locations are never exposed."
        accent="teal"
      />

      <Section>
        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full border border-atlas-line bg-obsidian-800 px-3 py-1 text-atlas-grey">
            Signed in as <span className="text-ivory">{user.email}</span>
          </span>
          <span className="rounded-full border border-atlas-line bg-obsidian-800 px-3 py-1 text-atlas-grey">
            Access: <span className="text-teal-light">{grantedLabel ?? "Public only"}</span>
          </span>
          <span className="rounded-full border border-atlas-line bg-obsidian-800 px-3 py-1 text-atlas-grey">
            NDA:{" "}
            <span className={ndaSatisfied(user.ndaStatus) ? "text-emerald-light" : "text-gold"}>
              {user.ndaStatus ?? "pending"}
            </span>
          </span>
        </div>

        {!ndaSatisfied(user.ndaStatus) && (
          <div className="mb-6 rounded-md border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
            An approved NDA is required to download NDA-level and higher documents.
            Documents above your clearance are hidden from this list.
          </div>
        )}

        <Eyebrow>Documents</Eyebrow>
        <p className="mt-2 text-sm text-atlas-grey">
          Documents above your clearance are shown as locked. File locations are
          never exposed.
        </p>
        <div className="mt-6">
          <DocumentList documents={documents} windowLabel={win.label} />
        </div>

        <p className="mt-8 text-sm">
          <Link href="/data-room" className="text-gold hover:underline">
            ← Back to data room overview
          </Link>
        </p>
      </Section>
    </>
  );
}

function Gate({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: { href: string; label: string };
}) {
  return (
    <Section className="flex min-h-[60vh] items-center">
      <div className="mx-auto max-w-md text-center">
        <Eyebrow>
          <span className="mx-auto">Restricted</span>
        </Eyebrow>
        <h1 className="heading-lg mt-4 text-ivory">{title}</h1>
        <p className="mt-4 text-atlas-grey">{body}</p>
        <Link
          href={cta.href}
          className="mt-7 inline-block rounded-md bg-gold px-6 py-3 text-sm font-semibold text-obsidian transition-colors hover:bg-gold-light"
        >
          {cta.label}
        </Link>
      </div>
    </Section>
  );
}
