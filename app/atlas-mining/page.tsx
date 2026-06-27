import type { Metadata } from "next";
import {
  PageHeader,
  Section,
  Eyebrow,
  CheckList,
  CTARow,
  InfoCard,
} from "@/components/ui";
import { getWindowHero } from "@/lib/sanity/queries";

export const metadata: Metadata = {
  title: "ATLAS Golden Mining — Mining Portfolio / Field Use Case Layer",
  description:
    "ATLAS Golden Mining is the mining portfolio and field use-case layer within the Akanil ecosystem, focused on copper development, mobile processing concepts, and structured technical evidence.",
};

const FOCUS = [
  "Copper development in Morocco",
  "Field operations",
  "Quarry and site organization",
  "Sampling and documentation",
  "Mobile processing concepts",
  "Cement copper production logic",
  "Evidence governance through HYRION",
];

const EVIDENCE = [
  "License context",
  "Sample reports",
  "Collection protocols",
  "Maps",
  "Processing concepts",
  "Operating assumptions",
  "Risk notes",
  "Decision memos",
];

export default async function AtlasMiningPage() {
  const hero = await getWindowHero("atlasMiningPage");

  return (
    <>
      <PageHeader
        eyebrow={hero?.eyebrow || "Core Layer · ATLAS Golden Mining"}
        title={hero?.title || "ATLAS Golden Mining — Mining Portfolio / Field Use Case Layer"}
        intro={
          hero?.heroIntro ||
          "ATLAS Golden Mining connects the Akanil trust architecture to real field-operating mining cases — the portfolio and use-case layer covering copper development, quarries, sampling, mobile processing concepts, and structured technical evidence."
        }
        coreMessage={
          hero?.coreMessage ||
          "ATLAS Golden Mining connects land to data, data to evidence rooms, and evidence rooms to institutional decision-making."
        }
        accent="copper"
        badge="Mining Portfolio / Field Use Case Layer"
      />

      <Section>
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>Operating Focus</Eyebrow>
            <div className="mt-6 rounded-xl border border-atlas-line bg-obsidian-800 p-7">
              <CheckList items={FOCUS} accent="copper" />
            </div>
          </div>
          <div>
            <Eyebrow>Evidence Layer</Eyebrow>
            <div className="mt-6 rounded-xl border border-atlas-line bg-obsidian-800 p-7">
              <CheckList items={EVIDENCE} accent="copper" columns={2} />
            </div>
          </div>
        </div>
      </Section>

      <Section className="border-y border-atlas-line bg-obsidian-900">
        <Eyebrow>Mobile Processing Concept</Eyebrow>
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
          <h2 className="heading-lg text-ivory">
            ATLAS Field MVP — Mobile Closed-Loop Vat &amp; Column Leaching Unit
          </h2>
          <p className="text-atlas-grey">
            A staged mobile processing concept designed to support ore testing,
            operating learning, pilot production logic, and technical validation
            before any larger fixed-plant decision.
          </p>
        </div>
      </Section>

      <Section>
        <div className="rounded-xl border border-copper/30 bg-copper/5 p-7">
          <InfoCard title="Important Note" accent="copper">
            Atlas Mining does not claim mineral reserves or resources unless
            supported by independent technical reports prepared under recognized
            reporting standards.
          </InfoCard>
        </div>
        <div className="mt-10">
          <CTARow
            ctas={[
              { label: "Request Atlas Brief", href: "/contact" },
              { label: "Schedule Technical Review", href: "/contact" },
              { label: "Access Atlas Data Room", href: "/data-room" },
            ]}
          />
        </div>
      </Section>
    </>
  );
}
