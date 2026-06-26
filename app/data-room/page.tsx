import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section, Eyebrow } from "@/components/ui";
import { RequestForm } from "@/components/request-form";
import { TrustPathway } from "@/components/trust-pathway";
import { getSessionUser } from "@/lib/auth/session";
import { getWindowAccessSummary } from "@/lib/data-room";
import { WindowAccessCards } from "@/components/data-room/window-cards";
import { ndaSatisfied } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Akanil Data Room Access",
  description:
    "Akanil uses controlled data room access to protect sensitive technical, legal, financial, and strategic information while allowing qualified institutional stakeholders to review relevant evidence.",
};

const LEVELS = [
  {
    name: "Public Access",
    text: "General ecosystem positioning and non-sensitive content.",
  },
  {
    name: "Institutional Brief Access",
    text: "Selected project summaries, governance notes, and non-sensitive institutional memos.",
  },
  {
    name: "NDA Data Room Access",
    text: "Sensitive documents, technical evidence, legal files, financial assumptions, maps, reports, and internal decision memos.",
  },
];

export default async function DataRoomPage() {
  const user = await getSessionUser();
  const windows = user ? await getWindowAccessSummary(user) : [];

  return (
    <>
      <PageHeader
        eyebrow="Controlled Access"
        title="Akanil Data Room Access"
        intro="Akanil uses controlled data room access to protect sensitive technical, legal, financial, and strategic information while allowing qualified institutional stakeholders to review the relevant evidence."
        accent="teal"
        badge="Controlled Institutional Access Layer"
      />

      {/* Private panel — only for signed-in users. Anonymous visitors see the
          public request flow below as the static fallback. */}
      {user && (
        <Section className="border-b border-atlas-line bg-obsidian-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Eyebrow>Your Data Room</Eyebrow>
            <span className="text-sm text-atlas-grey">
              {user.email} · NDA:{" "}
              <span className={ndaSatisfied(user.ndaStatus) ? "text-emerald-light" : "text-gold"}>
                {user.ndaStatus ?? "pending"}
              </span>
            </span>
          </div>
          <p className="mt-4 max-w-2xl text-atlas-grey">
            Enter a window to review the documents available to you. Access is
            filtered by your granted level and every download is authorized and
            logged. Locked windows can be requested.
          </p>
          <div className="mt-8">
            <WindowAccessCards windows={windows} />
          </div>
          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <Link href="/data-room/status" className="font-medium text-gold hover:underline">
              View access status →
            </Link>
            <Link href="/data-room/access-control" className="font-medium text-gold hover:underline">
              Request additional access →
            </Link>
          </div>
        </Section>
      )}

      <Section>
        <Eyebrow>Access Levels</Eyebrow>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {LEVELS.map((l, i) => (
            <div
              key={l.name}
              className="rounded-xl border border-atlas-line bg-obsidian-800 p-6"
            >
              <span className="font-display text-sm text-teal-light">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="heading-md mt-1 text-ivory">{l.name}</h3>
              <p className="mt-3 text-sm leading-relaxed text-atlas-grey">
                {l.text}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-teal/30 bg-teal/5 p-7">
          <h3 className="heading-md text-ivory">Why Controlled Access Matters</h3>
          <p className="mt-3 max-w-3xl text-atlas-grey">
            Controlled access protects both the project owner and the reviewing
            institution. It ensures that sensitive information is shared through a
            professional, traceable, and governed process.
          </p>
        </div>
      </Section>

      <Section className="border-y border-atlas-line bg-obsidian-900">
        <Eyebrow>The Access Journey</Eyebrow>
        <div className="mt-8">
          <TrustPathway
            title="Public Layer → NDA Data Room → Partnership"
            steps={[
              "Public Layer",
              "Institutional Brief",
              "NDA Data Room",
              "Review",
              "Partnership",
            ]}
          />
        </div>
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <Eyebrow>Apply for Access</Eyebrow>
            <h2 className="heading-lg mt-6 text-ivory">
              Request controlled data room access.
            </h2>
            <p className="mt-5 text-atlas-grey">
              Submit your institutional details. Each application is reviewed by
              the Akanil team, and NDA data room access requires a confidentiality
              agreement and controlled access approval before any sensitive
              documents are shared.
            </p>
          </div>
          <div className="rounded-xl border border-atlas-line bg-obsidian-800 p-7 md:p-8">
            <RequestForm variant="dataroom" defaultRequestType="Data Room Access" />
          </div>
        </div>
      </Section>
    </>
  );
}
