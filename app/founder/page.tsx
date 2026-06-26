import type { Metadata } from "next";
import { PageHeader, Section, Eyebrow, CheckList, CTAButton } from "@/components/ui";

export const metadata: Metadata = {
  title: "Mohamed Nabil — Mining Intelligence & Strategic Minerals Trust Architect",
  description:
    "Mohamed Nabil is the Founder of Akanil, working at the intersection of mining, AI, governance, strategic minerals, and institutional investment readiness.",
};

const FOCUS = [
  "Mining Intelligence",
  "Strategic Minerals",
  "AI for Exploration and Operations",
  "Digital Data Rooms",
  "Mineral Governance",
  "Copper and Gold Value Chains",
  "Morocco–Sudan–Saudi Strategic Corridors",
  "Institutional Investment Readiness",
];

export default function FounderPage() {
  return (
    <>
      <PageHeader
        eyebrow="Founder"
        title="Mohamed Nabil — Mining Intelligence & Strategic Minerals Trust Architect"
        intro="Founder of Akanil and a project developer working at the intersection of mining, artificial intelligence, governance, strategic minerals, and institutional investment readiness."
        accent="gold"
      />

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <Eyebrow>Short Bio</Eyebrow>
            <p className="text-atlas-grey">
              Through Akanil, Mohamed Nabil develops trust architecture around
              mineral projects, helping transform field intelligence, documents,
              and technical assumptions into structured evidence and decision-ready
              institutional pathways.
            </p>
            <blockquote className="rounded-xl border border-atlas-line bg-obsidian-800 p-7">
              <p className="font-display text-lg leading-relaxed text-ivory">
                “I do not approach mining as extraction only. I approach it as a
                governed ecosystem where land, data, capital, technology, and
                institutions must operate through a clear trust layer.”
              </p>
              <footer className="mt-4 text-sm font-medium text-gold">
                — Mohamed Nabil, Founder of Akanil
              </footer>
            </blockquote>
          </div>
          <div>
            <Eyebrow>Focus Areas</Eyebrow>
            <div className="mt-6 rounded-xl border border-atlas-line bg-obsidian-800 p-7">
              <CheckList items={FOCUS} accent="gold" />
            </div>
            <div className="mt-6">
              <CTAButton href="/contact">Request Founder Briefing</CTAButton>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
