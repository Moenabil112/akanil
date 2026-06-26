import type { Metadata } from "next";
import { PageHeader, Section, Eyebrow, CTAButton } from "@/components/ui";
import { getWindowHero } from "@/lib/sanity/queries";

export const metadata: Metadata = {
  title: "Mustadam — Sustainability & Local Impact Layer",
  description:
    "Mustadam (مُستدام) is Akanil's sustainability and local impact layer for fair resource governance, people of place, water, energy, agriculture, ecological building, and environmental sanitation.",
};

const PILLARS = [
  {
    name: "People of Place",
    items: [
      "Local engagement records",
      "Local training opportunities",
      "Local employment potential",
      "Skills transfer activities",
    ],
  },
  {
    name: "Local Knowledge Development",
    items: [
      "Field knowledge records",
      "Community observations documented",
      "Training sessions",
      "Local knowledge mapped into structured data",
    ],
  },
  {
    name: "Renewable Energy",
    items: [
      "Renewable energy potential assessed",
      "Solar / hybrid energy scenarios",
      "Diesel reduction potential",
      "Energy access improvements",
    ],
  },
  {
    name: "Water",
    items: [
      "Water need assessment",
      "Desalination feasibility",
      "Water reuse potential",
      "Community water benefit logic",
    ],
  },
  {
    name: "Smart Agriculture",
    items: [
      "Food security linkage",
      "Smart agriculture pilot potential",
      "Water-energy-agriculture integration",
    ],
  },
  {
    name: "Ecological Building",
    items: [
      "Local material suitability",
      "Low-impact construction logic",
      "Climate-responsive design",
    ],
  },
  {
    name: "Environmental Sanitation",
    items: [
      "Waste management plans",
      "Rehabilitation logic",
      "Site cleanliness standards",
      "Environmental monitoring notes",
    ],
  },
  {
    name: "Fair Resource Governance",
    items: [
      "Transparent access process",
      "Evidence governance",
      "Benefit-sharing logic",
      "Local impact reporting",
    ],
  },
];

export default async function SustainabilityPage() {
  const hero = await getWindowHero("sustainabilityPage");

  return (
    <>
      <PageHeader
        eyebrow={hero?.eyebrow || "Mustadam · مُستدام"}
        title={hero?.title || "Mustadam — Sustainability & Local Impact Layer"}
        intro={
          hero?.heroIntro ||
          "Mustadam is Akanil's sustainability and local impact layer for fair resource governance, people of place, water, energy, agriculture, ecological building, and environmental sanitation. It is a development philosophy and impact framework — quantified claims are made only where supported by metrics and evidence."
        }
        coreMessage={
          hero?.coreMessage ||
          "Sustainability is the fair governance of natural resources with visible developmental impact for people, land, water, energy, and local knowledge."
        }
        accent="emerald"
        badge="Development Philosophy & Impact Framework"
      />

      <Section>
        <Eyebrow>Impact Framework</Eyebrow>
        <h2 className="heading-lg mt-6 max-w-2xl text-ivory">
          Eight pillars of measurable impact logic.
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => (
            <div
              key={p.name}
              className="rounded-xl border border-atlas-line bg-obsidian-800 p-6"
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald" />
                <h3 className="font-display text-base font-semibold text-ivory">
                  {p.name}
                </h3>
              </div>
              <ul className="mt-4 space-y-2">
                {p.items.map((i) => (
                  <li key={i} className="text-sm leading-relaxed text-atlas-grey">
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section className="border-t border-atlas-line bg-obsidian-900">
        <div className="rounded-xl border border-emerald/30 bg-emerald/5 p-8">
          <h2 className="heading-md text-ivory">From philosophy to measurable logic</h2>
          <p className="mt-3 max-w-3xl text-atlas-grey">
            Each pillar is tracked through structured sustainability indicators —
            with baseline, target, current status, and linked evidence — and a
            local impact registry representing &ldquo;People of Place&rdquo; as a
            governed development interface.
          </p>
          <div className="mt-6">
            <CTAButton href="/contact">Request Mustadam Framework Memo</CTAButton>
          </div>
        </div>
      </Section>
    </>
  );
}
