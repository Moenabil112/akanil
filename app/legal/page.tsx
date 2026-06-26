import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section, Eyebrow } from "@/components/ui";
import { pageMeta } from "@/lib/seo";
import { LEGAL_DOCS } from "@/lib/legal";

export const metadata: Metadata = pageMeta({
  title: "Governance & Legal",
  description:
    "Akanil governance and legal documents — privacy, terms, disclaimers, IP, data room access, NDA process, claims policy, and QASSAS disclosure.",
  path: "/legal",
});

export default function LegalIndexPage() {
  return (
    <>
      <PageHeader
        eyebrow="Governance & Legal"
        title="Governance & Legal"
        intro="The policies and notices that govern use of the Akanil platform and controlled data room. These documents are in draft and require legal review before launch."
        accent="gold"
        badge="Controlled Institutional Access Layer"
      />

      <Section>
        <Eyebrow>Documents</Eyebrow>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LEGAL_DOCS.map((doc) => (
            <Link
              key={doc.slug}
              href={`/legal/${doc.slug}`}
              className="group rounded-xl border border-atlas-line bg-obsidian-800 p-6 transition-colors hover:border-gold/30"
            >
              <h2 className="heading-md text-ivory group-hover:text-gold">{doc.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-atlas-grey">{doc.summary}</p>
              <span className="mt-4 inline-block text-sm font-medium text-gold">Read →</span>
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
