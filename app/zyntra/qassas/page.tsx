import type { Metadata } from "next";
import Link from "next/link";
import {
  PageHeader,
  Section,
  Eyebrow,
  CheckList,
  CTARow,
  InfoCard,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "QASSAS — A ZYNTRA Product for Mining Exploration & Operating Intelligence",
  description:
    "QASSAS is an active mining intelligence product managed by ZYNTRA Deeptech — a Mining OS with seven local AI models for exploration, license management, and operating intelligence.",
};

const SECTIONS = [
  "Product Overview",
  "Interface Preview",
  "Seven Local AI Models",
  "License Management",
  "Exploration Intelligence",
  "Geological Knowledge Layer",
  "Atlas Golden Mining KSA Use Case",
  "Ownership & Governance Note",
  "Product Brief / Demo",
];

const OS_VIEWS = [
  "License Cards",
  "AI Model Cards",
  "Geological Knowledge Graph",
  "Local Data Layer",
  "Decision Support Layer",
  "Operator Console",
  "Exploration Portfolio View",
];

export default function QassasPage() {
  return (
    <>
      <PageHeader
        eyebrow="ZYNTRA Product · QASSAS"
        title="QASSAS — A ZYNTRA Product for Mining Exploration & Operating Intelligence"
        intro="QASSAS is an active mining intelligence product managed by ZYNTRA Deeptech. It includes a user interface and seven local AI models designed to support exploration, license management, geological knowledge organization, and operating intelligence."
        accent="teal"
      />

      <div className="border-b border-atlas-line bg-obsidian-900">
        <div className="container-content py-4">
          <Link
            href="/zyntra"
            className="text-sm text-atlas-grey transition-colors hover:text-teal-light"
          >
            ← Back to ZYNTRA Deeptech
          </Link>
        </div>
      </div>

      <Section>
        <Eyebrow>Mining OS — Product Visualization</Eyebrow>
        <h2 className="heading-lg mt-6 max-w-2xl text-ivory">
          QASSAS presented as a Mining Operating System.
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {OS_VIEWS.map((v) => (
            <div
              key={v}
              className="flex items-center gap-3 rounded-xl border border-atlas-line bg-obsidian-800 p-5"
            >
              <span className="h-2 w-2 rounded-full bg-teal" />
              <span className="text-ivory">{v}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section className="border-y border-atlas-line bg-obsidian-900">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>Key Sections</Eyebrow>
            <ol className="mt-6 grid gap-2.5">
              {SECTIONS.map((s, i) => (
                <li
                  key={s}
                  className="flex items-center gap-4 rounded-lg border border-atlas-line bg-obsidian-800 px-5 py-3"
                >
                  <span className="font-display text-sm text-teal-light">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-ivory">{s}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="space-y-6">
            <div>
              <Eyebrow>Current Use Case</Eyebrow>
              <div className="mt-6">
                <InfoCard title="Atlas Golden Mining KSA" accent="teal">
                  QASSAS was presented to Atlas Golden Mining KSA as a local
                  experimental operating system for managing 4 exploitation
                  licenses and 15+ exploration licenses.
                </InfoCard>
              </div>
            </div>
            <div>
              <Eyebrow>Ownership &amp; Governance</Eyebrow>
              <div className="mt-6 rounded-xl border border-atlas-line bg-obsidian-800 p-6">
                <CheckList
                  items={["75% ZYNTRA Deeptech", "25% Mohamed Nabil"]}
                  accent="teal"
                />
                <p className="mt-4 text-xs leading-relaxed text-atlas-grey/80">
                  QASSAS is showcased without exposing sensitive internal systems.
                  Demo access follows a controlled technical partner workflow.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <CTARow
          ctas={[
            { label: "Request QASSAS Product Brief", href: "/data-room" },
            { label: "View QASSAS Use Case", href: "/contact", variant: "outline" },
            { label: "Explore Mining OS Demo", href: "/data-room", variant: "outline" },
          ]}
        />
      </Section>
    </>
  );
}
