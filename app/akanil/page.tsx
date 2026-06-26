import type { Metadata } from "next";
import { PageHeader, Section, Eyebrow, CheckList, CTAButton } from "@/components/ui";
import { TrustPathway } from "@/components/trust-pathway";

export const metadata: Metadata = {
  title: "Akanil — Strategic Minerals & Trust Architecture House",
  description:
    "Akanil is a strategic minerals and trust architecture house building digital and institutional trust layers for mining, mineral data, governance, and investment-ready decision-making.",
};

const ORGANIZES = [
  "Land",
  "Mineral data",
  "Field intelligence",
  "Legal documents",
  "Technical evidence",
  "Governance",
  "Capital readiness",
  "Strategic partnerships",
];

export default function AkanilPage() {
  return (
    <>
      <PageHeader
        eyebrow="The Parent Window"
        title="Akanil — Strategic Minerals & Trust Architecture House"
        intro="Akanil builds the digital and institutional trust layers required to transform mineral opportunities into structured, reviewable, and institutionally readable cases."
        coreMessage="From Earth to Trust. From Mineral Data to Institutional Decision."
        accent="gold"
      />

      <Section>
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Eyebrow>What Akanil Does</Eyebrow>
            <h2 className="heading-lg mt-6 text-ivory">
              Organizing the relationship between earth, evidence, and capital.
            </h2>
            <p className="mt-5 text-atlas-grey">
              Akanil organizes the relationship between the physical, documentary,
              and institutional dimensions of a mineral project — so that what is
              known, assumed, and unverified can be separated and reviewed.
            </p>
          </div>
          <div className="rounded-xl border border-atlas-line bg-obsidian-800 p-8">
            <CheckList items={ORGANIZES} columns={2} accent="gold" />
          </div>
        </div>
      </Section>

      <Section className="border-t border-atlas-line bg-obsidian-900">
        <Eyebrow>Trust Pathway</Eyebrow>
        <h2 className="heading-lg mt-6 max-w-2xl text-ivory">
          From public trust to strategic partnership.
        </h2>
        <div className="mt-10">
          <TrustPathway
            steps={[
              "Public Trust",
              "Institutional Brief",
              "NDA Data Room",
              "Technical / Investment Review",
              "Strategic Partnership",
            ]}
          />
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <CTAButton href="/contact">Request Akanil Institutional Brief</CTAButton>
          <CTAButton href="/data-room" variant="outline">
            Apply for Data Room Access
          </CTAButton>
        </div>
      </Section>
    </>
  );
}
