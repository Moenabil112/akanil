import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section, Eyebrow, CheckList, CTARow } from "@/components/ui";
import { getWindowHero } from "@/lib/sanity/queries";

export const metadata: Metadata = {
  title: "ZYNTRA Deeptech — AI-Powered Mining Operations Intelligence",
  description:
    "ZYNTRA Deeptech provides AI-powered mining operations intelligence for production visibility, fuel monitoring, cost control, and CIL plant optimization.",
};

const MONITORS = [
  "Production",
  "Fuel consumption",
  "Equipment activity",
  "Plant performance",
  "Recovery indicators",
  "Operating deviations",
  "Cost per ton",
  "Management reporting",
];

const FUEL = [
  "Fuel Baseline",
  "Fuel Variance",
  "Equipment Consumption",
  "Production vs Fuel",
  "Cost per Ton",
  "Alerts & Optimization",
];

const DEPLOYMENT = [
  "Site Assessment",
  "Data Mapping",
  "Input Integration",
  "Operating Logic Setup",
  "Team Training",
  "Management Reporting",
  "Continuous Optimization",
];

export default async function ZyntraPage() {
  const hero = await getWindowHero("zyntraPage");

  return (
    <>
      <PageHeader
        eyebrow={hero?.eyebrow || "Digital Window · ZYNTRA Deeptech"}
        title={hero?.title || "ZYNTRA Deeptech — AI-Powered Mining Operations Intelligence"}
        intro={
          hero?.heroIntro ||
          "ZYNTRA helps mining sites and processing plants improve visibility over production, fuel, equipment, recovery indicators, cost per ton, and daily operating deviations."
        }
        coreMessage={
          hero?.coreMessage ||
          "ZYNTRA helps mining operations see what is happening, understand why it is happening, and make better operating decisions."
        }
        accent="teal"
        badge="AI Infrastructure & Automation Layer"
      />

      {/* QASSAS product banner */}
      <div className="border-b border-atlas-line bg-obsidian-900">
        <div className="container-content flex flex-col items-start justify-between gap-4 py-6 sm:flex-row sm:items-center">
          <div>
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-teal-light">
              ZYNTRA Product
            </span>
            <p className="mt-1 text-ivory">
              <span className="font-display font-semibold">QASSAS</span> — a Mining
              OS for exploration &amp; operating intelligence.
            </p>
          </div>
          <Link
            href="/zyntra/qassas"
            className="rounded-md border border-teal/50 px-4 py-2 text-sm font-medium text-teal-light transition-colors hover:bg-teal hover:text-ivory"
          >
            Explore QASSAS →
          </Link>
        </div>
      </div>

      <Section>
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>What ZYNTRA Monitors</Eyebrow>
            <div className="mt-6 rounded-xl border border-atlas-line bg-obsidian-800 p-7">
              <CheckList items={MONITORS} accent="teal" columns={2} />
            </div>
          </div>
          <div>
            <Eyebrow>Fuel &amp; Cost Intelligence</Eyebrow>
            <div className="mt-6 rounded-xl border border-atlas-line bg-obsidian-800 p-7">
              <CheckList items={FUEL} accent="teal" />
            </div>
          </div>
        </div>
      </Section>

      <Section className="border-y border-atlas-line bg-obsidian-900">
        <Eyebrow>CIL Plant Optimization</Eyebrow>
        <p className="mt-6 max-w-3xl text-atlas-grey">
          For CIL plants, ZYNTRA supports operational visibility around incoming
          ore, throughput, fuel usage, equipment performance, recovery indicators,
          consumables, daily deviations, cost control, and management reporting.
        </p>
      </Section>

      <Section>
        <Eyebrow>Deployment Model</Eyebrow>
        <ol className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {DEPLOYMENT.map((step, i) => (
            <li
              key={step}
              className="rounded-xl border border-atlas-line bg-obsidian-800 p-5"
            >
              <span className="font-display text-sm text-teal-light">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="mt-2 text-sm font-medium text-ivory">{step}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10">
          <CTARow
            ctas={[
              { label: "Request CIL Optimization Brief", href: "/contact" },
              { label: "Book Technical Call", href: "/contact" },
              { label: "Request Plant Assessment", href: "/contact" },
            ]}
          />
        </div>
      </Section>
    </>
  );
}
