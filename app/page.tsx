import Link from "next/link";
import { PRIMARY_NODES, DEFERRED_MODULES, SITE, ACCENT_CLASS } from "@/lib/site";
import { EcosystemMap } from "@/components/ecosystem-map";
import { RelationshipFlow } from "@/components/relationship-flow";
import { WindowCard } from "@/components/window-card";
import { TrustPathway } from "@/components/trust-pathway";
import { Section, Eyebrow, CTAButton } from "@/components/ui";
import { TrackedLink } from "@/components/track";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { AkanilMark } from "@/components/logo";

const ORGANIZES = [
  { k: "Technology", v: "AI infrastructure & automation — ZYNTRA Deeptech." },
  { k: "Product", v: "A mining intelligence operating product — QASSAS." },
  { k: "Governance", v: "Evidence, data rooms & controlled access — HYRION." },
  { k: "Field & Portfolio", v: "Operating mining use cases — ATLAS Golden Mining." },
  { k: "Impact", v: "Sustainability & local impact — Mustadam." },
];

export default function HomePage() {
  return (
    <>
      {/* 1 — Ecosystem Hero / Central System View */}
      <section className="relative overflow-hidden border-b border-atlas-line">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(rgba(184,146,74,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(184,146,74,0.05) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            maskImage: "radial-gradient(120% 90% at 50% 0%, black 25%, transparent 70%)",
          }}
        />
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[40rem] -translate-x-1/2 rounded-full bg-gold/10 blur-[120px]" />

        <div className="container-content relative py-20 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-gold">
              <AkanilMark className="h-4 w-4 text-gold" />
              Institutional Ecosystem
            </div>
            <h1 className="heading-xl mt-7 text-ivory">
              AKANIL <span className="text-gold">TRUST ARCHITECTURE</span>
            </h1>
            <p className="body-lead mt-5">{SITE.supporting}</p>
            <p className="mt-4 font-display text-sm font-medium uppercase tracking-[0.24em] text-gold/90">
              {SITE.tagline}
            </p>
          </div>

          {/* central system map */}
          <div className="mt-12 md:mt-16">
            <EcosystemMap />
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-3">
            <TrackedLink
              href="/contact"
              event={ANALYTICS_EVENTS.briefing_click}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-gold px-5 py-3 text-sm font-medium text-obsidian transition-colors hover:bg-gold-light"
            >
              Request Institutional Briefing
            </TrackedLink>
            <TrackedLink
              href="/data-room"
              event={ANALYTICS_EVENTS.data_room_request_click}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/50 px-5 py-3 text-sm font-medium text-gold transition-colors hover:bg-gold hover:text-obsidian"
            >
              Access Data Room
            </TrackedLink>
          </div>
        </div>
      </section>

      {/* 2 — Ecosystem Explanation */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <Eyebrow>The Trust Architecture House</Eyebrow>
            <h2 className="heading-lg mt-6 text-ivory">
              Akanil organizes a connected institutional system.
            </h2>
            <p className="mt-5 text-atlas-grey">
              Akanil is a strategic minerals and trust architecture house. It
              organizes technology, product, governance, field use cases, and
              impact into one ecosystem — so institutions can understand what is
              known, what is governed, and what is ready for decision-making.
            </p>
            <Link
              href="/akanil"
              className="mt-6 inline-block text-sm font-medium text-gold hover:text-gold-light"
            >
              About the architecture →
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {ORGANIZES.map((o) => (
              <li key={o.k} className="rounded-xl border border-atlas-line bg-obsidian-800 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold/80">{o.k}</p>
                <p className="mt-2 text-sm leading-relaxed text-atlas-grey">{o.v}</p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* 3 — System Relationship Flow */}
      <Section className="border-t border-atlas-line bg-obsidian-900">
        <Eyebrow>System Relationship Flow</Eyebrow>
        <h2 className="heading-lg mt-6 max-w-2xl text-ivory">
          From field portfolio to sustainable, governed decisions.
        </h2>
        <p className="mt-4 max-w-2xl text-atlas-grey">
          Field evidence becomes intelligence, intelligence becomes governed
          evidence, governed evidence becomes institutional review — and value is
          measured as sustainable impact. Akanil remains the central architecture
          throughout.
        </p>
        <div className="mt-10">
          <RelationshipFlow />
        </div>
      </Section>

      {/* 4 — Primary Windows / Core Layers */}
      <Section>
        <Eyebrow>Primary Core Layers</Eyebrow>
        <h2 className="heading-lg mt-6 max-w-2xl text-ivory">
          The five layers around Akanil.
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PRIMARY_NODES.map((node) => (
            <WindowCard key={node.slug} node={node} />
          ))}
        </div>
      </Section>

      {/* 5 — Data Room / Access Layer */}
      <Section className="border-y border-atlas-line bg-obsidian-900">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <Eyebrow>Controlled Access Layer</Eyebrow>
            <h2 className="heading-lg mt-6 text-ivory">
              An institutional access layer, not a download portal.
            </h2>
            <p className="mt-5 text-atlas-grey">
              HYRION governs how evidence is structured and who can see it. Access
              moves through a controlled, traceable pathway — with NDA gating and
              window-based permissions — without exposing sensitive content.
            </p>
            <div className="mt-7">
              <CTAButton href="/data-room">Apply for Data Room Access</CTAButton>
            </div>
          </div>
          <TrustPathway />
        </div>
      </Section>

      {/* 6 — Founder Layer (separate identity, not an ecosystem node) */}
      <Section>
        <div className="rounded-2xl border border-atlas-line bg-obsidian-800 p-8 md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <Eyebrow>Founder &amp; Leadership Layer</Eyebrow>
              <h2 className="heading-lg mt-6 text-ivory">Mohamed Nabil</h2>
              <p className="mt-2 font-display text-gold">
                Founder of Akanil &amp; Co-Founder of ZYNTRA Deeptech
              </p>
              <p className="mt-4 text-sm text-atlas-grey">
                Architect of Mining Intelligence, Trust Governance &amp; Sustainable
                Resource Systems.
              </p>
              <Link
                href="/founder"
                className="mt-6 inline-block text-sm font-medium text-gold hover:text-gold-light"
              >
                Read the founder narrative →
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              {["Reading the Land", "Structuring Knowledge", "Building Trust"].map((s, i, a) => (
                <span key={s} className="flex items-center gap-3">
                  <span className="rounded-lg border border-atlas-line bg-obsidian-700 px-4 py-2.5 text-sm font-medium text-ivory">
                    {s}
                  </span>
                  {i < a.length - 1 && <span className="text-gold/50">→</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* 7 — Extended / Deferred Modules */}
      <Section className="border-t border-atlas-line bg-obsidian-900">
        <Eyebrow>Extended Ecosystem</Eyebrow>
        <h2 className="heading-lg mt-6 max-w-2xl text-ivory">Additional modules.</h2>
        <p className="mt-4 max-w-2xl text-atlas-grey">
          Beyond the primary system, Akanil maintains extended modules that are
          part of the broader roadmap but are not the central emphasis today.
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {DEFERRED_MODULES.map((m) => {
            const accent = ACCENT_CLASS[m.accent];
            return (
              <Link
                key={m.slug}
                href={m.href}
                className="group flex items-center justify-between rounded-xl border border-atlas-line bg-obsidian-800 p-6 transition-colors hover:border-gold/30"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${accent.dot}`} />
                    <span className="font-display text-base font-semibold text-ivory">{m.name}</span>
                    {m.note && (
                      <span className="rounded-full border border-atlas-line px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-atlas-grey">
                        {m.note}
                      </span>
                    )}
                  </div>
                  <p className={`mt-1.5 text-sm ${accent.text}`}>{m.role}</p>
                </div>
                <span className="text-gold transition-transform group-hover:translate-x-1">→</span>
              </Link>
            );
          })}
        </div>
      </Section>

      {/* Closing */}
      <Section className="border-t border-atlas-line">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-display text-2xl font-semibold leading-snug text-ivory md:text-3xl">
            From Earth to Trust.
          </p>
          <p className="mt-4 text-atlas-grey">
            From field knowledge and mineral data to governed intelligence,
            sustainable value, and institutional decision-making.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <CTAButton href="/contact">Request Institutional Briefing</CTAButton>
            <CTAButton href="/akanil" variant="outline">
              Explore the Architecture
            </CTAButton>
          </div>
        </div>
      </Section>
    </>
  );
}
