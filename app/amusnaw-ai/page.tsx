import type { Metadata } from "next";
import {
  PageHeader,
  Section,
  Eyebrow,
  CheckList,
  CTARow,
  InfoCard,
  MaturityBadge,
} from "@/components/ui";
import { getWindowHero } from "@/lib/sanity/queries";

export const metadata: Metadata = {
  title: "Amusnaw AI — Moroccan Smart Mining Intelligence Infrastructure",
  description:
    "Amusnaw AI is a Moroccan smart mining intelligence infrastructure concept focused on exploration data, strategic minerals, mineral value intelligence, and institutional decision layers.",
};

const WHY_MOROCCO = [
  "Institutional stability",
  "Strategic location",
  "Access to Africa",
  "Financial and banking capabilities",
  "Mining, energy, and industrial potential",
  "Capacity to host advanced digital trust models",
];

const MODULES = [
  "Mineral Data Room",
  "Smart Exploration Layer",
  "Aguelmous Demonstrator",
  "Isseksi Operating Case",
  "Mineral Value Intelligence",
  "Institutional Decision Layer",
  "Partner Access Layer",
];

const MINERALS = [
  "Copper",
  "Gold",
  "Silver",
  "Zinc",
  "Lead",
  "Nickel",
  "Cobalt",
  "Lithium",
  "Tin",
  "Manganese",
  "Rare Earths",
  "Phosphate",
  "Industrial Minerals",
];

export default async function AmusnawPage() {
  const hero = await getWindowHero("amusnawAiPage");

  return (
    <>
      <PageHeader
        eyebrow={hero?.eyebrow || "Extended Ecosystem · Amusnaw AI"}
        title={
          hero?.title ||
          "Amusnaw AI — Moroccan Smart Mining Intelligence Infrastructure"
        }
        intro={
          hero?.heroIntro ||
          "Amusnaw AI is designed to organize exploration data, strategic mineral knowledge, operating cases, mineral value references, and institutional decision layers within a Moroccan smart mining intelligence framework."
        }
        coreMessage={
          hero?.coreMessage ||
          "Amusnaw AI aims to transform mining and strategic minerals data into a Moroccan digital infrastructure for review, development, and institutional decision-making."
        }
        accent="emerald"
        badge="Extended Ecosystem · Morocco Intelligence Layer"
      />

      <div className="border-b border-atlas-line bg-obsidian-900">
        <div className="container-content py-4">
          <p className="text-sm text-atlas-grey">
            <span className="mr-2 rounded-full border border-emerald/40 bg-emerald/10 px-2.5 py-0.5 text-xs font-medium text-emerald-light">
              Deferred Module
            </span>
            Amusnaw AI is a Morocco-oriented module on the broader roadmap. It
            remains part of the platform but is not a primary node in the current
            ecosystem emphasis.
          </p>
        </div>
      </div>

      <Section>
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>Why Morocco</Eyebrow>
            <div className="mt-6 rounded-xl border border-atlas-line bg-obsidian-800 p-7">
              <CheckList items={WHY_MOROCCO} accent="emerald" />
            </div>
          </div>
          <div>
            <Eyebrow>Core Modules</Eyebrow>
            <div className="mt-6 rounded-xl border border-atlas-line bg-obsidian-800 p-7">
              <CheckList items={MODULES} accent="emerald" />
            </div>
          </div>
        </div>
      </Section>

      <Section className="border-y border-atlas-line bg-obsidian-900">
        <Eyebrow>Core Cases</Eyebrow>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <InfoCard title="Aguelmous" accent="emerald">
            <div className="mb-3">
              <MaturityBadge label="R&D Demonstrator" accent="emerald" />
            </div>
            A smart exploration R&amp;D demonstrator linked to fault analysis,
            remote sensing, Pre-JORC preparation, and structured validation
            pathways.
          </InfoCard>
          <InfoCard title="Isseksi" accent="emerald">
            <div className="mb-3">
              <MaturityBadge label="Operating Case" accent="emerald" />
            </div>
            A field-operating copper case connecting mining operations, data,
            evidence governance, and institutional review.
          </InfoCard>
        </div>
      </Section>

      <Section>
        <Eyebrow>Mineral Value Intelligence</Eyebrow>
        <p className="mt-6 max-w-2xl text-atlas-grey">
          Amusnaw AI includes reference coverage across strategic and industrial
          minerals.
        </p>
        <div className="mt-8 flex flex-wrap gap-2.5">
          {MINERALS.map((m) => (
            <span
              key={m}
              className="rounded-full border border-emerald/40 bg-emerald/5 px-4 py-1.5 text-sm text-emerald-light"
            >
              {m}
            </span>
          ))}
        </div>
        <p className="mt-6 text-xs leading-relaxed text-atlas-grey/80">
          All market and value references are indicative only and should not be
          treated as final asset valuations.
        </p>
        <div className="mt-10">
          <CTARow
            ctas={[
              { label: "Request Amusnaw Institutional Memo", href: "/contact" },
              { label: "Explore Smart Mining Infrastructure", href: "/contact", variant: "outline" },
              { label: "Request CDG-Ready Package", href: "/data-room", variant: "outline" },
            ]}
          />
        </div>
      </Section>
    </>
  );
}
