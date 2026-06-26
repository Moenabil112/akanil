import type { Metadata } from "next";
import { PageHeader, Section, Eyebrow, CheckList, CTARow } from "@/components/ui";

export const metadata: Metadata = {
  title: "HYRION — Mining Evidence & Trust Governance Layer",
  description:
    "HYRION is a mining evidence and trust governance layer that organizes data rooms, documents, risks, and decision memos for institutional review.",
};

const ORGANIZES = [
  "Licenses",
  "Sample reports",
  "Maps",
  "Technical documents",
  "Legal documents",
  "Financial assumptions",
  "Risk registers",
  "Meeting records",
  "Decision memos",
  "Data room permissions",
];

const LAYERS = [
  "Legal",
  "Geological",
  "Technical",
  "Operational",
  "Financial",
  "ESG / Compliance",
  "Decision Memos",
  "Meeting Records",
];

const ACCESS = [
  {
    name: "Public Layer",
    text: "General non-sensitive positioning.",
  },
  {
    name: "Institutional Brief Layer",
    text: "Project summaries and memos after formal engagement.",
  },
  {
    name: "NDA Data Room Layer",
    text: "Sensitive documents after confidentiality agreement and controlled access approval.",
  },
];

export default function HyrionPage() {
  return (
    <>
      <PageHeader
        eyebrow="Digital Window · HYRION"
        title="HYRION — Mining Evidence & Trust Governance Layer"
        intro="HYRION transforms fragmented mining files into structured, classified, and reviewable evidence for banks, funds, mining companies, legal advisors, technical reviewers, and institutional stakeholders."
        coreMessage="HYRION transforms mineral information into structured evidence, and structured evidence into reviewable institutional decisions."
        accent="teal"
      />

      <Section>
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>What HYRION Organizes</Eyebrow>
            <div className="mt-6 rounded-xl border border-atlas-line bg-obsidian-800 p-7">
              <CheckList items={ORGANIZES} accent="teal" columns={2} />
            </div>
          </div>
          <div>
            <Eyebrow>Data Room Layers</Eyebrow>
            <ol className="mt-6 grid gap-3">
              {LAYERS.map((l, i) => (
                <li
                  key={l}
                  className="flex items-center gap-4 rounded-lg border border-atlas-line bg-obsidian-800 px-5 py-3.5"
                >
                  <span className="font-display text-sm text-teal-light">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-ivory">{l}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Section>

      <Section className="border-t border-atlas-line bg-obsidian-900">
        <Eyebrow>Access Model</Eyebrow>
        <h2 className="heading-lg mt-6 max-w-2xl text-ivory">
          Three governed layers of access.
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {ACCESS.map((a, i) => (
            <div
              key={a.name}
              className="rounded-xl border border-atlas-line bg-obsidian-800 p-6"
            >
              <span className="font-display text-sm text-teal-light">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="heading-md mt-1 text-ivory">{a.name}</h3>
              <p className="mt-3 text-sm leading-relaxed text-atlas-grey">
                {a.text}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-10">
          <CTARow
            ctas={[
              { label: "Request HYRION Governance Brief", href: "/contact" },
              { label: "Apply for Data Room Access", href: "/data-room" },
            ]}
          />
        </div>
      </Section>
    </>
  );
}
