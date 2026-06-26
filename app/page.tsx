import Link from "next/link";
import { WINDOWS, SITE } from "@/lib/site";
import { WindowCard } from "@/components/window-card";
import { TrustPathway } from "@/components/trust-pathway";
import { Section, Eyebrow, CTAButton, CheckList } from "@/components/ui";
import { TrackedLink } from "@/components/track";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { AkanilMark } from "@/components/logo";

const WHAT_WE_BUILD = [
  "Mining Intelligence",
  "Strategic Minerals Governance",
  "Digital Data Rooms",
  "Evidence Indexing",
  "AI-Enabled Exploration Concepts",
  "Mining Operations Intelligence",
  "Institutional Readiness",
  "Strategic Mineral Corridors",
];

const GEOGRAPHY = [
  {
    name: "Morocco",
    text: "A platform for institutional trust, financial structuring, governance, and regulated access.",
  },
  {
    name: "Sudan",
    text: "A geological depth and strategic mineral corridor requiring evidence organization and structured engagement.",
  },
  {
    name: "Saudi Arabia",
    text: "A smart mining and technology adoption market, especially within the Arabian Shield and industrial transformation context.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-atlas-line">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(rgba(184,146,74,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(184,146,74,0.05) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            maskImage:
              "radial-gradient(120% 90% at 50% 0%, black 25%, transparent 70%)",
          }}
        />
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[40rem] -translate-x-1/2 rounded-full bg-gold/10 blur-[120px]" />

        <div className="container-content relative py-24 md:py-32">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-gold">
              <AkanilMark className="h-4 w-4 text-gold" />
              Strategic Minerals · Trust Architecture
            </div>

            <h1 className="heading-xl mt-8 max-w-4xl text-ivory">
              Akanil Strategic Minerals{" "}
              <span className="text-gold">Trust Architecture</span>
            </h1>

            <p className="body-lead mt-6 max-w-2xl">
              Building digital and institutional trust layers for mining,
              strategic minerals, and decision-ready mineral ecosystems.
            </p>

            <p className="mt-6 max-w-3xl text-base leading-relaxed text-atlas-grey">
              Akanil operates at the intersection of mining intelligence,
              governance, digital data rooms, artificial intelligence, and
              strategic mineral value chains. We organize mineral opportunities
              into structured evidence, controlled access pathways, and
              institutional review frameworks for banks, funds, and strategic
              stakeholders.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <TrackedLink
                href="/contact"
                event={ANALYTICS_EVENTS.briefing_click}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-gold px-5 py-3 text-sm font-medium text-obsidian transition-colors hover:bg-gold-light"
              >
                Request Institutional Briefing
              </TrackedLink>
              <CTAButton href="#ecosystem" variant="outline">
                Explore the Ecosystem
              </CTAButton>
              <TrackedLink
                href="/data-room"
                event={ANALYTICS_EVENTS.data_room_request_click}
                className="inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-medium text-ivory-muted transition-colors hover:text-gold"
              >
                Access Data Room →
              </TrackedLink>
            </div>

            <p className="mt-12 font-display text-sm font-medium uppercase tracking-[0.22em] text-gold/90">
              {SITE.tagline} &nbsp;·&nbsp; {SITE.extendedTagline}
            </p>
          </div>
        </div>
      </section>

      {/* What We Build */}
      <Section>
        <Eyebrow>What We Build</Eyebrow>
        <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <h2 className="heading-lg max-w-md text-ivory">
            Trust architecture around mineral projects.
          </h2>
          <CheckList items={WHAT_WE_BUILD} columns={2} />
        </div>
      </Section>

      {/* Why It Matters */}
      <Section className="border-y border-atlas-line bg-obsidian-900">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <Eyebrow>Why It Matters</Eyebrow>
            <h2 className="heading-lg mt-6 text-ivory">
              The layer between mineral potential and institutional
              decision-making.
            </h2>
          </div>
          <div className="space-y-5 text-atlas-grey">
            <p className="leading-relaxed">
              Mining projects do not become institutionally ready only because
              land, samples, or technical reports exist.
            </p>
            <p className="leading-relaxed">
              They become reviewable when evidence is structured, documents are
              governed, risks are visible, assumptions are separated from
              verified facts, and access is controlled.
            </p>
            <p className="border-l-2 border-gold/40 pl-4 font-display text-lg font-medium text-gold">
              Akanil builds the layer between mineral potential and institutional
              decision-making.
            </p>
          </div>
        </div>
      </Section>

      {/* Ecosystem */}
      <Section id="ecosystem">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <Eyebrow>Ecosystem Overview</Eyebrow>
            <h2 className="heading-lg mt-6 max-w-xl text-ivory">
              Five connected digital windows.
            </h2>
          </div>
          <Link
            href="/akanil"
            className="text-sm font-medium text-gold hover:text-gold-light"
          >
            About the architecture →
          </Link>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {WINDOWS.map((w) => (
            <WindowCard key={w.slug} window={w} />
          ))}
        </div>
      </Section>

      {/* Trust pathway */}
      <Section className="border-t border-atlas-line bg-obsidian-900">
        <Eyebrow>Public to Private Journey</Eyebrow>
        <h2 className="heading-lg mt-6 max-w-2xl text-ivory">
          A controlled pathway from public trust to strategic partnership.
        </h2>
        <div className="mt-10">
          <TrustPathway />
        </div>
      </Section>

      {/* Strategic geography */}
      <Section>
        <Eyebrow>Strategic Geography</Eyebrow>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {GEOGRAPHY.map((g) => (
            <div
              key={g.name}
              className="rounded-xl border border-atlas-line bg-obsidian-800 p-6"
            >
              <h3 className="heading-md text-gold">{g.name}</h3>
              <p className="mt-3 text-sm leading-relaxed text-atlas-grey">
                {g.text}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Closing statement */}
      <Section className="border-t border-atlas-line bg-obsidian-900">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>
            <span className="mx-auto">A Disciplined Question</span>
          </Eyebrow>
          <p className="mt-6 text-lg leading-relaxed text-atlas-grey">
            Akanil is not built around a single mining opportunity. It is built
            around a disciplined question:
          </p>
          <p className="mt-6 font-display text-2xl font-semibold leading-snug text-ivory md:text-3xl">
            How can mineral information become trusted, governed, reviewable, and
            ready for institutional decision-making?
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <CTAButton href="/contact">Request Institutional Briefing</CTAButton>
            <CTAButton href="/akanil" variant="outline">
              Explore Akanil
            </CTAButton>
          </div>
        </div>
      </Section>
    </>
  );
}
