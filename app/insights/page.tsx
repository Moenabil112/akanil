import type { Metadata } from "next";
import { PageHeader, Section, Eyebrow, CTAButton } from "@/components/ui";

export const metadata: Metadata = {
  title: "Insights — Mining Intelligence & Governance Perspectives",
  description:
    "Insights from Akanil on strategic minerals, mining intelligence, evidence governance, and institutional readiness. CMS-backed publishing arrives in Phase 2.",
};

// Placeholder editorial topics. In Phase 2 these become CMS (Sanity) entries.
const TOPICS = [
  {
    tag: "Governance",
    title: "From fragmented files to reviewable evidence",
    excerpt:
      "Why mineral projects become institutionally ready through structure and governance — not documents alone.",
  },
  {
    tag: "Strategic Minerals",
    title: "Reading the Morocco–Sudan–Saudi corridor",
    excerpt:
      "How three geographies form a connected trust, geology, and technology-adoption thesis.",
  },
  {
    tag: "Operations Intelligence",
    title: "Fuel, recovery, and cost per ton",
    excerpt:
      "The operating signals that turn plant data into better daily mining decisions.",
  },
  {
    tag: "Trust Architecture",
    title: "What controlled access protects",
    excerpt:
      "The case for governed data rooms that protect both the project owner and the reviewing institution.",
  },
];

export default function InsightsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Perspectives on mineral trust, governance, and institutional readiness."
        intro="Structured thinking on strategic minerals, mining intelligence, evidence governance, and the path from mineral potential to institutional decision-making."
        accent="gold"
      />

      <Section>
        <div className="grid gap-5 md:grid-cols-2">
          {TOPICS.map((t) => (
            <article
              key={t.title}
              className="group flex flex-col rounded-xl border border-atlas-line bg-obsidian-800 p-7 transition-colors hover:border-gold/30"
            >
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-gold/80">
                {t.tag}
              </span>
              <h2 className="heading-md mt-3 text-ivory">{t.title}</h2>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-atlas-grey">
                {t.excerpt}
              </p>
              <span className="mt-5 text-sm font-medium text-gold/60">
                Full insight coming soon
              </span>
            </article>
          ))}
        </div>

        <div className="mt-12 rounded-xl border border-atlas-line bg-obsidian-900 p-8 text-center">
          <Eyebrow>
            <span className="mx-auto">Editorial</span>
          </Eyebrow>
          <p className="mx-auto mt-5 max-w-xl text-atlas-grey">
            The Insights library is published through the platform CMS (Sanity) in
            Phase 2. To receive institutional briefs and governance memos directly,
            request a briefing.
          </p>
          <div className="mt-6">
            <CTAButton href="/contact">Request Institutional Briefing</CTAButton>
          </div>
        </div>
      </Section>
    </>
  );
}
