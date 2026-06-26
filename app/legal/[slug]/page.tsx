import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Section } from "@/components/ui";
import { pageMeta } from "@/lib/seo";
import { LEGAL_DOCS, getLegalDoc } from "@/lib/legal";

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ slug: d.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const doc = getLegalDoc(params.slug);
  if (!doc) return {};
  return pageMeta({
    title: doc.title,
    description: doc.summary,
    path: `/legal/${doc.slug}`,
  });
}

export default function LegalDocPage({ params }: { params: { slug: string } }) {
  const doc = getLegalDoc(params.slug);
  if (!doc) notFound();

  return (
    <>
      <PageHeader eyebrow="Governance & Legal" title={doc.title} intro={doc.summary} accent="gold" />

      <Section>
        <div className="mb-8 rounded-md border border-copper/40 bg-copper/10 px-5 py-4 text-sm text-copper-light">
          <strong>Draft — requires legal review before launch.</strong> This page
          is a placeholder prepared for review. It is not legal advice and is not
          final until reviewed and approved by qualified counsel.
        </div>

        <article className="max-w-3xl space-y-10">
          {doc.sections.map((s) => (
            <div key={s.heading}>
              <h2 className="heading-md text-ivory">{s.heading}</h2>
              <div className="mt-3 space-y-3">
                {s.body.map((p, i) => (
                  <p key={i} className="leading-relaxed text-atlas-grey">
                    {p}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </article>

        <p className="mt-12 text-sm">
          <Link href="/legal" className="text-gold hover:underline">
            ← All governance &amp; legal documents
          </Link>
        </p>
      </Section>
    </>
  );
}
